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

function createAnimationsFromGLTF(gltf, gltfArrayBuffers) {
    if (!gltf || !gltf.skins || !gltf.animations) return;
    // todo
}

function createMaterialsFromGLTF(gltf, gltfPath) {
    // todo
}

function drawGLTF(gltf, geometry, viewInfo, renderPass) {
    if (!gltf || !geometry || !viewInfo || !renderPass) return;
    rc.clearColorAndDepth();

    let opaqueCmdList = new Array();
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
                            uView: viewInfo.viewMat,
                            uProj: viewInfo.projMat,
                            uTestTex: viewInfo.testTexture
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
        assetUtils.loadImage('@images/test.jpg', (img) => { this.testTexture = rc.createTextureRGBA8(img, rc.filterType.ANISOTROPIC); });
        // gltf
        assetUtils.loadGLTF('@scene/scene.gltf', (gltf, gltfArrayBuffers) => {
            this.gltf = gltf;
            this.geometry = createGeometryFromGLTF(gltf, gltfArrayBuffers);
            this.animations = createAnimationsFromGLTF(gltf, gltfArrayBuffers);
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
        drawGLTF(this.gltf, this.geometry, viewInfo, this.testPass);
    }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)