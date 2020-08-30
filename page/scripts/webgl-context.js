const canvas = document.querySelector('#glcanvas');
const gl = canvas.getContext('webgl');
if (!gl) alert('Your browser or machine may not support webgl.');
const ext = {};

// utils
function compileShader(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

class ShaderProgram {
    constructor() {
        this._program = gl.createProgram();
        this._uniformLoc = {};
        this._attribsLoc = {};
    }

    _getUniformLocation(name) {
        if (this._uniformLoc[name] == undefined) {
            this._uniformLoc[name] = gl.getUniformLocation(this._program, name);
        }
        return this._uniformLoc[name];
    }

    _getAttribsLocation(name) {
        if (this._attribsLoc[name] == undefined) {
            this._attribsLoc[name] = gl.getAttribLocation(this._program, name);
        }
        return this._attribsLoc[name];
    }
}

class WebGLContext {
    constructor() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.blendFunc(gl.SRC_SLPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.DATA_TYPE_FLOAT = gl.FLOAT;
        this.DATA_TYPE_UNSIGNED_SHORT = gl.UNSIGNED_SHORT;

        this.currentShaderProgram = null;
    }

    getCanvas() {
        return canvas;
    }

    clearColor() {
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    clearDepth() {
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    clearColorAndDepth() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    setViewport(x, y, width, height) {
        gl.viewport(x, y, width, height);
    }

    // shader
    createShaderProgram(vsSrc, fsSrc) {
        let shaderProgram = new ShaderProgram();

        const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
        gl.attachShader(shaderProgram._program, vs);
        gl.attachShader(shaderProgram._program, fs);
        gl.linkProgram(shaderProgram._program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        if (!gl.getProgramParameter(shaderProgram._program, gl.LINK_STATUS)) {
            alert(gl.getProgramInfoLog(shaderProgram._program));
        }

        return shaderProgram;
    }

    useShaderProgram(shaderProgram) {
        gl.useProgram(shaderProgram._program);
        this.currentShaderProgram = shaderProgram;
    }

    setUniformF(name, value) {
        let loc = this.currentShaderProgram._getUniformLocation(name);
        if (value.length) {
            switch (value.length) {
                case 0: break;
                case 1: gl.uniform1f(loc, value[0]); break;
                case 2: gl.uniform2f(loc, value[0], value[1]); break;
                case 3: gl.uniform3f(loc, value[0], value[1], value[2]); break;
                default: gl.uniform4f(loc, value[0], value[1], value[2], value[3]); break;
            }
        }
        else {
            gl.uniform1f(loc, value);
        }
    }

    setUniformM(name, value) {
        if (value.length % 16 == 0) {
            gl.uniformMatrix4fv(this.currentShaderProgram._getUniformLocation(name), false, value);
        }
    }

    destoryShaderProgram(shaderProgram) {
        gl.deleteProgram(shaderProgram._program);
    }

    // vertex buffer
    createVertexBuffer(data) {
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return vbo;
    }

    /**
     * 
     * @param {WebGLBuffer} buffer the vertex buffer to bind
     * @param {string} attribName the index of the vertex attribute
     * @param {GLint} size the number of components per vertex attribute
     * @param {GLenum} type the data type of each component in the array
     * @param {GLsizei} stride the offset in bytes between the beginning of consecutive vertex attributes
     * @param {GLintptr} offset offset in bytes of the first component in the vertex attribute array
     */
    useVertexBuffer(buffer, attribName, size, type, stride, offset) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        let attribLoc = this.currentShaderProgram._getAttribsLocation(attribName);
        gl.vertexAttribPointer(attribLoc, size, type, false, stride, offset);
        gl.enableVertexAttribArray(attribLoc);
    }

    // index buffer
    createIndexBuffer(data) {
        const ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return ebo;
    }

    useIndexBuffer(buffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    }

    destoryBuffer(buffer) {
        gl.deleteBuffer(buffer);
    }

    drawTri(verticesCount) {
        gl.drawArrays(gl.TRIANGLES, 0, verticesCount);
    }

    drawTriUseIndices(indicesCount, indicesType) {
        gl.drawElements(gl.TRIANGLES, indicesCount, indicesType, 0)
    }
}

export { WebGLContext }