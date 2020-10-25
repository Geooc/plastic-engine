const canvas = document.querySelector('#glcanvas');
let gl = canvas.getContext('webgl2');
let isWebGL2 = true;
if (!gl) {
    isWebGL2 = false;
    gl = canvas.getContext('webgl');
}
if (!gl) alert('Your browser or machine may not support webgl.');

// const alignment = 1;
// gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);

const hasFilterAnisotropic = getAndApplyExtension("EXT_texture_filter_anisotropic");
if (isWebGL2) {
    if (!getAndApplyExtension("EXT_color_buffer_float")) alert('not support EXT_color_buffer_float!');
}
else {
    if (!getAndApplyExtension("OES_vertex_array_object")) alert('not support OES_vertex_array_object!');
    if (!getAndApplyExtension("OES_element_index_uint")) alert('not support OES_element_index_uint!');
    if (!getAndApplyExtension("OES_texture_half_float")) alert('not support OES_texture_half_float!');
    if (!getAndApplyExtension("OES_texture_half_float_linear")) alert('not support OES_texture_half_float_linear!');
    if (!getAndApplyExtension("WEBGL_depth_texture")) alert('not support WEBGL_depth_texture!');
    if (!getAndApplyExtension("EXT_color_buffer_half_float")) alert('not support EXT_color_buffer_half_float!');
    // unfortunately, ios doesn't support it
    //if (!getAndApplyExtension("WEBGL_draw_buffers")) alert('not support WEBGL_draw_buffers!');
}

// post process res
const ppVsSrc = `
precision highp float;
attribute vec2 aPos;
varying   vec2 vUV;

void main()
{
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// utils
// Making WebGL1 extensions look like WebGL2. from: https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
function getAndApplyExtension(name) {
    const ext = gl.getExtension(name);
    if (!ext) {
        return null;
    }
    const fnSuffix = name.split("_")[0];
    const enumSuffix = '_' + fnSuffix;
    for (const key in ext) {
        const value = ext[key];
        const isFunc = typeof (value) === 'function';
        const suffix = isFunc ? fnSuffix : enumSuffix;
        let name = key;
        // examples of where this is not true are WEBGL_compressed_texture_s3tc
        // and WEBGL_compressed_texture_pvrtc
        if (key.endsWith(suffix)) {
            name = key.substring(0, key.length - suffix.length);
        }
        if (gl[name] !== undefined) {
            if (!isFunc && gl[name] !== value) {
                console.warn("conflict:", name, gl[name], value, key);
            }
        } else {
            if (isFunc) {
                gl[name] = function (origFn) {
                    return function () {
                        return origFn.apply(ext, arguments);
                    };
                }(value);
            } else {
                gl[name] = value;
            }
        }
    }
    return ext;
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

// from: https://stackoverflow.com/questions/32633585/how-do-you-convert-to-half-floats-in-javascript
var toHalf = (function () {

    var floatView = new Float32Array(1);
    var int32View = new Int32Array(floatView.buffer);

    /* This method is faster than the OpenEXR implementation (very often
     * used, eg. in Ogre), with the additional benefit of rounding, inspired
     * by James Tursa?s half-precision code. */
    return function toHalf(val) {

        floatView[0] = val;
        var x = int32View[0];

        var bits = (x >> 16) & 0x8000; /* Get the sign */
        var m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
        var e = (x >> 23) & 0xff; /* Using int is faster here */

        /* If zero, or denormal, or exponent underflows too much for a denormal
         * half, return signed zero. */
        if (e < 103) {
            return bits;
        }

        /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
        if (e > 142) {
            bits |= 0x7c00;
            /* If exponent was 0xff and one mantissa bit was set, it means NaN,
                 * not Inf, so make sure we set one mantissa bit too. */
            bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        /* If exponent underflows but not too much, return a denormal */
        if (e < 113) {
            m |= 0x0800;
            /* Extra rounding may overflow and set mantissa to 0 and exponent
             * to 1, which is OK. */
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);
        /* Extra rounding. An overflow will set mantissa to 0 and increment
         * the exponent, which is OK. */
        bits += m & 1;
        return bits;
    };

}());

class RenderContext {
    constructor() {
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
        };

        this.textureFormat = {
            RGB8        : 0,
            RGBA8       : 1,
            R8          : 2,

            RGB16F      : 3,
            RGBA16F     : 4,
            R16F        : 5,

            R11G11B10   : 6// fallback on webgl
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

        this.format2DataFormat = [
            gl.RGB, gl.RGBA, isWebGL2 ? gl.RED : gl.LUMINANCE,
            gl.RGB, gl.RGBA, isWebGL2 ? gl.RED : gl.LUMINANCE,
            gl.RGB
        ];

        this.format2SizedFormat = [
            gl.RGB8, gl.RGBA8, gl.R8,
            gl.RGB16F, gl.RGBA16F, gl.R16F,
            gl.R11F_G11F_B10F
        ];

        this.depthFunc = {
            NONE    : 0,
            LEQUAL  : gl.LEQUAL,
        };

        this.postProcessVbo = this.createVertexBuffer(new Float32Array([ -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0 ]));
        this.postProcessDrawcall = this.createDrawcall(this.primitiveType.TRIANGLE_STRIP, 4, {
            aPos : { buffer : this.postProcessVbo, size : 2, type : this.dataType.FLOAT }
        })

        this.renderFace(true, false);
        this.setDepthFunc(this.depthFunc.LEQUAL);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        //gl.blendFunc(gl.SRC_SLPHA, gl.ONE_MINUS_SRC_ALPHA);
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

    setDepthFunc(func) {
        if (func) {
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(func);
        }
        else {
            gl.disable(gl.DEPTH_TEST);
        }
    }

    writeDepth(enable) {
        gl.depthMask(enable);
    }

    renderFace(front = true, back = false) {
        if (front && back) gl.disable(gl.CULL_FACE)
        else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(front ? gl.BACK : (back ? gl.FRONT : gl.FRONT_AND_BACK));
        }
    }

    setViewport(x, y, width, height) {
        gl.viewport(x, y, width, height);
    }

    // texture
    setTextureSampler(filter, warp, isPowerOf2, isCubemap = false) {
        if (!isWebGL2 && !isPowerOf2) {
            if (filter != this.filterType.POINT) filter = this.filterType.BILINEAR;
            warp = this.warpType.CLAMP;
        }
        // filter
        let min = gl.NEAREST;
        let mag = gl.NEAREST;
        switch (filter) {
            case this.filterType.POINT:
                break;
            case this.filterType.ANISOTROPIC:
                if (hasFilterAnisotropic) {
                    let maxAnisotropy = gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY);
                    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAX_ANISOTROPY, maxAnisotropy);
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
    }

    createTextureFromImage(image, filter = this.filterType.BILINEAR, warp = this.warpType.CLAMP, sRGB = false/*todo*/) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.setTextureSampler(filter, warp, isPowerOf2(image.width) && isPowerOf2(image.height));
        return tex;
    }

    createTextureFromData(data, format, width, height, filter = this.filterType.POINT, warp = this.warpType.CLAMP) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        let dataFormat = this.format2DataFormat[format];
        let dataType = format > 2 ? gl.FLOAT : gl.UNSIGNED_BYTE;
        if (isWebGL2) {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format2SizedFormat[format], width, height, 0, dataFormat, dataType, data);
        }
        else {
            if (dataType == gl.FLOAT) {// no sized format on webgl, we convert float array to half array. is there a better way?
                dataType = gl.HALF_FLOAT;
                if (data) {
                    let halfData = new Uint16Array(data.length);
                    for (let i = 0; i < halfData.length; ++i) {
                        halfData[i] = toHalf(data[i]);
                    }
                    data = halfData;
                }
            }
            gl.texImage2D(gl.TEXTURE_2D, 0, dataFormat, width, height, 0, dataFormat, dataType, data);
        }
        this.setTextureSampler(filter, warp, isPowerOf2(width) && isPowerOf2(height));
        return tex;
    }

    createDepthTexture(width, height, filter = this.filterType.POINT, warp = this.warpType.CLAMP) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, isWebGL2 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        this.setTextureSampler(filter, warp, isPowerOf2(width) && isPowerOf2(height));
        return tex;
    }

    createCubemapFromData(data, format, width, height, filter = this.filterType.BILINEAR, warp = this.warpType.REPEAT, needMipmaps = false) {
        let cubemap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
        let dataFormat = this.format2DataFormat[format];
        let dataType = format > 2 ? gl.FLOAT : gl.UNSIGNED_BYTE;
        if (isWebGL2) {
            for (let i = 0; i < 6; ++i) {
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, this.format2SizedFormat[format], width, height, 0, dataFormat, dataType, data ? data[i] : null);
            }
        }
        else {
            for (let i = 0; i < 6; ++i) {
                if (dataType == gl.FLOAT) {// no sized format on webgl, we convert float array to half array. is there a better way?
                    dataType = gl.HALF_FLOAT;
                    if (data && data[i]) {
                        let halfData = new Uint16Array(data[i].length);
                        for (let j = 0; j < halfData.length; ++i) {
                            halfData[j] = toHalf(data[i][j]);
                        }
                        data[i] = halfData;
                    }
                }
                gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, dataFormat, width, height, 0, dataFormat, dataType, data ? data[i] : null);
            }
            
        }
        //this.setTextureSampler(filter, warp, isPowerOf2(width) && isPowerOf2(height));
        return cubemap;
    }

    setTexture(texture, slot = 0) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    setCubemap(cubemap, slot = 0) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
    }

    autoGenTextureMipmaps(texture) {
        this.setTexture(texture);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

    autoGenCubemapMipmaps(cubemap) {
        this.setCubemap(cubemap);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    }

    destoryTexture(texture) {
        gl.deleteTexture(texture);
    }

    // render pass
    updateRenderTarget(renderPass, outputsInfo) {
        // framebuffer
        if (renderPass._fbo) {
            gl.deleteFramebuffer(renderPass._fbo);// really need to delete?
            renderPass._fbo = null;
        }
        if (outputsInfo) {
            renderPass._fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, renderPass._fbo);
            if (outputsInfo['depth']) {// depth attachment
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, outputsInfo['depth'].texture, 0);
            }
            let attachPoint = 0;
            let drawBuffers = [];
            for (const outputName in outputsInfo) {// color attachments
                if (outputName == 'depth') continue;
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachPoint,
                    outputsInfo[outputName].face != undefined ? (gl.TEXTURE_CUBE_MAP_POSITIVE_X + outputsInfo[outputName].face) : gl.TEXTURE_2D,
                    outputsInfo[outputName].texture,
                    outputsInfo[outputName].level ? outputsInfo[outputName].level : 0
                );
                drawBuffers.push(gl.COLOR_ATTACHMENT0 + attachPoint++);
                if (!isWebGL2) break;// because ios doesn't support WEBGL_draw_buffers, so close mrt for webgl1
            }
            if (isWebGL2) gl.drawBuffers(drawBuffers);
            this.clearColorAndDepth();// todo: choose clear or load
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
    }

    createRenderPass(name, vsSrc, fsSrc, outputsInfo) {
        let ret = {
            name: name,
            _vsSrc: vsSrc,
            _fsSrc: fsSrc,
            _fbo: null,
            _shaderMap: {},
            _params: {}
        };
        // create render target
        this.updateRenderTarget(ret, outputsInfo);
        return ret;
    }

    setShaderParameters(shader, parameters) {
        let textureSlot = 0;// fixme: the way set texture has problem
        for (const name in parameters) {
            const value = parameters[name];
            if (value && shader._uniforms[name]) {
                const loc = shader._uniforms[name].loc;
                const size = shader._uniforms[name].size;
                const type = shader._uniforms[name].type;
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
                        this.setTexture(value, textureSlot);
                        gl.uniform1i(loc, textureSlot++);
                        break;
                    case gl.SAMPLER_CUBE:
                        this.setCubemap(value, textureSlot);
                        gl.uniform1i(loc, textureSlot++);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    submitDrawcall(drawcall) {
        gl.bindVertexArray(drawcall._vao);

        if (drawcall._indicesType) {
            gl.drawElements(drawcall._type, drawcall._vertexCount, drawcall._indicesType, drawcall._indicesOffset);
        }
        else {
            gl.drawArrays(drawcall._type, 0, drawcall._vertexCount);
        }

        gl.bindVertexArray(null);
    }

    execRenderPass(renderPass, cmdList) {
        if (!renderPass) return;
        const err = gl.getError();
        if (err != gl.NO_ERROR) {
            console.log(`Error ${err} caught before RenderPass <${renderPass.name}>`);
        }

        if (renderPass._fbo) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, renderPass._fbo);
            // todo: load or clear switch
            //this.clearColorAndDepth();
        }
        
        for (const cmd of cmdList) {
            const drawcall = cmd.drawcall;
            const parameters = cmd.parameters;
            const states = cmd.states;// not in use yet
            if (drawcall) {
                // todo: set states

                let shader = renderPass._shaderMap[drawcall._shaderKey];
                // lazy compile shader
                let isNewShader = false;
                if (!shader) {
                    isNewShader = true;
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
                if (isNewShader) {
                    Object.assign(renderPass._params, parameters);
                    this.setShaderParameters(shader, renderPass._params);
                }
                else if (parameters) {
                    Object.assign(renderPass._params, parameters);
                    this.setShaderParameters(shader, parameters);
                }
                // submit drawcall
                this.submitDrawcall(drawcall);
            }
            else if (parameters) {
                for (const shaderKey in renderPass._shaderMap) {
                    const shader = renderPass._shaderMap[shaderKey]
                    gl.useProgram(shader._program);
                    this.setShaderParameters(shader, parameters);
                }
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    destoryRenderPass(renderPass) {
        if (renderPass._fbo) gl.deleteFramebuffer(renderPass._fbo);
        for (const shader in renderPass._shaderMap) {
            gl.deleteProgram(shader._program);
        }
    }

    // postprocess
    createPostProcess(name, fsSrc, outputsInfo) {
        let ret = {
            name : name,
            _fbo : null,
            _shader : {
                _program : gl.createProgram(),
                _uniforms : {}
            }
        };
        // create render target
        this.updateRenderTarget(ret, outputsInfo);

        // shader
        const vs = compileShader(gl.VERTEX_SHADER, ppVsSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
        gl.attachShader(ret._shader._program, vs);
        gl.attachShader(ret._shader._program, fs);
        gl.linkProgram(ret._shader._program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        if (!gl.getProgramParameter(ret._shader._program, gl.LINK_STATUS)) {
            alert(gl.getProgramInfoLog(ret._shader._program));
        }
        else {
            const uniformsCount = gl.getProgramParameter(ret._shader._program, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < uniformsCount; ++i) {
                const info = gl.getActiveUniform(ret._shader._program, i);
                ret._shader._uniforms[info.name] = {
                    size: info.size,
                    type: info.type,
                    loc: gl.getUniformLocation(ret._shader._program, info.name)
                };
            }
        }

        return ret;
    }

    execPostProcess(postProcess, parameters) {
        if (postProcess._fbo) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, postProcess._fbo);
        }
        gl.useProgram(postProcess._shader._program);
        this.setShaderParameters(postProcess._shader, parameters);
        this.submitDrawcall(this.postProcessDrawcall);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    destoryPostProcess(postProcess) {
        if (postProcess._fbo) gl.deleteFramebuffer(postProcess._fbo);
        gl.deleteProgram(postProcess._shader._program);
    }

    // buffer
    createBuffer(bufferType, data) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(bufferType, buffer);
        gl.bufferData(bufferType, data, gl.STATIC_DRAW);
        return buffer;
    }

    createVertexBuffer(data) {
        return this.createBuffer(this.bufferType.VERTEX, data);
    }

    createIndexBuffer(data) {
        return this.createBuffer(this.bufferType.INDEX, data);
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
            _vao: gl.createVertexArray(),
            _attribsInfo: attribsInfo,
            _vertexCount: vertexCount,
            _type: primitiveType,
            _indicesType: 0,
            _indicesOffset: 0,
            _shaderKey: ''
        }
        gl.bindVertexArray(ret._vao);

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

        gl.bindVertexArray(null);
        return ret;
    }

    destoryDrawcall(drawcall) {
        gl.deleteVertexArray(drawcall._vao);
    }
}

const renderContext = new RenderContext();

export { renderContext }