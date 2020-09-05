const canvas = document.querySelector('#glcanvas');
let gl = canvas.getContext('webgl2');
let isWebGL2 = true;
if (!gl) {
    isWebGL2 = false;
    gl = canvas.getContext('webgl');
}
if (!gl) alert('Your browser or machine may not support webgl.');

const hasFilterAnisotropic = useExtension("EXT_texture_filter_anisotropic");

if (!isWebGL2) if (!useExtension("OES_vertex_array_object")) alert('not support OES_vertex_array_object!');

// utils
function useExtension(name) {
    const ext = gl.getExtension(name);
    if (!ext) return false;
    for (const prop in ext) {
        gl[prop] = typeof(ext[prop]) === 'function' ? () => {return ext[prop]} : ext[prop];
    }
    return true;
}

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

class WebGLContext {
    constructor() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.blendFunc(gl.SRC_SLPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.filterType = {
            POINT       : 0,
            BILINEAR    : 1,
            TRILINEAR   : 2,
            ANISOTROPIC : 3
        };

        this.warpType = {
            REPEAT      : gl.REPEAT,
            MIRRORED    : gl.MIRRORED_REPEAT,
            CLAMP       : gl.CLAMP_TO_EDGE
        };

        this.dataType = {
            BYTE        : gl.BYTE,
            SHORT       : gl.SHORT,
            UBYTE       : gl.UNSIGNED_BYTE,
            USHORT      : gl.UNSIGNED_SHORT,
            FLOAT       : gl.FLOAT
        };

        this.primitiveType = {
            POINTS          : gl.POINTS,
            LINE_STRIP      : gl.LINE_STRIP,
            LINE_LOOP       : gl.LINE_LOOP,
            LINES           : gl.LINES,
            TRIANGLE_STRIP  : gl.TRIANGLE_STRIP,
            TRIANGLE_FAN    : gl.TRIANGLE_FAN,
            TRIANGLES       : gl.TRIANGLES
        };

        this._curShaderProgram = null;
    }

    getCanvas() {
        return gl.canvas;
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
    createTextureRGBA8(image, filter = this.filterType.BILINEAR, warp = this.warpType.CLAMP) {
        if (!isWebGL2 && !(isPowerOf2(image.width) && isPowerOf2(image.height))) {
            filter = this.filterType.BILINEAR;
            warp = this.warpType.CLAMP;
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        // filter
        let min = gl.NEAREST;
        let mag = gl.NEAREST;
        switch (filter) {
            case this.filterType.POINT:
                break;
            case this.filterType.ANISOTROPIC:
                if (hasFilterAnisotropic) {
                    let maxAnisotropy = gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
                }
            case this.filterType.TRILINEAR:
                gl.generateMipmap(gl.TEXTURE_2D);
                min = gl.LINEAR_MIPMAP_LINEAR;
                mag = gl.LINEAR;
                break;
            case this.filterType.BILINEAR:
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
        return tex;
    }

    useTexture(texture, slot = 0) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    destoryTexture(texture) {
        gl.deleteTexture(texture);
    }

    // shader
    createShaderProgram(name, attribs, vsSrc, fsSrc) {
        let ret = {
            _name: name,
            _program: gl.createProgram(),
            _uniformsInfo: {}
        };

        const header = 'precision mediump float;\n';

        let attribsStr = '';
        for (let i = 0; i < attribs.length; ++i) {
            let typeStr = attribs[i].size ? `vec${attribs[i].size}` : 'float';
            attribsStr += `attribute ${typeStr} ${attribs[i].name};\n`;
            gl.bindAttribLocation(ret._program, i, attribs[i].name);
        }

        const vs = compileShader(gl.VERTEX_SHADER, header + attribsStr + vsSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, header + fsSrc);
        gl.attachShader(ret._program, vs);
        gl.attachShader(ret._program, fs);
        gl.linkProgram(ret._program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        if (!gl.getProgramParameter(ret._program, gl.LINK_STATUS)) {
            alert(gl.getProgramInfoLog(ret._program));
        }
        else {
            const numUniforms = gl.getProgramParameter(ret._program, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < numUniforms; ++i) {
                const info = gl.getActiveUniform(ret._program, i);
                ret._uniformsInfo[info.name] = {
                    size: info.size,
                    type: info.type,
                    loc: gl.getUniformLocation(ret._program, info.name)
                };
            }
        }

        return ret;
    }

    useShaderProgram(shaderProgram) {
        if (!shaderProgram) return false;
        const err = gl.getError();
        if (err != gl.NO_ERROR) {
            console.log(`Error ${err} caught before using shader <${shaderProgram._name}>`);
        }
        gl.useProgram(shaderProgram._program);
        this._curShaderProgram = shaderProgram;
        return true;
    }

    setShaderParameters(params) {
        if (!this._curShaderProgram) return;
        let texSlot = 0;
        for (const name in params) {
            if (this._curShaderProgram._uniformsInfo[name]) {
                const loc = this._curShaderProgram._uniformsInfo[name].loc;
                const size = this._curShaderProgram._uniformsInfo[name].size;
                const type = this._curShaderProgram._uniformsInfo[name].type;
                const value = params[name];
                switch (type) {
                    case gl.FLOAT:
                        if (size > 1) { gl.uniform1fv(loc, value); break; }
                        gl.uniform1f(loc, value);
                        break;
                    case gl.FLOAT_VEC2:
                        if (size > 1) { gl.uniform2fv(loc, value); break; }
                        gl.uniform2f(loc, value[0], value[1]);
                        break;
                    case gl.FLOAT_VEC3:
                        if (size > 1) { gl.uniform3fv(loc, value); break; }
                        gl.uniform3f(loc, value[0], value[1], value[2]);
                        break;
                    case gl.FLOAT_VEC4:
                        if (size > 1) { gl.uniform4fv(loc, value); break; }
                        gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
                        break;
                    case gl.INT:
                    case gl.BOOL:
                        if (size > 1) { gl.uniform1iv(loc, value); break; }
                        gl.uniform1i(loc, value);
                        break;
                    case gl.INT_VEC2:
                    case gl.BOOL_VEC2:
                        if (size > 1) { gl.uniform2iv(loc, value); break; }
                        gl.uniform2i(loc, value[0], value[1]);
                        break;
                    case gl.INT_VEC3:
                    case gl.BOOL_VEC3:
                        if (size > 1) { gl.uniform3iv(loc, value); break; }
                        gl.uniform3i(loc, value[0], value[1], value[2]);
                        break;
                    case gl.INT_VEC4:
                    case gl.BOOL_VEC4:
                        if (size > 1) { gl.uniform4iv(loc, value); break; }
                        gl.uniform4i(loc, value[0], value[1], value[2], value[3]);
                        break;
                    case gl.FLOAT_MAT2:
                        gl.uniformMatrix2fv(loc, false, value);
                        break;
                    case gl.FLOAT_MAT3:
                        gl.uniformMatrix3fv(loc, false, value);
                        break;
                    case gl.FLOAT_MAT4:
                        gl.uniformMatrix4fv(loc, false, value);
                        break;
                    case gl.SAMPLER_2D:
                    case gl.SAMPLER_CUBE:
                        this.useTexture(value, texSlot);
                        gl.uniform1i(loc, texSlot);
                        ++texSlot;
                        break;
                    default:
                        break;
                }
            }
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
     * @param {GLuint} index the index of the vertex attribute
     * @param {GLint} size the number of components per vertex attribute
     * @param {GLenum} type the data type of each component in the array
     * @param {GLsizei} stride the offset in bytes between the beginning of consecutive vertex attributes
     * @param {GLintptr} offset offset in bytes of the first component in the vertex attribute array
     */
    useVertexBuffer(buffer, index, size, type, stride, offset) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(index, size, type, false, stride, offset);
        gl.enableVertexAttribArray(index);// ?
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

    // primitives
    createPrimitives(primitiveType, attribs, vertexArrayInfo, vertexCount) {
        let ret = {
            _vao: isWebGL2 ? gl.createVertexArray() : gl.createVertexArrayOES(),
            _vertexCount: vertexCount,
            _type: primitiveType,
            _indicesType: 0
        }
        isWebGL2 ? gl.bindVertexArray(ret._vao) : gl.bindVertexArrayOES(ret._vao);
        if (vertexArrayInfo.length > (attribs.length + 1)) alert('wrong size of vertexArrayInfo!');
        for (let i = 0; i < vertexArrayInfo.length; ++i) {
            if (!vertexArrayInfo[i]) continue;
            if (attribs[i]) {
                this.useVertexBuffer(vertexArrayInfo[i].buffer, i, attribs[i].size, vertexArrayInfo[i].type, vertexArrayInfo[i].byteStride, vertexArrayInfo[i].byteOffset);
            }
            else {
                this.useIndexBuffer(vertexArrayInfo[i].buffer);
                ret._indicesType = vertexArrayInfo[i].type;
            }
        }
        isWebGL2 ? gl.bindVertexArray(null) : gl.bindVertexArrayOES(null);
        return ret;
    }

    drawPrimitives(primitives) {
        isWebGL2 ? gl.bindVertexArray(primitives._vao) : gl.bindVertexArrayOES(primitives._vao);

        if (primitives._indicesType) {
            gl.drawElements(primitives._type, primitives._vertexCount, primitives._indicesType, 0);
        }
        else {
            gl.drawArrays(primitives._type, 0, primitives._vertexCount);
        }

        isWebGL2 ? gl.bindVertexArray(null) : gl.bindVertexArrayOES(null);
    }

    destoryPrimitives(primitives) {
        isWebGL2 ? gl.deleteVertexArrayOES(primitives._vao) : gl.deleteVertexArrayOES(primitives._vao);
    }
}

const webGLContext = new WebGLContext();

export { webGLContext }