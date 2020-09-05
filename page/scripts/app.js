import { webGLContext as glc } from './webgl-context.js'
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
function readText(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = () => { callback(xhr.responseText); }
    xhr.send();
}

class App {
    constructor() {
        this.frame = 0;
        this.delta = 0;
        this._lastFrame = 0;

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
        glc.setViewport(0, 0, width, height);
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
        glc.clearColorAndDepth();
        if (this.testTexture) {
            glc.useTexture(this.testTexture, 0);
        }
        if (this.testShader) {
            glc.useShaderProgram(this.testShader);
            glc.setUniformM('uView', this.viewMat);
            glc.setUniformM('uProj', this.projMat);
            glc.useVertexBuffer(this.testVbo, 'aVertexPosition', 3, glc.DATA_TYPE_FLOAT, 20, 0);
            glc.useVertexBuffer(this.testVbo, 'aUV', 2, glc.DATA_TYPE_FLOAT, 20, 12);
            glc.useIndexBuffer(this.testEbo);
            glc.drawTriUseIndices(36, glc.DATA_TYPE_UNSIGNED_SHORT);
        }
    }

    init() {
        // shader
        let vsSrc, fsSrc;
        readText('@shaders/test_vs.glsl', (text) => {
            vsSrc = text;
            if (vsSrc && fsSrc)  this.testShader = glc.createShaderProgram(vsSrc, fsSrc);
        });
        readText('@shaders/test_fs.glsl', (test) => {
            fsSrc = test;
            if (vsSrc && fsSrc)  this.testShader = glc.createShaderProgram(vsSrc, fsSrc);
        });
        // buffer
        this.testVbo = glc.createVertexBuffer(new Float32Array(vertices).buffer);
        this.testEbo = glc.createIndexBuffer(new Uint16Array(indices).buffer);
        // texture
        let testTexture = this.testTexture;
        let img = new Image();
        img.onload = () => { testTexture = glc.createTextureRGBA8(img, glc.filterType.ANISOTROPIC); };
        img.src = '@images/test.jpg';
    }

    tick(now) {
        this.updateTime(now);
        this.updateView();
        this.checkSize(glc.getCanvas());

        this.drawScene();
    }

    // quit() {
    //     glc.destoryBuffer(this.testVbo);
    //     glc.destoryBuffer(this.testEbo);
    //     glc.destoryTexture(this.testTexture);
    //     glc.destoryShaderProgram(this.testShader);
    // }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)