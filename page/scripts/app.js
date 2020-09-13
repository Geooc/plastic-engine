import { renderContext as rc } from './webgl-context.js'
import { calcPerspectiveProjMatrix, calcLookAtViewMatrix, calcOrbitViewMatrix } from './math-utils.js'
import { loadVertexShaderAndFragmentShader, loadImage, loadGLTF } from './asset-utils.js'

const vertices = [
    // Front face
    -1.0, -1.0, 1.0, 0.0, 0.0,
    1.0, -1.0, 1.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0, 0.0, 1.0,

    // Back face
    -1.0, -1.0, -1.0, 0.0, 0.0,
    -1.0, 1.0, -1.0, 1.0, 0.0,
    1.0, 1.0, -1.0, 1.0, 1.0,
    1.0, -1.0, -1.0, 0.0, 1.0,

    // Top face
    -1.0, 1.0, -1.0, 0.0, 0.0,
    -1.0, 1.0, 1.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, 1.0, -1.0, 0.0, 1.0,

    // Bottom face
    -1.0, -1.0, -1.0, 0.0, 0.0,
    1.0, -1.0, -1.0, 1.0, 0.0,
    1.0, -1.0, 1.0, 1.0, 1.0,
    -1.0, -1.0, 1.0, 0.0, 1.0,

    // Right face
    1.0, -1.0, -1.0, 0.0, 0.0,
    1.0, 1.0, -1.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0, 1.0,
    1.0, -1.0, 1.0, 0.0, 1.0,

    // Left face
    -1.0, -1.0, -1.0, 0.0, 0.0,
    -1.0, -1.0, 1.0, 1.0, 0.0,
    -1.0, 1.0, 1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0, 0.0, 1.0
];

const indices = [
    0, 1, 2, 0, 2, 3,    // front
    4, 5, 6, 4, 6, 7,    // back
    8, 9, 10, 8, 10, 11,   // top
    12, 13, 14, 12, 14, 15,   // bottom
    16, 17, 18, 16, 18, 19,   // right
    20, 21, 22, 20, 22, 23    // left
];

// gltf utils
function createMeshesFromGLTF(gltf, gltfArrayBuffers) {
    if (!gltf.meshes) {
        alert('no meshes in gltf!');
        return null;
    }
    let ret = new Array(gltf.meshes.length);
    for (let i = 0; i < gltf.meshes.length; ++i) {
        let mesh = {
            name: gltf.meshes[i].name,
            primitives: new Array(gltf.meshes[i].primitives.length),
        };
        for (let j = 0; j < gltf.meshes[i].primitives.length; ++j) {
            // todo
            let vertexCount = 0;
            let attribsInfo = {};
            mesh.primitives[j] = {
                materialId: gltf.meshes[i].primitives[j].material,
                drawcall: rc.createDrawcall(gltf.meshes[i].primitives[j].mode, vertexCount, attribsInfo)
            };
        }
        
        ret[i] = mesh;
    }

    return ret;
}

function createAnimationsFromGLTF(gltf, gltfArrayBuffers) {
    // todo
}

function createMaterialsFromGLTF(gltf, gltfPath) {
    // todo
}

function drawSceneFromGLTF(gltf, meshes, animations, materials) {
    // todo
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

        const testCmd = {
            parameters : {
                uView: this.viewMat,
                uProj: this.projMat,
                uTestTex: this.testTexture,
            },
            drawcall: this.drawcall
        };

        rc.execRenderPass(this.testPass, function* () {
            yield testCmd;
        });
    }

    init() {
        this.addCameraController(rc.getCanvas());
        // buffer
        this.testVbo = rc.createVertexBuffer(new Float32Array(vertices));
        this.testEbo = rc.createIndexBuffer(new Uint16Array(indices));
        // drawcall
        this.drawcall = rc.createDrawcall(rc.primitiveType.TRIANGLES, 36, {
            aLocalPosition  : { buffer : this.testVbo, size: 3, type : rc.dataType.FLOAT, byteStride : 20, byteOffset : 0 },
            aUV             : { buffer : this.testVbo, size: 2, type : rc.dataType.FLOAT, byteStride : 20, byteOffset : 12},
            indices         : { buffer : this.testEbo, type : rc.dataType.USHORT }
        });
        // renderpass
        loadVertexShaderAndFragmentShader('@shaders/test_vs.glsl', '@shaders/test_fs.glsl', (vsSrc, fsSrc) => {
            this.testPass = rc.createRenderPass('test', vsSrc, fsSrc);
        });
        // texture
        loadImage('@images/test.jpg', (img) => { this.testTexture = rc.createTextureRGBA8(img, rc.filterType.ANISOTROPIC); });
        // gltf
        loadGLTF('@scene/scene.gltf', (gltf, gltfArrayBuffers) => {
            // todo
            console.log(gltf);
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