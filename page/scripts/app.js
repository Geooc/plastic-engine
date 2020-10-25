import { renderContext as rc } from './render-context.js'
import { mathUtils } from './math-utils.js'
import { assetUtils } from './asset-utils.js'

const convertAttributeName = {
    POSITION    : 'aLocalPosition',
    NORMAL      : 'aWorldNormal',
    TANGENT     : 'aWorldTangent',
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
function createGeometryFromGLTF(gltf, gltfArrayBuffers) {
    if (!gltf.meshes) {
        alert('no meshes in gltf!');
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
            let attribsInfo = {};
            const primitive = gltf.meshes[i].primitives[j];
            if (!primitive || !primitive.attributes) {
                alert('no attributes in primitive!');
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
                    buffers[accessor.bufferView] = rc.createVertexBuffer(typedArrays[accessor.bufferView]);
                }
                // set attribute info
                attribsInfo[convertAttributeName[attribName]] = {
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
                    buffers[accessor.bufferView] = rc.createIndexBuffer(typedArrays[accessor.bufferView]);
                }
                attribsInfo['indices'] = {
                    buffer: buffers[accessor.bufferView],
                    type: accessor.componentType,
                    byteOffset: accessor.byteOffset ? accessor.byteOffset : 0
                };
                vertexCount = accessor.count;
            }
            meshes[i].primitives[j] = {
                materialId: gltf.meshes[i].primitives[j].material,
                drawcall: rc.createDrawcall(gltf.meshes[i].primitives[j].mode ? gltf.meshes[i].primitives[j].mode : rc.primitiveType.TRIANGLES, vertexCount, attribsInfo),
            };
        }
    }

    return {
        meshes: meshes,
        bounds: bounds,
        buffers: buffers
    };
}

function destoryGeometry(geometry) {
    for (const mesh of geometry.meshes) {
        for (const primitive of mesh) {
            rc.destoryDrawcall(primitive.drawcall);
        }
    }
    for (const buffer of geometry.buffers) {
        rc.destoryBuffer(buffer);
    }
}

function getFloatArrayBufferView(gltf, ArrayBuffers, accessor) {
    let bufferView = gltf.bufferViews[accessor.bufferView];
    if (accessor.componentType != rc.dataType.FLOAT) alert('must be FLOAT component type!');
    let accessorOfs = accessor.byteOffset ? accessor.byteOffset : 0;
    let ofs = (bufferView.byteOffset ? bufferView.byteOffset : 0) + accessorOfs;
    let length = convertAttributeSize[accessor.type] * accessor.count;
    if (!length) alert('wrong accessor count!');
    return new Float32Array(ArrayBuffers[bufferView.buffer], ofs, length);
}

function calcInterpolation(gltf, gltfArrayBuffers, sampler, time) {
    let keysAccessor = gltf.accessors[sampler.input];
    let valuesAccessor = gltf.accessors[sampler.output];
    if (keysAccessor.type != 'SCALAR') alert('wrong key accessor!');
    let keys = getFloatArrayBufferView(gltf, gltfArrayBuffers, keysAccessor);
    let values = getFloatArrayBufferView(gltf, gltfArrayBuffers, valuesAccessor);
    
    let k = 1;
    let index = keys.length - 1;
    for (let i = 0; i < keys.length; ++i) {// fixme: O(n), can be faster
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
        if (animatedNode.translation.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        trans = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.translation, time);
    }
    if (animatedNode.rotation) {
        if (animatedNode.rotation.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        rot = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.rotation, time);
    }
    if (animatedNode.scale) {
        if (animatedNode.scale.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        scale = calcInterpolation(gltf, gltfArrayBuffers, animatedNode.scale, time);
    }
    return mathUtils.calcTransform(trans, rot, scale);
}

function calcAnimationTextureSamplePosY(animFrameCount, animationDuration, time) {
    return (time / animationDuration) * (animFrameCount - 1) / animFrameCount + 0.5 / animFrameCount;
}

function traverseNodes(gltf, gltfArrayBuffers, animatedNodes, time, callback) {
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
    })(gltf.scenes[gltf.scene].nodes, mathUtils.identityMatrix());
}

function createAnimationsFromGLTF(gltf, gltfArrayBuffers, animationId = 0) {
    if (!gltf || !gltf.skins || !gltf.animations) return;

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
            traverseNodes(gltf, gltfArrayBuffers, animatedNodes, d * t, (nodeId, globalTransform) => {
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
        
        ret.animationTextures[i] = rc.createTextureFromData(new Float32Array(textureData), rc.textureFormat.RGBA16F, jointsGlobalMatrices.length * 3, animFrameCount, rc.filterType.BILINEAR);
        ret.animationTexturesSize[i] = [jointsGlobalMatrices.length * 3, animFrameCount];
    }

    return ret;
}

function destoryAnimation(animation) {
    for (const tex of animation.animationTextures) {
        rc.destoryTexture(tex);
    }
}

function getMaterialParametersFromGLTF(gltf, textures, materialId) {
    // todo: we can create material parameters info while loading gltf
    if (!gltf || !textures) return null;
    let material = gltf.materials[materialId];

    let ret = {
        uBaseColorTex: null,
        uNormalTex: null,
    };

    if (material.extensions) {
        if (material.extensions['KHR_materials_pbrSpecularGlossiness']) {
            let pbrSpecGloss = material.extensions['KHR_materials_pbrSpecularGlossiness'];
            ret.uBaseColorTex = pbrSpecGloss.diffuseTexture ? textures[pbrSpecGloss.diffuseTexture.index] : null;
            //ret.uNormalTex = textures[material.normalTexture.index];
        }
    }
    else if (material.pbrMetallicRoughness) {
        let pbrMetalRough = material.pbrMetallicRoughness;
        ret.uBaseColorTex = pbrMetalRough.baseColorTexture ? textures[material.pbrMetallicRoughness.baseColorTexture.index] : null;
        //ret.uNormalTex = textures[material.normalTexture.index];
    }
    else alert('this material not supported!');

    return ret;
}

function drawGLTF(gltf, gltfArrayBuffers, geometry, textures, animation, viewInfo, renderPass, time) {
    if (!gltf || !geometry || !viewInfo || !renderPass) return false;

    let opaqueCmdList = new Array();
    opaqueCmdList.push({
        parameters: {
            uView: viewInfo.viewMat,
            uProj: viewInfo.projMat,
        }
    });
    let playTime = animation ? time % animation.animationDuration : 0;

    traverseNodes(gltf, gltfArrayBuffers, animation ? animation.animatedNodes : null, playTime, (nodeId, globalTransform) => {
        const node = gltf.nodes[nodeId];
        if (node.mesh != undefined) {
            for (const primitive of geometry.meshes[node.mesh].primitives) {
                let parameters = {
                    uModel: globalTransform
                }
                if (animation) {
                    Object.assign(parameters, {
                        uAnimTex: node.skin != undefined ? animation.animationTextures[node.skin] : null,
                        uAnimInfo: node.skin != undefined ? [
                            animation.animationTexturesSize[node.skin][0],
                            calcAnimationTextureSamplePosY(
                                animation.animationTexturesSize[node.skin][1],
                                animation.animationDuration, playTime
                            )
                        ] : [0 , 0]
                    });
                }
                Object.assign(parameters, getMaterialParametersFromGLTF(gltf, textures, primitive.materialId));
                // push cmd
                opaqueCmdList.push({
                    parameters: parameters,
                    drawcall: primitive.drawcall
                });
            }
        }
    });

    rc.execRenderPass(renderPass, opaqueCmdList);
    return true;
}

// IBL
function createIBL(hdriTexture) {
    const res = 1024;
    let ret = {
        specCubemap : rc.createCubemapFromData(null, rc.textureFormat.R11G11B10, res, res),
        diffCubemap : rc.createCubemapFromData(null, rc.textureFormat.R11G11B10, res, res),
        isReady : false
    };

    assetUtils.loadVertexShaderAndFragmentShader('@shaders/env_cubemap_vs.glsl', '@shaders/env_cubemap_fs.glsl', (vsSrc, fsSrc) => {
        let envCubemapRenderPass = rc.createRenderPass('env cubemap', vsSrc, fsSrc);
        let vbo = rc.createVertexBuffer(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]));
        let drawcall = rc.createDrawcall(rc.primitiveType.TRIANGLE_STRIP, 4, {
            aPos: { buffer: vbo, size: 2, type: rc.dataType.FLOAT }
        })
        const projMat = mathUtils.calcPerspectiveProjMatrix(90, 1, 1, 10);
        let invViewProjMats = new Array(6);
        invViewProjMats[0] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [1, 0, 0], [0, -1, 0])));
        invViewProjMats[1] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [-1, 0, 0], [0, -1, 0])));
        invViewProjMats[2] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 1, 0], [0, 0, 1])));
        invViewProjMats[3] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, -1, 0], [0, 0, -1])));
        invViewProjMats[4] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, 1], [0, -1, 0])));
        invViewProjMats[5] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, -1], [0, -1, 0])));

        rc.setViewport(0, 0, res, res);
        for (let i = 0; i < 6; ++i) {
            rc.updateRenderTarget(envCubemapRenderPass, {
                color0: { texture: ret.specCubemap, face: i }
            });
            rc.clearColorAndDepth();
            rc.execRenderPass(envCubemapRenderPass, [{
                drawcall: drawcall,
                parameters: {
                    uInvViewProj: invViewProjMats[i],
                    uHDRI: hdriTexture
                }
            }]);
        }
        rc.autoGenCubemapMipmaps(ret.specCubemap);
        ret.isReady = true;

        rc.destoryTexture(hdriTexture);
        rc.destoryRenderPass(envCubemapRenderPass);
        rc.destoryDrawcall(drawcall);
        rc.destoryBuffer(vbo);
    });

    return ret;
}

class App {
    constructor() {
        this.frame = 0;
        this.delta = 0;
        this._lastFrame = 0;

        // camera parameters
        this.fovy = 70;
        this.pitch = 0;
        this.yaw = 0;
        this.radius = 5;
        this.at = [0, 0, 0];
        this.cameraScaleSpeed = 0.01;
        this.cameraRotSpeed = 0.5;
        this.cameraSmooth = 10.0;
        this.targetPitch = this.pitch;
        this.targetYaw = this.yaw;
        this.targetRadius = this.radius;
        this.targetAt = this.at;

        this.width = 1;
        this.height = 1;
        this.near = 0.1;
        this.far = 10000;

        this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, this.width/this.height, this.near, this.far);
        this.viewMat = mathUtils.calcOrbitViewMatrix(this.pitch, this.yaw, this.radius, this.at);
    }

    _recordStart(x, y) {
        this.startX = x;
        this.startY = y;
        this.recordPitch = this.pitch;
        this.recordYaw = this.yaw;
        this.recordAt = this.at;
    }

    _handleRot(x, y) {
        let deltaX = (x - this.startX) * this.cameraRotSpeed;
        let deltaY = (y - this.startY) * this.cameraRotSpeed;
        this.targetPitch = this.recordPitch + deltaX;
        this.targetYaw = Math.max(Math.min(this.recordYaw + deltaY, 75), -75);
    }

    _handleMove(x, y) {
        let deltaX = (this.startX - x) * this.cameraScaleSpeed;
        let deltaY = (y - this.startY) * this.cameraScaleSpeed;
        let RightAndUp = mathUtils.calcOrbitViewRightAndUp(this.pitch, this.yaw);
        this.targetAt = mathUtils.addVector(this.recordAt, mathUtils.scaleVector(RightAndUp[0], deltaX));
        this.targetAt = mathUtils.addVector(this.targetAt, mathUtils.scaleVector(RightAndUp[1], deltaY));
    }

    _handleScale(scale) {
        this.targetRadius = Math.max(this.targetRadius + scale * this.cameraScaleSpeed, 2);
    }

    // todo: needs refactor
    addCameraController(canvas) {
        canvas.onmousedown = (e) => {
            e.preventDefault();
            this._recordStart(e.clientX, e.clientY);
            if (e.buttons == 1) {
                canvas.onmousemove = (e) => {
                    e.preventDefault();
                    this._handleRot(e.clientX, e.clientY);
                }
            }
            else if (e.buttons == 4) {
                canvas.onmousemove = (e) => {
                    e.preventDefault();
                    this._handleMove(e.clientX, e.clientY);
                }
            }
            canvas.onmouseup = (e) => {
                canvas.onmousemove = null;
            }
        }
        canvas.onwheel = (e) => {
            e.preventDefault();
            this._handleScale(e.deltaY);
        }
        // for touch screen
        // todo: use HAMMER.JS
        canvas.addEventListener('touchstart', (e) => {
            if (e.targetTouches.length != 1) return;
            e.preventDefault();
            this._recordStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
            canvas.addEventListener('touchmove', (e) => {
                if (e.targetTouches.length == 1) {
                    e.preventDefault();
                    this._handleRot(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
                }
                else if (e.targetTouches.length == 2) {
                    // todo
                }
            });
            canvas.addEventListener('touchend', (e) => {
                if (e.targetTouches.length == 1)
                    canvas.addEventListener('touchmove', null);
            });
        })//
    }

    updateTime(now) {
        this.delta = (now - this._lastFrame) * 0.001;
        this.frame = now * 0.001;
        this._lastFrame = now;
    }

    updateView() {
        let amount = this.cameraSmooth * this.delta;
        this.pitch += (this.targetPitch - this.pitch) * amount;
        this.yaw += (this.targetYaw - this.yaw) * amount;
        this.radius += (this.targetRadius - this.radius) * amount;
        this.at = mathUtils.addVector(mathUtils.scaleVector(mathUtils.subVector(this.targetAt, this.at), amount), this.at);
        this.viewMat = mathUtils.calcOrbitViewMatrix(this.pitch, this.yaw, this.radius, this.at);
    }

    _resize(width, height) {
        this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, width / height, this.near, this.far);
        rc.setViewport(0, 0, width, height);
        this.width = width;
        this.height = height;

        rc.destoryTexture(this.sceneColor);
        rc.destoryTexture(this.depth);
        this.sceneColor = rc.createTextureFromData(null, rc.textureFormat.R11G11B10, width, height, rc.filterType.POINT);
        this.depth = rc.createDepthTexture(width, height);
        // if (this.testPass) rc.updateRenderPass(this.testPass, {
        //     color0  : { texture: this.sceneColor },
        //     depth   : { texture: this.depth }
        // });
    }

    checkSize(canvas) {
        let displayWidth = Math.floor(canvas.clientWidth * window.devicePixelRatio);
        let displayHeight = Math.floor(canvas.clientHeight * window.devicePixelRatio);
        if (canvas.width != displayWidth || canvas.height != displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            this._resize(canvas.width, canvas.height);
        }
    }

    init() {
        this.addCameraController(rc.getCanvas());
        // renderpass
        this.sceneColor = rc.createTextureFromData(null, rc.textureFormat.R11G11B10, this.width, this.height);
        this.depth = rc.createDepthTexture(this.width, this.height);
        assetUtils.loadVertexShaderAndFragmentShader('@shaders/test_vs.glsl', '@shaders/test_fs.glsl', (vsSrc, fsSrc) => {
            this.testPass = rc.createRenderPass('test', vsSrc, fsSrc);
        });
        // texture
        assetUtils.loadImage('@images/test.jpg', (img) => {
            this.testTexture = rc.createTextureFromImage(img, rc.filterType.ANISOTROPIC, rc.warpType.REPEAT);
            this.testTextureSize = [ img.width, img.height ];
        });
        // gltf
        const gltfPath = '@scene/scene.gltf';
        assetUtils.loadGLTF(gltfPath, (gltf, gltfArrayBuffers) => {
            this.gltf = gltf;
            this.geometry = createGeometryFromGLTF(gltf, gltfArrayBuffers);
            this.animation = createAnimationsFromGLTF(gltf, gltfArrayBuffers, 0);
            this.gltfArrayBuffers = gltfArrayBuffers;
            // material textures
            this.textures = new Array(gltf.textures.length);
            let imageBindings = {};
            for (let i = 0; i < gltf.textures.length; ++i) {
                if (!imageBindings[gltf.textures[i].source]) imageBindings[gltf.textures[i].source] = new Array();
                imageBindings[gltf.textures[i].source].push(i);
            }
            const imgPath = gltfPath.slice(0, gltfPath.lastIndexOf('/') + 1);
            for (let i = 0; i < gltf.images.length; ++i) {
                assetUtils.loadImage(imgPath + gltf.images[i].uri, (img) => {
                    let sRGB = gltf.images[i].uri.slice(0, gltf.images[i].uri.lastIndexOf('.')).endsWith('baseColor');
                    for (let j = 0; j < imageBindings[i].length; ++j) {
                        this.textures[imageBindings[i][j]] = rc.createTextureFromImage(img, rc.filterType.ANISOTROPIC, rc.warpType.REPEAT, sRGB);
                    }
                });
            }
            // todo: better camera pos
            if (this.geometry.bounds) {
                this.at = [
                    (this.geometry.bounds.max[0] + this.geometry.bounds.min[0]) / 2,
                    (this.geometry.bounds.max[1] + this.geometry.bounds.min[1]) / 2,
                    (this.geometry.bounds.max[2] + this.geometry.bounds.min[2]) / 2,
                ];
                this.targetRadius = Math.max(
                    this.geometry.bounds.max[0] - this.geometry.bounds.min[0],
                    Math.max(
                        this.geometry.bounds.max[1] - this.geometry.bounds.min[1],
                        this.geometry.bounds.max[2] - this.geometry.bounds.min[2],
                    )
                );
                this.cameraScaleSpeed = this.targetRadius / 1000;
            }
        });
        // hdri
        assetUtils.loadHDRImage('@images/pedestrian_overpass_1k.hdr', (hdri) => {
            let hdriTexture = rc.createTextureFromData(hdri.data, rc.textureFormat.R11G11B10, hdri.width, hdri.height, rc.filterType.BILINEAR);
            this.IBL = createIBL(hdriTexture);
        });
        // post process
        assetUtils.readText('@shaders/testpp_fs.glsl', (fsSrc) => {
            this.testPostProcess0 = rc.createPostProcess('test pp', fsSrc);
        });
    }

    tick(now) {
        this.updateTime(now);
        this.updateView();
        this.checkSize(rc.getCanvas());
        rc.setViewport(0,0,this.width,this.height);

        let viewInfo = {
            viewMat : this.viewMat,
            projMat : this.projMat,
            testTexture : this.testTexture
        };
        if (drawGLTF(this.gltf, this.gltfArrayBuffers, this.geometry, this.textures, this.animation, viewInfo, this.testPass, this.frame))
        {}

        if (this.testPostProcess0 && this.IBL && this.IBL.isReady) {
            rc.execPostProcess(this.testPostProcess0, {
                uInvViewProj: mathUtils.invMatrix(mathUtils.mulMatrices(this.projMat, this.viewMat)),
                uCubemap: this.IBL.specCubemap,
                uScreenSize: [this.width, this.height],
                uSceneColor: this.testTexture,
                uSize: this.testTextureSize
            });
        }
    }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)