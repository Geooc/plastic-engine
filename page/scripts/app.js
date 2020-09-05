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

// assets utils
function readText(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = () => { callback(xhr.responseText); }
    xhr.send();
}

function loadVertexShaderAndFragmentShader(vsUrl, fsUrl, callback) {
    let vsSrc, fsSrc;
    readText(vsUrl, (src) => { vsSrc = src; if (fsSrc) callback(vsSrc, fsSrc); });
    readText(fsUrl, (src) => { fsSrc = src; if (vsSrc) callback(vsSrc, fsSrc); });
}

function loadImage(url, callback) {
    let img = new Image();
    img.onload = () => { callback(img) };
    img.src = url;
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

        if (glc.useShaderProgram(this.testShader) && this.testTexture) {
            glc.setShaderParameters({
                uView: this.viewMat,
                uProj: this.projMat,
                uTestTex: this.testTexture,
            });
            glc.drawPrimitives(this.primitives);
        }
    }

    init() {
        const attribs = [
            { name: 'aVertexPosition', size: 3 },
            { name: 'aUV', size: 2 }
        ];
        // buffer
        this.testVbo = glc.createVertexBuffer(new Float32Array(vertices));
        this.testEbo = glc.createIndexBuffer(new Uint16Array(indices));
        // primitives
        const vertexArrayInfo = [
            { buffer: this.testVbo, type: glc.dataType.FLOAT, byteStride: 20, byteOffset: 0 },
            { buffer: this.testVbo, type: glc.dataType.FLOAT, byteStride: 20, byteOffset: 12 },
            { buffer: this.testEbo, type: glc.dataType.USHORT }
        ];
        this.primitives = glc.createPrimitives(glc.primitiveType.TRIANGLES, attribs, vertexArrayInfo, 36);
        // shader
        loadVertexShaderAndFragmentShader('@shaders/test_vs.glsl', '@shaders/test_fs.glsl', (vsSrc, fsSrc) => {
            this.testShader = glc.createShaderProgram('test', attribs, vsSrc, fsSrc);
        });
        // texture
        loadImage('@images/test.jpg', (img) => { this.testTexture = glc.createTextureRGBA8(img, glc.filterType.ANISOTROPIC); });
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
    //     glc.destoryPrimitives(this.primitives);
    //     glc.destoryShaderProgram(this.testShader);
    // }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)