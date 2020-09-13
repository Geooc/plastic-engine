import { renderContext as rc } from './render-context.js'
import { calcPerspectiveProjMatrix, calcLookAtViewMatrix, calcOrbitViewMatrix } from './math-utils.js'
import { loadVertexShaderAndFragmentShader, loadImage, loadGLTF } from './asset-utils.js'

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
function createMeshesFromGLTF(gltf, gltfArrayBuffers) {
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
        // if (bufferView.target) {
        //     buffers[i] = rc.createBuffer(bufferView.target, typedArrays[i]);
        // }
    }
    let boundingMin = [null, null, null];
    let boundingMax = [null, null, null];
    let meshes = new Array(gltf.meshes.length);
    for (let i = 0; i < gltf.meshes.length; ++i) {
        let mesh = {
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
                        boundingMin[i] = boundingMin[i] ? Math.min(boundingMin[i], accessor.min[i]) : accessor.min[i];
                        boundingMax[i] = boundingMax[i] ? Math.max(boundingMax[i], accessor.max[i]) : accessor.max[i];
                    }
                }
                // lazy create buffer
                if (!buffers[accessor.bufferView]) {
                    buffers[accessor.bufferView] = rc.createBuffer(rc.bufferType.VERTEX, typedArrays[accessor.bufferView]);
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
                    buffers[accessor.bufferView] = rc.createBuffer(rc.bufferType.INDEX, typedArrays[accessor.bufferView]);
                }
                attribsInfo['indices'] = {
                    buffer: buffers[accessor.bufferView],
                    type: accessor.componentType,
                    byteOffset: accessor.byteOffset ? accessor.byteOffset : 0
                };
                vertexCount = accessor.count;
            }
            mesh.primitives[j] = {
                materialId: gltf.meshes[i].primitives[j].material,
                drawcall: rc.createDrawcall(gltf.meshes[i].primitives[j].mode ? gltf.meshes[i].primitives[j].mode : rc.primitiveType.TRIANGLES, vertexCount, attribsInfo),
            };
        }
        meshes[i] = mesh;
    }

    return {
        meshes: meshes,
        boundingMin: boundingMin,
        boundingMax: boundingMax,
        buffers: buffers
    };
}

function destoryMeshes(meshes) {
    for (const mesh in meshes.meshes) {
        for (const primitive in mesh) {
            rc.destoryDrawcall(primitive.drawcall);
        }
    }
    for (const buffer in meshes.buffers) {
        rc.destoryBuffer(buffer);
    }
}

function createAnimationsFromGLTF(gltf, gltfArrayBuffers) {
    // todo
}

function createMaterialsFromGLTF(gltf, gltfPath) {
    // todo
}

function createSceneGraph(gltf) {
    let root = {
        name: gltf.scenes[gltf.scene].name,
        children: gltf.scenes[gltf.scene].nodes
    };
    for (let i = 0; i < gltf.nodes.length; ++i) {
        //
    }
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

        this.projMat = calcPerspectiveProjMatrix(this.fovy, 1, 0.1, 1000);
        this.viewMat = calcLookAtViewMatrix([-1, 0, 2], [0, 0, 0], [0, 1, 0]);
    }

    _recordStart(x, y) {
        this.startX = x;
        this.startY = y;
        this.recordPitch = this.pitch;
        this.recordYaw = this.yaw;
    }

    _handleMove(x, y) {
        let deltaX = (x - this.startX) * this.cameraRotSpeed;
        let deltaY = (y - this.startY) * this.cameraRotSpeed;
        this.targetPitch = this.recordPitch + deltaX;
        this.targetYaw = Math.max(Math.min(this.recordYaw + deltaY, 75), -75);
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
                this._handleMove(e.clientX, e.clientY);
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
                    this._handleMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
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
        this.viewMat = calcOrbitViewMatrix(this.pitch, this.yaw, this.radius, this.at);
    }

    _resize(width, height) {
        this.projMat = calcPerspectiveProjMatrix(this.fovy, width / height, 0.1, 1000);
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

    drawScene() {
        rc.clearColorAndDepth();

        const testParams = {
            uView: this.viewMat,
            uProj: this.projMat,
            uTestTex: this.testTexture
        };

        const meshes = this.meshes ? this.meshes.meshes : null;
        rc.execRenderPass(this.testPass, function* () {
            for (const meshId in meshes) {
                for (const primitiveId in meshes[meshId].primitives) {
                    yield {
                        parameters: testParams,
                        drawcall: meshes[meshId].primitives[primitiveId].drawcall
                    };
                }
            }
        });
    }

    init() {
        this.addCameraController(rc.getCanvas());
        // renderpass
        loadVertexShaderAndFragmentShader('@shaders/test_vs.glsl', '@shaders/test_fs.glsl', (vsSrc, fsSrc) => {
            this.testPass = rc.createRenderPass('test', vsSrc, fsSrc);
        });
        // texture
        loadImage('@images/test.jpg', (img) => { this.testTexture = rc.createTextureRGBA8(img, rc.filterType.ANISOTROPIC); });
        // gltf
        loadGLTF('@scene/scene.gltf', (gltf, gltfArrayBuffers) => {
            this.meshes = createMeshesFromGLTF(gltf, gltfArrayBuffers);
            this.at = [
                (this.meshes.boundingMax[0] + this.meshes.boundingMin[0]) / 2,
                (this.meshes.boundingMax[1] + this.meshes.boundingMin[1]) / 2,
                (this.meshes.boundingMax[2] + this.meshes.boundingMin[2]) / 2,
            ];
            this.targetRadius = Math.max(
                this.meshes.boundingMax[0] - this.meshes.boundingMin[0],
                Math.max(
                    this.meshes.boundingMax[1] - this.meshes.boundingMin[1],
                    this.meshes.boundingMax[2] - this.meshes.boundingMin[2],
                )
            ) / 2;
            this.cameraScaleSpeed = this.targetRadius / 100;
            // todo
        });
    }

    tick(now) {
        this.updateTime(now);
        this.updateView();
        this.checkSize(rc.getCanvas());

        this.drawScene();
    }

    // quit() {
    //     rc.destoryBuffer(this.testVbo);
    //     rc.destoryBuffer(this.testEbo);
    //     rc.destoryTexture(this.testTexture);
    //     rc.destoryDrawcall(this.drawcall);
    //     rc.destoryShaderProgram(this.testShader);
    // }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)