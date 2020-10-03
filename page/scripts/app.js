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
    VEC4    : 4
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
    for (const mesh in geometry.meshes) {
        for (const primitive in mesh) {
            rc.destoryDrawcall(primitive.drawcall);
        }
    }
    for (const buffer in geometry.buffers) {
        rc.destoryBuffer(buffer);
    }
}

function getFloatArrayBufferView(gltf, ArrayBuffers, accessor) {
    let bufferView = gltf.bufferViews[accessor.bufferView];
    if (accessor.componentType != rc.dataType.FLOAT) alert('only support FLOAT type animation value!');
    let accessorOfs = accessor.byteOffset ? accessor.byteOffset : 0;
    let ofs = (bufferView.byteOffset ? bufferView.byteOffset : 0) + accessorOfs;
    let length = (bufferView.byteLength - accessorOfs) / 4;
    return new Float32Array(ArrayBuffers[bufferView.buffer], ofs, length);
}

function calcInterpolation(gltf, gltfArrayBuffers, sampler, time) {
    let keysAccessor = gltf.accessors[sampler.input];
    let valuesAccessor = gltf.accessors[sampler.output];
    if (keysAccessor.type != 'SCALAR') alert('wrong key accessor!');
    let keys = getFloatArrayBufferView(gltf, gltfArrayBuffers, keysAccessor);
    let values = getFloatArrayBufferView(gltf, gltfArrayBuffers, valuesAccessor);
    
    let k = 1;
    let index = values.length - 1;
    for (let i = 0; i < keys.length; ++i) {// O(n), but it's ok
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

function calcJointLocalTransform(gltf, gltfArrayBuffers, node, animatedJoint, time) {
    // init as node's local transform
    let trans = node.translation ? node.translation : [0, 0, 0];
    let rot = node.rotation ? node.rotation : [0, 0, 0, 1];
    let scale = node.scale ? node.scale : [1, 1, 1];

    if (animatedJoint.translation) {
        if (animatedJoint.translation.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        trans = calcInterpolation(gltf, gltfArrayBuffers, animatedJoint.translation, time);
    }
    if (animatedJoint.rotation) {
        if (animatedJoint.rotation.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        rot = calcInterpolation(gltf, gltfArrayBuffers, animatedJoint.rotation, time);
    }
    if (animatedJoint.scale) {
        if (animatedJoint.scale.interpolation != 'LINEAR') alert('only support LINEAR interpolation for now!');
        scale = calcInterpolation(gltf, gltfArrayBuffers, animatedJoint.scale, time);
    }
    return mathUtils.calcTransform(trans, rot, scale);
}

function calcAnimationTextureSamplePosY(animFrameCount, animationDuration, time) {
    return (time / animationDuration) * (animFrameCount - 1) / animFrameCount + 0.5 / animFrameCount;
}

function createAnimationsFromGLTF(gltf, gltfArrayBuffers, animationId = 0) {
    if (!gltf || !gltf.skins || !gltf.animations) return;

    let ret = {
        animationTextures : new Array(gltf.skins.length),
        animationDurations : new Array(gltf.skins.length),
        animationTexturesSize : new Array(gltf.skins.length)
    };
    for (let i = 0; i < gltf.skins.length; ++i) {// for each skin bind
        let animationDuration = 0;
        let animatedJoints = {};
        let animation = gltf.animations[animationId];
        for (let j = 0; j < gltf.skins[i].joints.length; ++j) {// record joint id
            animatedJoints[gltf.skins[i].joints[j]] = { jointId : j };
        }
        for (let j = 0; j < animation.channels.length; ++j) {// store the sampler and get duration
            let channel = animation.channels[j];
            let sampler = animation.samplers[channel.sampler];
            animatedJoints[channel.target.node][channel.target.path] = sampler;
            animationDuration = Math.max(animationDuration, gltf.accessors[sampler.input].max);
        }
        // get inverse bind matrices
        let invBindMatricesAccessor = gltf.accessors[gltf.skins[i].inverseBindMatrices];
        let invBindMatrices = getFloatArrayBufferView(gltf, gltfArrayBuffers, invBindMatricesAccessor);
        // gen texture
        let JointsGlobalMatrices = new Array(animatedJoints.length);
        function updateAnimation(time) {
            (function calcAnimatedJointsGlobalTransform(nodeIds, parentTransform) {
                if (!nodeIds) return;
                for (const nodeId of nodeIds) {
                    const node = gltf.nodes[nodeId];
                    let globalTransform;
                    if (animatedJoints[nodeId]) {
                        let jointId = animatedJoints[nodeId].jointId;
                        // calc animted joint local transform
                        globalTransform = calcJointLocalTransform(gltf, gltfArrayBuffers, node, animatedJoints[nodeId], time);
                        globalTransform = mathUtils.mulMatrices(parentTransform, globalTransform);
                        // set to texture data
                        let ofs = jointId * 16;
                        let jointMatrix = mathUtils.mulMatrices(globalTransform, invBindMatrices.slice(ofs, ofs + 16));
                        let Mat3x4 = new Array();
                        Mat3x4.push(...jointMatrix.slice(0, 3))
                        Mat3x4.push(...jointMatrix.slice(4, 7));
                        Mat3x4.push(...jointMatrix.slice(8, 11));
                        Mat3x4.push(...jointMatrix.slice(12, 15));
                        JointsGlobalMatrices[jointId] = Mat3x4;
                    }
                    else {
                        globalTransform = node.matrix ? node.matrix : mathUtils.calcTransform(node.translation, node.rotation, node.scale);
                        globalTransform = mathUtils.mulMatrices(parentTransform, globalTransform);
                    }
                    calcAnimatedJointsGlobalTransform(node.children, globalTransform);
                }
            })(gltf.scenes[gltf.scene].nodes, mathUtils.identityMatrix());
        }
        let textureRowData = new Array();
        let animFrameCount = Math.floor(animationDuration * 24);// about 24 frames per second
        let d = animationDuration / (animFrameCount - 1);
        for (let t = 0; t < animFrameCount; ++t) {
            updateAnimation(d * t);
            for (let j = 0; j < JointsGlobalMatrices.length; ++j) {
                textureRowData.push(...JointsGlobalMatrices[j]);
            }
        }
        ret.animationTextures[i] = rc.createTextureFromData(new Float32Array(textureRowData), rc.textureFormat.RGBA16F, JointsGlobalMatrices.length * 3, animFrameCount, rc.filterType.BILINEAR);
        ret.animationTexturesSize[i] = [JointsGlobalMatrices.length * 3, animFrameCount];
        ret.animationDurations[i] = animationDuration;
    }

    return ret;
}

function destoryAnimation(animation) {
    for (const tex of animation.animationTextures) {
        rc.destoryTexture(tex);
    }
}

function createMaterialsFromGLTF(gltf, gltfPath) {
    // todo
}

function drawGLTF(gltf, geometry, animation, viewInfo, renderPass, time) {
    //console.log('tick')
    if (!gltf || !geometry || !viewInfo || !renderPass) return;
    rc.clearColorAndDepth();

    let opaqueCmdList = new Array();
    opaqueCmdList.push({
        parameters: {
            uView: viewInfo.viewMat,
            uProj: viewInfo.projMat,
        }
    });
    //let maskedCmdList = new Array();
    //let translucentCmdList = new Array();
    (function drawNodes(nodeIds, parentTransform) {
        if (!nodeIds) return;
        for (const nodeId of nodeIds) {
            const node = gltf.nodes[nodeId];
            let transform = node.matrix ? node.matrix : mathUtils.calcTransform(node.translation, node.rotation, node.scale);
            transform = mathUtils.mulMatrices(parentTransform, transform);
            if (node.mesh != undefined) {
                for (const primitive of geometry.meshes[node.mesh].primitives) {
                    opaqueCmdList.push({
                        parameters: {
                            uModel: transform,
                            uAnimTex: animation.animationTextures[node.skin],
                            uAnimInfo: [
                                animation.animationTexturesSize[node.skin][0],
                                calcAnimationTextureSamplePosY(
                                    animation.animationTexturesSize[node.skin][1],
                                    animation.animationDurations[node.skin],
                                    time % animation.animationDurations[node.skin]
                                )
                            ]
                        },
                        drawcall: primitive.drawcall
                    });
                }
            }
            drawNodes(node.children, transform);
        }
    })(gltf.scenes[gltf.scene].nodes, mathUtils.identityMatrix());

    rc.execRenderPass(renderPass, opaqueCmdList);
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

        this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, 1, 0.1, 1000);
        this.viewMat = mathUtils.calcLookAtViewMatrix([-1, 0, 2], [0, 0, 0], [0, 1, 0]);
    }

    _recordStart(x, y) {
        this.startX = x;
        this.startY = y;
        this.recordPitch = this.pitch;
        this.recordYaw = this.yaw;
    }

    _handleRot(x, y) {
        let deltaX = (x - this.startX) * this.cameraRotSpeed;
        let deltaY = (y - this.startY) * this.cameraRotSpeed;
        this.targetPitch = this.recordPitch + deltaX;
        this.targetYaw = Math.max(Math.min(this.recordYaw + deltaY, 75), -75);
    }

    _handleMove(x, y) {
        // todo
    }

    _handleScale(scale) {
        this.targetRadius = Math.max(this.targetRadius + scale * this.cameraScaleSpeed, 2);
    }

    addCameraController(canvas) {
        canvas.onmousedown = (e) => {
            e.preventDefault();
            this._recordStart(e.clientX, e.clientY);
            canvas.onmousemove = (e) => {
                e.preventDefault();
                this._handleRot(e.clientX, e.clientY);
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
        this.viewMat = mathUtils.calcOrbitViewMatrix(this.pitch, this.yaw, this.radius, this.at);
    }

    _resize(width, height) {
        this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, width / height, 0.1, 1000);
        rc.setViewport(0, 0, width, height);
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
        assetUtils.loadVertexShaderAndFragmentShader('@shaders/test_vs.glsl', '@shaders/test_fs.glsl', (vsSrc, fsSrc) => {
            this.testPass = rc.createRenderPass('test', vsSrc, fsSrc);
        });
        // texture
        assetUtils.loadImage('@images/test.jpg', (img) => { this.testTexture = rc.createTextureFromImage(img, rc.filterType.ANISOTROPIC); });
        // gltf
        assetUtils.loadGLTF('@scene/scene.gltf', (gltf, gltfArrayBuffers) => {
            this.gltf = gltf;
            this.geometry = createGeometryFromGLTF(gltf, gltfArrayBuffers);
            this.animation = createAnimationsFromGLTF(gltf, gltfArrayBuffers, 0);
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
                this.cameraScaleSpeed = this.targetRadius / 100;
            }
        });
    }

    tick(now) {
        this.updateTime(now);
        this.updateView();
        this.checkSize(rc.getCanvas());

        let viewInfo = {
            viewMat : this.viewMat,
            projMat : this.projMat,
            testTexture : this.testTexture
        };
        drawGLTF(this.gltf, this.geometry, this.animation, viewInfo, this.testPass, this.frame);
    }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)