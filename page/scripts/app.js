import { WebGLContext } from './webgl-context.js'
import { calcPerspectiveProjMatrix, calcLookAtViewMatrix, calcOrbitViewMatrix } from './math-utils.js'

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

// temporal function
function readTextSync(url) {
    let ret;
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.onload = () => { ret = xhr.responseText; }
    xhr.send();
    return ret;
}

class App {
    constructor() {
        this.frame = 0;
        this.delta = 0;
        this._lastFrame = 0;

        this.glContext = new WebGLContext();

        this.fovy = 70;
        this.projMat = calcPerspectiveProjMatrix(this.fovy, 1, 0.1, 1000);
        this.viewMat = calcLookAtViewMatrix([-1, 0, 2], [0, 0, 0], [0, 1, 0]);
    }

    updateTime(now) {
        this.delta = (now - this._lastFrame) * 0.001;
        this.frame = now * 0.001;
        this._lastFrame = now;
    }

    updateView() {
        let rot = Math.sin(this.frame * 0.25);
        this.viewMat = calcOrbitViewMatrix(rot * 360, rot * 90, 5, [0, 0, 0]);
    }

    _resize(width, height) {
        this.projMat = calcPerspectiveProjMatrix(this.fovy, width / height, 0.1, 1000);
        this.glContext.setViewport(0, 0, width, height);
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
        this.glContext.clearColorAndDepth();
        if (this.testShader) {
            this.glContext.useShaderProgram(this.testShader);
            this.glContext.setUniformM('uView', this.viewMat);
            this.glContext.setUniformM('uProj', this.projMat);
            this.glContext.useVertexBuffer(this.testVbo, 'aVertexPosition', 3, this.glContext.DATA_TYPE_FLOAT, 20, 0);
            this.glContext.useVertexBuffer(this.testVbo, 'aUV', 2, this.glContext.DATA_TYPE_FLOAT, 20, 12);
            this.glContext.useIndexBuffer(this.testEbo);
            this.glContext.drawTriUseIndices(36, this.glContext.DATA_TYPE_UNSIGNED_SHORT);
        }
    }

    init() {
        this.testVbo = this.glContext.createVertexBuffer(new Float32Array(vertices));
        this.testEbo = this.glContext.createIndexBuffer(new Uint16Array(indices));
        let vsSrc = readTextSync('@shaders/test_vs.glsl');
        let fsSrc = readTextSync('@shaders/test_fs.glsl');
        this.testShader = this.glContext.createShaderProgram(vsSrc, fsSrc);
    }

    tick(now) {
        this.updateTime(now);
        this.updateView();
        this.checkSize(this.glContext.getCanvas());

        this.drawScene();
    }

    quit() {
        this.glContext.destoryBuffer(this.testVbo);
        this.glContext.destoryBuffer(this.testEbo);
        this.glContext.destoryShaderProgram(this.testShader);
    }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)