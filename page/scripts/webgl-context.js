const canvas = document.querySelector('#glcanvas');
let gl = canvas.getContext('webgl2');
let isWebGL2 = true;
if (!gl) {
    isWebGL2 = false;
    gl = canvas.getContext('webgl');
}
if (!gl) alert('Your browser or machine may not support webgl.');
let ext = {};
ext['EXT_texture_filter_anisotropic'] = gl.getExtension("EXT_texture_filter_anisotropic");
if (!ext['EXT_texture_filter_anisotropic']) alert('Anisotropic is not supported!');

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

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
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

        this.FILTER_TYPE_POINT = 0;
        this.FILTER_TYPE_BILINEAR = 1;
        this.FILTER_TYPE_TRILINEAR = 2;
        this.FILTER_TYPE_ANISOTROPIC = 3;

        this.WARP_TYPE_REPEAT = gl.REPEAT;
        this.WARP_TYPE_MIRRORED = gl.MIRRORED_REPEAT;
        this.WARP_TYPE_CLAMP = gl.CLAMP_TO_EDGE;

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

    // texture
    createTextureRGBA8(image, filter = this.FILTER_TYPE_BILINEAR, warp = this.WARP_TYPE_CLAMP) {
        if (!isWebGL2 && !(isPowerOf2(image.width) && isPowerOf2(image.height))) {
            filter = this.FILTER_TYPE_BILINEAR;
            warp = this.WARP_TYPE_CLAMP;
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        // filter
        let min = gl.NEAREST;
        let mag = gl.NEAREST;
        switch (filter) {
            case this.FILTER_TYPE_POINT:
                break;
            case this.FILTER_TYPE_ANISOTROPIC:
                if (ext.EXT_texture_filter_anisotropic) {
                    let maxAnisotropy = gl.getParameter(ext.EXT_texture_filter_anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                    gl.texParameterf(gl.TEXTURE_2D, ext.EXT_texture_filter_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
                }
            case this.FILTER_TYPE_TRILINEAR:
                gl.generateMipmap(gl.TEXTURE_2D);
                min = gl.LINEAR_MIPMAP_LINEAR;
                mag = gl.LINEAR;
                break;
            case this.FILTER_TYPE_BILINEAR:
            default:
                min = gl.NEAREST;
                mag = gl.LINEAR;
                break;
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
        // warp
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, warp);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, warp);
    }

    useTexture(texture, slot = 0) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    destoryTexture(texture) {
        gl.deleteTexture(texture);
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
     * @param {string} attribName the name of the vertex attribute
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