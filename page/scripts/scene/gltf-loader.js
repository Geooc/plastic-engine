// gltf-loader.js: load gltf scene

import { mathUtils } from '../utils/math-utils.js'
import { assetUtils } from '../utils/asset-utils.js'
import { check, error } from '../utils/debug-utils.js'
import { renderContext as rc } from '../render-context.js'

const convertAttributeName = {
    POSITION    : 'aLocalPosition',
    NORMAL      : 'aNormal',
    TANGENT     : 'aTangent',
    TEXCOORD_0  : 'aUV0',
    TEXCOORD_1  : 'aUV1',
    TEXCOORD_2  : 'aUV2',
    JOINTS_0    : 'aJoints',
    WEIGHTS_0   : 'aWeights'
};

const convertAttributeSize = {
    SCALAR  : 1,
    VEC2    : 2,
    VEC3    : 3,
    VEC4    : 4,
    MAT4    : 16
};

// gltf utils
function getFloatArrayBufferView(gltf, ArrayBuffers, accessor) {
    let bufferView = gltf.bufferViews[accessor.bufferView];
    if (accessor.componentType != rc.DATA_FLOAT) error('must be FLOAT component type!');
    let accessorOfs = accessor.byteOffset ? accessor.byteOffset : 0;
    let ofs = (bufferView.byteOffset ? bufferView.byteOffset : 0) + accessorOfs;
    let length = convertAttributeSize[accessor.type] * accessor.count;
    if (!length) error('wrong accessor count!');
    return new Float32Array(ArrayBuffers[bufferView.buffer], ofs, length);
}

function calcInterpolation(gltf, gltfArrayBuffers, sampler, time) {
    let keysAccessor = gltf.accessors[sampler.input];
    let valuesAccessor = gltf.accessors[sampler.output];
    if (keysAccessor.type != 'SCALAR') error('wrong key accessor!');
    let keys = getFloatArrayBufferView(gltf, gltfArrayBuffers, keysAccessor);
    let values = getFloatArrayBufferView(gltf, gltfArrayBuffers, valuesAccessor);
    
    let k = 1;
    let index = keys.length - 1;
    for (let i = 0; i < keys.length; ++i) {// todo: O(n), can be faster
        if (keys[i] < time) continue;
        else if (keys[i] > time) k = (time - keys[i - 1]) / (keys[i] - keys[i - 1]);
        index = i;
        break;
    }

    if (valuesAccessor.type == 'SCALAR') {// must be scale
        let value = 1;
        if (index == 0) value = values[index];
        else value = values[index - 1] + (values[index] - values[index - 1]) * k;
        return [value, value, value];
    }
    if (valuesAccessor.type == 'VEC3') {// can be scale or translation
        let ofs = index * 3;
        if (index == 0) return values.slice(ofs, ofs + 3);
        else return mathUtils.lerpVector(values.slice(ofs - 3, ofs), values.slice(ofs, ofs + 3), k);
    }
    if (valuesAccessor.type == 'VEC4') {// must be quat rot
        let ofs = index * 4;
        if (index == 0) return values.slice(ofs, ofs + 4);
        else return mathUtils.slerpQuat(values.slice(ofs - 4, ofs), values.slice(ofs, ofs + 4), k);
    }
}

function calcAnimatedNodeTransform(gltf, gltfArrayBuffers, node, animatedNode, time) {
    // init as node's local transform
    let trans = node.translation ? node.translation : [0, 0, 0];
    let rot = node.rotation ? node.rotation : [0, 0, 0, 1];
    let scale = node.scale ? node.scale : [1, 1, 1];

    if (animatedNode.translation) {
        if (animatedNode.translation.interpolation != 'LINEAR') error('only support LINEAR interpolation for now!');
        trans = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.translation, time);
    }
    if (animatedNode.rotation) {
        if (animatedNode.rotation.interpolation != 'LINEAR') error('only support LINEAR interpolation for now!');
        rot = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.rotation, time);
    }
    if (animatedNode.scale) {
        if (animatedNode.scale.interpolation != 'LINEAR') error('only support LINEAR interpolation for now!');
        scale = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.scale, time);
    }
    return mathUtils.calcTransform(trans, rot, scale);
}

function calcAnimationTextureSamplePosY(animFrameCount, animationDuration, time) {
    return (time / animationDuration) * (animFrameCount - 1) / animFrameCount + 0.5 / animFrameCount;
}

function createAnimationFromGLTF(gltf, gltfArrayBuffers, animationId = 0) {
    if (!gltf || !gltf.skins || !gltf.animations) return null;

    let ret = {
        animationTextures : new Array(gltf.skins.length),
        animationTexturesSize : new Array(gltf.skins.length),
        animationDuration : 0,
        animatedNodes : null
    };
    let animatedNodes = {};
    let animationDuration = 0;
    let animation = gltf.animations[animationId];
    // store the sampler and get duration
    for (let j = 0; j < animation.channels.length; ++j) {
        let channel = animation.channels[j];
        let sampler = animation.samplers[channel.sampler];
        if (!animatedNodes[channel.target.node]) animatedNodes[channel.target.node] = {};
        animatedNodes[channel.target.node][channel.target.path] = sampler;
        animationDuration = Math.max(animationDuration, gltf.accessors[sampler.input].max);
    }
    ret.animatedNodes = animatedNodes;
    ret.animationDuration = animationDuration;

    // for each skin bind
    for (let i = 0; i < gltf.skins.length; ++i) {
        let nodeJointId = {};
        for (let j = 0; j < gltf.skins[i].joints.length; ++j) {// record joint id
            nodeJointId[gltf.skins[i].joints[j]] = j;
        }
        let invBindMatricesAccessor = gltf.accessors[gltf.skins[i].inverseBindMatrices];
        let invBindMatrices = getFloatArrayBufferView(gltf, gltfArrayBuffers, invBindMatricesAccessor);
        let jointsGlobalMatrices = new Array(gltf.skins[i].joints.length);

        let textureData = new Array();
        let animFrameCount = Math.floor(animationDuration * 24);// about 24 frames per second
        let d = animationDuration / (animFrameCount - 1);
        for (let t = 0; t < animFrameCount; ++t) {
            traverseNodes(gltf, gltfArrayBuffers, mathUtils.identityMatrix(), animatedNodes, d * t, (nodeId, globalTransform) => {
                // set to joints data
                if (nodeJointId[nodeId] != undefined) {
                    let ofs = nodeJointId[nodeId] * 16;
                    let jointMatrix = mathUtils.mulMatrices(globalTransform, invBindMatrices.slice(ofs, ofs + 16));
                    let Mat3x4 = new Array();
                    Mat3x4.push(...jointMatrix.slice(0, 3))
                    Mat3x4.push(...jointMatrix.slice(4, 7));
                    Mat3x4.push(...jointMatrix.slice(8, 11));
                    Mat3x4.push(...jointMatrix.slice(12, 15));
                    jointsGlobalMatrices[nodeJointId[nodeId]] = Mat3x4;
                }
            });

            for (let j = 0; j < jointsGlobalMatrices.length; ++j) {
                textureData.push(...jointsGlobalMatrices[j]);
            }
        }
        
        ret.animationTextures[i] = rc.createTexture(rc.TEX_2D).bind()
            .setData(jointsGlobalMatrices.length * 3, animFrameCount, rc.PIXEL_RGBA16F, new Float32Array(textureData))
            .setSampler(rc.FILTER_BILINEAR);
        ret.animationTexturesSize[i] = [jointsGlobalMatrices.length * 3, animFrameCount];
    }

    return ret;
}

function createGeometryFromGLTF(gltf, gltfArrayBuffers) {
    if (!gltf.meshes) {
        error('no meshes in gltf!');
        return null;
    }
    // create buffers
    let typedArrays = new Array(gltf.bufferViews.length);
    let buffers = new Array(gltf.bufferViews.length);
    for (let i = 0; i < gltf.bufferViews.length; ++i) {
        const bufferView = gltf.bufferViews[i];
        typedArrays[i] = new Int8Array(gltfArrayBuffers[bufferView.buffer], bufferView.byteOffset ? bufferView.byteOffset : 0, bufferView.byteLength);
    }
    let bounds = { min : new Array(3), max : new Array(3) };
    let meshes = new Array(gltf.meshes.length);
    for (let i = 0; i < gltf.meshes.length; ++i) {
        meshes[i] = {
            name: gltf.meshes[i].name,
            primitives: new Array(gltf.meshes[i].primitives.length),
        };
        for (let j = 0; j < gltf.meshes[i].primitives.length; ++j) {
            let vertexCount = null;
            let attribs = {};
            let indices = {};
            const primitive = gltf.meshes[i].primitives[j];
            if (!primitive || !primitive.attributes) {
                error('no attributes in primitive!');
            }
            for (const attribName in primitive.attributes) {
                const accessor = gltf.accessors[primitive.attributes[attribName]];
                const bufferByteStride = gltf.bufferViews[accessor.bufferView].byteStride;
                // bounding box
                if (attribName == 'POSITION') {
                    for (let i = 0; i < 3; i++) {
                        bounds.min[i] = bounds.min[i] ? Math.min(bounds.min[i], accessor.min[i]) : accessor.min[i];
                        bounds.max[i] = bounds.max[i] ? Math.max(bounds.max[i], accessor.max[i]) : accessor.max[i];
                    }
                }
                // lazy create buffer
                if (!buffers[accessor.bufferView]) {
                    buffers[accessor.bufferView] = rc.createVertexBuffer().setData(typedArrays[accessor.bufferView]);
                }
                // set attributes
                attribs[convertAttributeName[attribName]] = {
                    buffer: buffers[accessor.bufferView],
                    size: convertAttributeSize[accessor.type],
                    type: accessor.componentType,
                    byteStride: bufferByteStride ? bufferByteStride : 0,
                    byteOffset: accessor.byteOffset ? accessor.byteOffset : 0
                };
                vertexCount = vertexCount ? Math.min(vertexCount, accessor.count) : accessor.count;
            }
            if (primitive.indices) {
                const accessor = gltf.accessors[primitive.indices];
                if (!buffers[accessor.bufferView]) {
                    buffers[accessor.bufferView] = rc.createIndexBuffer().setData(typedArrays[accessor.bufferView]);
                }
                indices = {
                    buffer: buffers[accessor.bufferView],
                    type: accessor.componentType,
                    byteOffset: accessor.byteOffset ? accessor.byteOffset : 0
                };
                vertexCount = accessor.count;
            }
            let primType = gltf.meshes[i].primitives[j].mode ? gltf.meshes[i].primitives[j].mode : rc.PRIM_TRIANGLES;
            meshes[i].primitives[j] = {
                materialId: gltf.meshes[i].primitives[j].material,
                drawcall: rc.createDrawcall(primType, vertexCount).bind().setAttributes(attribs).setIndices(indices).unbind()
            };
        }
    }

    return {
        meshes: meshes,
        bounds: bounds,
        buffers: buffers
    };
}

function traverseNodes(gltf, gltfArrayBuffers, rootTransform, animatedNodes, time, callback) {
    (function calcNodesGlobalTransform(nodeIds, parentTransform) {
        if (!nodeIds) return;
        for (const nodeId of nodeIds) {
            const node = gltf.nodes[nodeId];
            let globalTransform;
            if (animatedNodes && animatedNodes[nodeId]) {
                globalTransform = calcAnimatedNodeTransform(gltf, gltfArrayBuffers, node, animatedNodes[nodeId], time);
                globalTransform = mathUtils.mulMatrices(parentTransform, globalTransform);
            }
            else {
                globalTransform = node.matrix ? node.matrix : mathUtils.calcTransform(node.translation, node.rotation, node.scale);
                globalTransform = mathUtils.mulMatrices(parentTransform, globalTransform);
            }
            callback(nodeId, globalTransform);
            calcNodesGlobalTransform(node.children, globalTransform);
        }
    })(gltf.scenes[gltf.scene].nodes, rootTransform);
}


class GLTFLoader {
    constructor() {
        this.gltf;
        this.path;
        this.arrayBuffers;
        this.rootTransform = mathUtils.identityMatrix();

        this.geometry;
        this.textures = [];
        this.animations = [];

        this.isReady = false;

        this.animationId = 0;
        this.animationTime = 0;
    }

    load(url) {
        this.path = url.slice(0, url.lastIndexOf('/') + 1);
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => {
            const gltf = JSON.parse(xhr.responseText);
            if (!gltf || !gltf.buffers) {
                error('wrong gltf file!');
                return;
            }
            // load buffers first
            let gltfArrayBuffers = new Array(gltf.buffers.length);
            let loadedArrayBuffersCount = 0;
            for (let i = 0; i < gltf.buffers.length; ++i) {
                assetUtils.loadBinaryAsArrayBuffer(this.path + gltf.buffers[i].uri, (arrayBuffer) => {
                    gltfArrayBuffers[i] = arrayBuffer;
                    if (++loadedArrayBuffersCount == gltf.buffers.length) {
                        this.callback(gltf, gltfArrayBuffers);
                    }
                });
            }
        };
        xhr.send();
    }

    callback(gltf, gltfArrayBuffers) {
        this.gltf = gltf;
        this.arrayBuffers = gltfArrayBuffers;
        // geometry
        this.geometry = createGeometryFromGLTF(gltf, gltfArrayBuffers);
        // material textures
        this.textures = new Array(gltf.images.length);
        for (let i = 0; i < gltf.images.length; ++i) {
            // sampler fixed as aniso
            let sRGB = gltf.images[i].uri.slice(0, gltf.images[i].uri.lastIndexOf('.')).endsWith('baseColor');
            this.textures[i] = rc.createTextureFromUrl(this.path + gltf.images[i].uri, rc.FILTER_ANISO, rc.WARP_REPEAT, sRGB);
        }
        // animations
        this.animations = new Array(gltf.animations.length);
        for (let i = 0; i < gltf.animations.length; ++i) {
            this.animations[i] = createAnimationFromGLTF(gltf, gltfArrayBuffers, i);
        }
        
        // set parameters for drawcall
        traverseNodes(this.gltf, this.arrayBuffers, this.rootTransform, null, 0, (nodeId, globalTransform) => {
            const node = this.gltf.nodes[nodeId];
            if (node.mesh != undefined) {
                for (const primitive of this.geometry.meshes[node.mesh].primitives) {
                    
                    let dc = primitive.drawcall;
                    // model matrix
                    dc.parameters.uModel = globalTransform;
                    // material
                    const material = gltf.materials[primitive.materialId];
                    let normalTexId = -1;
                    let emissiveTexId = -1;
                    let baseColorTexId = -1;
                    let metalRoughTexId = -1;
                    // normal
                    if (material.normalTexture) normalTexId = gltf.textures[material.normalTexture.index].source;
                    // emissive
                    if (material.emissiveTexture) emissiveTexId = gltf.textures[material.emissiveTexture.index].source;
                    else dc.parameters.uEmissiveFactor = material.emissiveFactor;
                    // pbr
                    if (material.pbrMetallicRoughness) {
                        let pbrMetalRough = material.pbrMetallicRoughness;
                        // base color
                        if (pbrMetalRough.baseColorTexture) baseColorTexId = gltf.textures[pbrMetalRough.baseColorTexture.index].source;
                        else dc.parameters.uBaseColorFactor = pbrMetalRough.baseColorFactor;
                        // metal rough
                        if (pbrMetalRough.metallicRoughnessTexture) metalRoughTexId = gltf.textures[pbrMetalRough.metallicRoughnessTexture.index].source;
                        else {
                            dc.parameters.uMetallicFactor = pbrMetalRough.metallicFactor;
                            dc.parameters.uRoughnessFactor = pbrMetalRough.roughnessFactor;
                        }
                    }
                    // else if (material.extensions && material.extensions['KHR_materials_pbrSpecularGlossiness']) {
                    //     let pbrSpecGloss = material.extensions['KHR_materials_pbrSpecularGlossiness'];
                    //     const textureId = gltf.textures[pbrSpecGloss.diffuseTexture.index].source;
                    //     dc.parameters.uBaseColorTex = pbrSpecGloss.diffuseTexture ? this.textures[textureId] : null;
                    //     dc.parameters.uNormalTex = textures[material.normalTexture.index];
                    // }
                    else error('material not supported!');

                    if (normalTexId >= 0) {
                        dc.parameters.uNormalTex = this.textures[normalTexId];
                        dc.setFlag('USE_NORMAL_TEX', 1);
                    }
                    if (emissiveTexId >= 0) {
                        dc.parameters.uEmissiveTex = this.textures[emissiveTexId];
                        dc.setFlag('USE_EMISSIVE_TEX', 1);
                    }
                    if (baseColorTexId >= 0) {
                        dc.parameters.uBaseColorTex = this.textures[baseColorTexId];
                        dc.setFlag('USE_BASECOLOR_TEX', 1);
                    }
                    if (metalRoughTexId >= 0) {
                        dc.parameters.uMetalRoughTex = this.textures[metalRoughTexId];
                        dc.setFlag('USE_METALROUGH_TEX', 1);
                    }
                }
            }
        });

        this.isReady = true;
    }

    setRootTransform(transform) {
        this.rootTransform = transform;
    }

    setAnimation(animationTime, animationId = 0) {
        if (!this.isReady) return;
        check(animationId < this.animations.length);
        this.animationTime = animationTime;
        this.animationId = animationId;
    }

    getDrawcallLists(opaqueList, maskedList, translucentList) {
        if (!this.isReady) return;

        let playAnimation = false;
        let playTime = 0;
        let curAnimation = null;

        if (this.animationId < this.animations.length) {
            curAnimation = this.animations[this.animationId];
            playTime = this.animationTime % curAnimation.animationDuration;
            playAnimation = true;
        }

        traverseNodes(this.gltf, this.arrayBuffers, this.rootTransform, playAnimation ? curAnimation.animatedNodes : null, playTime, (nodeId, globalTransform) => {
            const node = this.gltf.nodes[nodeId];
            if (node.mesh != undefined) {
                for (const primitive of this.geometry.meshes[node.mesh].primitives) {
                    
                    let dc = primitive.drawcall;
                    dc.parameters.uModel = globalTransform;

                    // apply animation
                    if (playAnimation && node.skin != undefined) {
                        dc.parameters.uAnimTex = curAnimation.animationTextures[node.skin];
                        dc.parameters.uAnimInfo = [
                            curAnimation.animationTexturesSize[node.skin][0],
                            calcAnimationTextureSamplePosY(
                                curAnimation.animationTexturesSize[node.skin][1],
                                curAnimation.animationDuration, playTime)
                        ];
                    }
                    
                    opaqueList.push(dc);
                }
            }
        });
    }

    destory() {
        // geometry
        for (let mesh of this.geometry.meshes) {
            for (let primitive of mesh) {
                primitive.drawcall.destory();
            }
        }
        for (let buffer of this.geometry.buffers) {
            buffer.destory();
        }
        // animations
        for (let anim of this.animations) {
            for (let tex of anim.animationTextures) {
                tex.destory();
            }
            
        }
        // textures
        for (let tex of this.textures) {
            tex.destory();
        }
    }
}

export { GLTFLoader }

