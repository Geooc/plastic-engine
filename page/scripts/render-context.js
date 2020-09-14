const canvas = document.querySelector('#glcanvas');
let gl = canvas.getContext('webgl2');
let isWebGL2 = true;
if (!gl) {
    isWebGL2 = false;
    gl = canvas.getContext('webgl');
}
if (!gl) alert('Your browser or machine may not support webgl.');

const hasFilterAnisotropic = useExtension("EXT_texture_filter_anisotropic");

//if (!isWebGL2) if (!useExtension("OES_vertex_array_object")) alert('not support OES_vertex_array_object!');
if (!isWebGL2) if (!useExtension("OES_element_index_uint")) alert('not support OES_element_index_uint!');

let ext = gl.getExtension('OES_vertex_array_object');

// utils
function useExtension(name) {
    const ext = gl.getExtension(name);
    if (!ext) return false;
    for (const prop in ext) {
        gl[prop] = typeof (ext[prop]) === 'function' ? () => { return ext[prop] } : ext[prop];
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

class RenderContext {
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

        this.bufferType = {
            VERTEX      : gl.ARRAY_BUFFER,
            INDEX       : gl.ELEMENT_ARRAY_BUFFER
        }

        this.primitiveType = {
            POINTS          : gl.POINTS,
            LINE_STRIP      : gl.LINE_STRIP,
            LINE_LOOP       : gl.LINE_LOOP,
            LINES           : gl.LINES,
            TRIANGLE_STRIP  : gl.TRIANGLE_STRIP,
            TRIANGLE_FAN    : gl.TRIANGLE_FAN,
            TRIANGLES       : gl.TRIANGLES
        };
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

    // render pass
    createRenderPass(name, vsSrc, fsSrc, outputsInfo) {
        let ret = {
            name: name,
            _vsSrc: vsSrc,
            _fsSrc: fsSrc,
            _shaderMap: {}
        };
        return ret;
    }

    execRenderPass(renderPass, cmdGenerator) {
        if (!renderPass) return;
        const err = gl.getError();
        if (err != gl.NO_ERROR) {
            console.log(`Error ${err} caught before RenderPass <${renderPass.name}>`);
        }
        let cmdList = cmdGenerator();
        for (const cmd of cmdList) {
            const drawcall = cmd.drawcall;
            const parameters = cmd.parameters;
            const states = cmd.states;// not in use yet
            if (drawcall) {
                // todo: set states

                let shader = renderPass._shaderMap[drawcall._shaderKey];
                // lazy compile shader
                if (!shader) {
                    shader = {
                        _program: gl.createProgram(),
                        _uniforms: {}
                    };

                    let header = 'precision highp float;\n';
                    let vsAttribs = '';
                    let attribIndex = 0;
                    for (const attribName in drawcall._attribsInfo) {
                        if (attribName != 'indices') {
                            header += `#define USE_ATTRIB_${drawcall._attribsInfo[attribName].size > 1 ? `VEC${drawcall._attribsInfo[attribName].size}` : 'SCALAR'}`;
                            header += `${attribName.replace(/(^[a-z][a-z]?|[A-Z][A-Z]?)/g, '_$1').toUpperCase()} 1\n`;
                            vsAttribs += `attribute ${drawcall._attribsInfo[attribName].size > 1 ? `vec${drawcall._attribsInfo[attribName].size}` : 'float'} ${attribName};\n`;
                            gl.bindAttribLocation(shader._program, attribIndex++, attribName);
                        }
                    }
                    const vs = compileShader(gl.VERTEX_SHADER, header + vsAttribs + renderPass._vsSrc);
                    //console.log(`compile shader [${drawcall._shaderKey}]\n` + header + vsAttribs + renderPass._vsSrc);
                    const fs = compileShader(gl.FRAGMENT_SHADER, header + renderPass._fsSrc);
                    gl.attachShader(shader._program, vs);
                    gl.attachShader(shader._program, fs);
                    gl.linkProgram(shader._program);
                    gl.deleteShader(vs);
                    gl.deleteShader(fs);

                    if (!gl.getProgramParameter(shader._program, gl.LINK_STATUS)) {
                        alert(gl.getProgramInfoLog(shader._program));
                    }
                    else {
                        const uniformsCount = gl.getProgramParameter(shader._program, gl.ACTIVE_UNIFORMS);
                        for (let i = 0; i < uniformsCount; ++i) {
                            const info = gl.getActiveUniform(shader._program, i);
                            shader._uniforms[info.name] = {
                                size: info.size,
                                type: info.type,
                                loc: gl.getUniformLocation(shader._program, info.name)
                            };
                        }
                    }
                    renderPass._shaderMap[drawcall._shaderKey] = shader;
                }
                gl.useProgram(shader._program);
                // set parameters
                if (parameters) {
                    let textureSlot = 0;
                    for (const name in parameters) {
                        if (shader._uniforms[name]) {
                            const loc = shader._uniforms[name].loc;
                            const size = shader._uniforms[name].size;
                            const type = shader._uniforms[name].type;
                            const value = parameters[name];
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
                                    this.useTexture(value, textureSlot);
                                    gl.uniform1i(loc, textureSlot++);
                                    break;
                                default:
                                    break;
                            }
                        }
                    }
                }
                // submit drawcall
                isWebGL2 ? gl.bindVertexArray(drawcall._vao) : ext.bindVertexArrayOES(drawcall._vao);

                if (drawcall._indicesType) {
                    gl.drawElements(drawcall._type, drawcall._vertexCount, drawcall._indicesType, drawcall._indicesOffset);
                }
                else {
                    gl.drawArrays(drawcall._type, 0, drawcall._vertexCount);
                }

                isWebGL2 ? gl.bindVertexArray(null) : ext.bindVertexArrayOES(null);
            }
        }

    }

    destoryRenderPass(renderPass) {
        for (const shader in _shaderMap) {
            gl.deleteProgram(shader._program);
        }
    }
    // buffer
    createBuffer(bufferType, data) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(bufferType, buffer);
        gl.bufferData(bufferType, data, gl.STATIC_DRAW);
        return buffer;
    }

    useVertexBuffer(buffer, index, size, type, byteStride, byteOffset) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(index, size, type, false, byteStride, byteOffset);
        gl.enableVertexAttribArray(index);
    }

    useIndexBuffer(buffer) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    }

    destoryBuffer(buffer) {
        gl.deleteBuffer(buffer);
    }

    // drawcall
    createDrawcall(primitiveType, vertexCount, attribsInfo) {
        let ret = {
            _vao: isWebGL2 ? gl.createVertexArray() : ext.createVertexArrayOES(),
            _attribsInfo: attribsInfo,
            _vertexCount: vertexCount,
            _type: primitiveType,
            _indicesType: 0,
            _indicesOffset: 0,
            _shaderKey: ''
        }
        isWebGL2 ? gl.bindVertexArray(ret._vao) : ext.bindVertexArrayOES(ret._vao);

        let attribIndex = 0;
        for (const attribName in attribsInfo) {
            if (attribName == 'indices') {
                this.useIndexBuffer(attribsInfo[attribName].buffer);
                ret._indicesType = attribsInfo[attribName].type;
                ret._indicesOffset = attribsInfo[attribName].byteOffset ? attribsInfo[attribName].byteOffset : 0;
            }
            else {
                ret._shaderKey += `${attribIndex}${attribName}`;
                this.useVertexBuffer(
                    attribsInfo[attribName].buffer, attribIndex++,
                    attribsInfo[attribName].size, attribsInfo[attribName].type,
                    attribsInfo[attribName].byteStride, attribsInfo[attribName].byteOffset
                );
            }
        }

        isWebGL2 ? gl.bindVertexArray(null) : ext.bindVertexArrayOES(null);
        return ret;
    }

    destoryDrawcall(drawcall) {
        isWebGL2 ? gl.deleteVertexArray(drawcall._vao) : ext.deleteVertexArrayOES(drawcall._vao);
    }
}

const renderContext = new RenderContext();

export { renderContext }