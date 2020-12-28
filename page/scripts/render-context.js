// render-context.js
import { check, error } from './utils/debug-utils.js'
import { assetUtils } from './utils/asset-utils.js'

const canvas = document.querySelector('#glcanvas');
let gl = canvas.getContext('webgl1');
let isWebGL2 = true;
if (!gl) {
    isWebGL2 = false;
    gl = canvas.getContext('webgl');
}
if (!gl) error('Your browser or machine may not support webgl.');

// const alignment = 1;
// gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);

const hasFilterAnisotropic = getAndApplyExtension("EXT_texture_filter_anisotropic");
if (isWebGL2) {
    getAndApplyExtension("EXT_color_buffer_float");
}
else {
    getAndApplyExtension("OES_vertex_array_object");
    getAndApplyExtension("OES_element_index_uint");
    getAndApplyExtension("OES_texture_half_float");
    getAndApplyExtension("OES_texture_half_float_linear");
    getAndApplyExtension("WEBGL_depth_texture");
    getAndApplyExtension("EXT_color_buffer_half_float");
    getAndApplyExtension("EXT_shader_texture_lod");
    // unfortunately, safari doesn't support it
    //getAndApplyExtension("WEBGL_draw_buffers");
    //getAndApplyExtension("OES_fbo_render_mipmap");
}

// utils
// Making WebGL1 extensions look like WebGL2. from: https://webgl2fundamentals.org/webgl/lessons/webgl1-to-webgl2.html
function getAndApplyExtension(name) {
    const ext = gl.getExtension(name);
    if (!ext) {
        error(`not support ext ${name}!`);
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
        error(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// https://stackoverflow.com/questions/32633585/how-do-you-convert-to-half-floats-in-javascript
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

// buffer
const DataType = {
    DATA_BYTE: gl.BYTE,
    DATA_SHORT: gl.SHORT,
    DATA_UBYTE: gl.UNSIGNED_BYTE,
    DATA_USHORT: gl.UNSIGNED_SHORT,
    DATA_FLOAT: gl.FLOAT
};

const BufferType = {
    BUFFER_VERTEX: gl.ARRAY_BUFFER,
    BUFFER_INDEX: gl.ELEMENT_ARRAY_BUFFER
};

class Buffer {
    constructor(bufferType) {
        this._buffer = gl.createBuffer();
        this.bufferType = bufferType;
    }

    setData(data) {
        check(boundDrawcallId == -1, `don't forget call unbind() after create a drawcall!`);
        gl.bindBuffer(this.bufferType, this._buffer);
        gl.bufferData(this.bufferType, data, gl.STATIC_DRAW);
        return this;
    }

    bind(index, size, type, byteStride, byteOffset) {
        if (this.bufferType == gl.ARRAY_BUFFER) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
            gl.vertexAttribPointer(index, size, type, false, byteStride, byteOffset);
            gl.enableVertexAttribArray(index);
        }
        else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._buffer);
        }
    }

    destory() {
        gl.deleteBuffer(this._buffer);
    }
}

// drawcall
let genDrawcallId = 0;
let boundDrawcallId = -1;

const PrimitiveType = {
    PRIM_POINTS: gl.POINTS,
    PRIM_LINE_STRIP: gl.LINE_STRIP,
    PRIM_LINE_LOOP: gl.LINE_LOOP,
    PRIM_LINES: gl.LINES,
    PRIM_TRIANGLE_STRIP: gl.TRIANGLE_STRIP,
    PRIM_TRIANGLE_FAN: gl.TRIANGLE_FAN,
    PRIM_TRIANGLES: gl.TRIANGLES
};

class Drawcall {
    constructor(primitiveType, vertexCount) {
        this.vertexCount = vertexCount;
        
        this._id = genDrawcallId++;
        this._vao = gl.createVertexArray();
        this._primType = primitiveType;
        this._indicesType = 0;// zero means no indices
        this._indicesOffset = 0;

        this.attribs = {};
        this.flags = {};

        this._needGenShaderKey = true;

        this.parameters = {};// per drawcall parameters
    }

    bind() {
        gl.bindVertexArray(this._vao);
        boundDrawcallId = this._id;
        return this;
    }

    setAttributes(attributes) {
        check(this._id == boundDrawcallId, 'bind drawcall first!');

        let attribIndex = 0;
        for (const attribName in attributes) {
            attributes[attribName].buffer.bind(
                attribIndex++,
                attributes[attribName].size,
                attributes[attribName].type,
                attributes[attribName].byteStride,
                attributes[attribName].byteOffset
            );
        }

        this.attribs = attributes;
        this._needGenShaderKey = true;

        return this;
    }

    setIndices(indices) {
        check(this._id == boundDrawcallId, 'bind drawcall first!');

        if (indices) {
            indices.buffer.bind();
            this._indicesType = indices.type;
            this._indicesOffset = indices.byteOffset ? indices.byteOffset : 0;
        }
        else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            this._indicesType = 0;
        }
        
        return this;
    }

    setFlag(name, value) {
        if (this.flags[name] && this.flags[name] == value) return this;
        this.flags[name] = value;
        this._needGenShaderKey = true;
        return this;
    }

    getShaderKey() {
        if (this._needGenShaderKey) {
            this._shaderKey = '';
            for (const attribName in this.attribs) {
                this._shaderKey += attribName;
            }
            for (const flagName in this.flags) {
                this._shaderKey += `${flagName}${this.flags[flagName]}`;
            }
            this._needGenShaderKey = false;
        }
        
        return this._shaderKey;
    }

    getShaderMacros() {
        let ret = '';
        for (const attribName in this.attribs) {
            ret += `#define USE_ATTRIB${attribName.replace(/(^[a-z][a-z]?|[A-Z][A-Z]?)/g, '_$1').toUpperCase()} 1\n`;
        }
        for (const flagName in this.flags) {
            ret += `#define ${flagName} ${this.flags[flagName]}\n`;
        }
        return ret;
    }

    submit() {
        this.bind();

        if (this._indicesType) {
            gl.drawElements(this._primType, this.vertexCount, this._indicesType, this._indicesOffset);
        }
        else {
            gl.drawArrays(this._primType, 0, this.vertexCount);
        }
    }

    unbind() {
        gl.bindVertexArray(null);
        boundDrawcallId = -1;
        return this;
    }

    destory() {
        gl.deleteVertexArray(this._vao);
    }
}

// texture
let genTextureId = 0;
let boundTextureId = -1;

const TextureType = {
    TEX_2D: gl.TEXTURE_2D,
    TEX_CUBE: gl.TEXTURE_CUBE_MAP
};

// todo: depth stencil
const PixelFormat = {
    PIXEL_R: 0,
    PIXEL_RGB: 1,
    PIXEL_RGBA: 2,
    PIXEL_R16F: 3,
    PIXEL_RGB16F: 4,
    PIXEL_RGBA16F: 5,
    PIXEL_R11G11B10F: 6,
    PIXEL_DEPTH: 7,
};

const FilterType = {
    FILTER_POINT: 0,
    FILTER_BILINEAR: 1,
    FILTER_TRILINEAR: 2,
    FILTER_ANISO: 3
};

const WarpType = {
    WARP_REPEAT: gl.REPEAT,
    WARP_MIRRORED: gl.MIRRORED_REPEAT,
    WARP_CLAMP: gl.CLAMP_TO_EDGE
};

const format2DataFormat = [
    isWebGL2 ? gl.RED : gl.LUMINANCE, gl.RGB, gl.RGBA,
    isWebGL2 ? gl.RED : gl.LUMINANCE, gl.RGB, gl.RGBA,
    gl.RGB, gl.DEPTH_COMPONENT
];

const format2SizedFormat = [
    gl.R8, gl.RGB8, gl.RGBA8,
    gl.R16F, gl.RGB16F, gl.RGBA16F,
    gl.R11F_G11F_B10F, gl.DEPTH_COMPONENT24
];

class Texture {
    constructor(textureType, sRGB = false) {
        this.width = -1;
        this.height = -1;
        this.tex = gl.createTexture();
        this._target = textureType;
        this._id = genTextureId++;
        this._isReady = false;
        this.sRGB = sRGB;// todo
    }

    bind(slot = 7) {
        gl.activeTexture(gl.TEXTURE0 + slot);
        gl.bindTexture(this._target, this.tex);
        boundTextureId = this._id;
        return this;
    }

    setData(width, height, format, data) {
        check(this._id == boundTextureId, 'bind texture first!');
        this.width = width;
        this.height = height;
        this.isPowerOf2 = isPowerOf2(width) && isPowerOf2(height);

        let dataFormat = format2DataFormat[format];
        let dataType = format == PixelFormat.PIXEL_DEPTH ? gl.UNSIGNED_INT : (format > 2 ? gl.FLOAT : gl.UNSIGNED_BYTE);

        if (this._target == gl.TEXTURE_2D) {// texture 2d
            if (isWebGL2) {
                gl.texImage2D(this._target, 0, format2SizedFormat[format], width, height, 0, dataFormat, dataType, data);
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
                gl.texImage2D(this._target, 0, dataFormat, width, height, 0, dataFormat, dataType, data);
            }
        }
        else {// texture cube
            if (isWebGL2) {
                for (let i = 0; i < 6; ++i) {
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, format2SizedFormat[format], width, height, 0, dataFormat, dataType, data ? data[i] : null);
                }
            }
            else {
                for (let i = 0; i < 6; ++i) {
                    if (dataType == gl.FLOAT) {// no sized format on webgl, we convert float array to half array. is there a better way?
                        if (data && data[i]) {
                            let halfData = new Uint16Array(data[i].length);
                            for (let j = 0; j < halfData.length; ++i) {
                                halfData[j] = toHalf(data[i][j]);
                            }
                            data[i] = halfData;
                        }
                    }
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, dataFormat, width, height, 0, dataFormat, dataType == gl.FLOAT ? gl.HALF_FLOAT : dataType, data ? data[i] : null);
                }
            }
        }
        
        this._isReady = true;
        return this;
    }

    setImage(img) {
        check(this._id == boundTextureId, 'bind texture first!');
        check(this._target == gl.TEXTURE_2D);
        this.width = img.width;
        this.height = img.height;
        this.isPowerOf2 = isPowerOf2(img.width) && isPowerOf2(img.height);

        gl.texImage2D(this._target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        this._isReady = true;
        return this;
    }

    setGLSampler(min, mag, warpS, warpT, warpR) {
        check(this._isReady, 'set texture data first!');
        check(this._id == boundTextureId, 'bind texture first!');

        if (!isWebGL2 && !this.isPowerOf2) {
            if (min != gl.NEAREST) min = gl.LINEAR;
            warpS = gl.CLAMP_TO_EDGE;
        }

        if (
            min == gl.NEAREST_MIPMAP_NEAREST || min == gl.LINEAR_MIPMAP_NEAREST ||
            min == gl.NEAREST_MIPMAP_LINEAR  || min == gl.LINEAR_MIPMAP_LINEAR
        ) {
            gl.generateMipmap(this._target);
        }

        gl.texParameteri(this._target, gl.TEXTURE_MIN_FILTER, min);
        gl.texParameteri(this._target, gl.TEXTURE_MAG_FILTER, mag);
        // warp
        gl.texParameteri(this._target, gl.TEXTURE_WRAP_S, warpS);
        gl.texParameteri(this._target, gl.TEXTURE_WRAP_T, warpT);
        if (isWebGL2 && (this._target == gl.TEXTURE_CUBE_MAP)) gl.texParameteri(this._target, gl.TEXTURE_WRAP_R, warpR);
        return this;
    }

    setSampler(filter = FilterType.FILTER_BILINEAR, warp = WarpType.WARP_CLAMP) {
        // filter
        let min = gl.NEAREST;
        let mag = gl.NEAREST;
        switch (filter) {
            case FilterType.FILTER_POINT:
                break;
            case FilterType.FILTER_ANISO:
                if (hasFilterAnisotropic) {
                    const maxAnisotropy = gl.getParameter(gl.MAX_TEXTURE_MAX_ANISOTROPY);
                    gl.texParameterf(this._target, gl.TEXTURE_MAX_ANISOTROPY, maxAnisotropy);
                }
            case FilterType.FILTER_TRILINEAR:
                min = gl.LINEAR_MIPMAP_LINEAR;
                mag = gl.LINEAR;
                break;
            case FilterType.FILTER_BILINEAR:
            default:
                min = gl.NEAREST;
                mag = gl.LINEAR;
                break;
        }

        return this.setGLSampler(min, mag, warp, warp, warp);
    }

    genMipmap() {
        check(this._isReady, 'set texture data first!');
        check(this._id == boundTextureId, 'bind texture first!');
        gl.generateMipmap(this._target);
        return this;
    }

    destory() {
        gl.deleteTexture(this.tex);
    }
}

// render target
let genRenderTargetId = 0;
let boundRenderTargetId = -1;

class RenderTarget {
    constructor() {
        this._id = genRenderTargetId++;
        this._fbo = gl.createFramebuffer();
    }

    bind() {
        if (boundRenderTargetId != this._id) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
            boundRenderTargetId = this._id;
        }
        return this;
    }

    setColorAttachments(attachments) {
        check(this._id == boundRenderTargetId, 'bind render target first!');
        let attachPoint = 0;
        let drawBuffers = [];
        for (const attachment of attachments) {
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachPoint,
                attachment.face != undefined ? (gl.TEXTURE_CUBE_MAP_POSITIVE_X + attachment.face) : gl.TEXTURE_2D,
                attachment.texture.tex,
                attachment.level ? attachment.level : 0
            );
            drawBuffers.push(gl.COLOR_ATTACHMENT0 + attachPoint++);
        }
        if (isWebGL2) gl.drawBuffers(drawBuffers);
        // because ios doesn't support WEBGL_draw_buffers, so close mrt for webgl1
        else if (drawBuffers.length > 1) error('mrt not supported!');

        return this;
    }

    setDepthAttachment(attachment) {
        check(this._id == boundRenderTargetId, 'bind render target first!');
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, attachment.texture.tex, 0);

        return this;
    }

    clear(clearColor, clearDepth) {
        check(this._id == boundRenderTargetId, 'bind render target first!');
        if (clearColor) {
            clearDepth ? gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) : gl.clear(gl.COLOR_BUFFER_BIT);
        }
        else if (clearDepth) gl.clear(gl.DEPTH_BUFFER_BIT);
        return this;
    }

    unbind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        boundRenderTargetId = -1;
        return this;
    }

    destory() {
        gl.deleteFramebuffer(this._fbo);
    }
}

// shader
const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
let genShaderId = 0;
let boundShaderId = -1;

class Shader {
    constructor(vsSrc, fsSrc, attribs) {
        this._id = genShaderId++;
        this._program = gl.createProgram();
        this._uniforms = {};
        this._textures = {};

        if (attribs) {
            let attribId = 0;
            for (const attribName in attribs) {
                gl.bindAttribLocation(this._program, attribId++, attribName);
            }
        }
        
        const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
        gl.attachShader(this._program, vs);
        gl.attachShader(this._program, fs);
        gl.linkProgram(this._program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);

        if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
            error(gl.getProgramInfoLog(this._program));
        }
        else {// shader compiled successfully
            let allocateTextureSlot = 0;
            const uniformsCount = gl.getProgramParameter(this._program, gl.ACTIVE_UNIFORMS);
            for (let i = 0; i < uniformsCount; ++i) {
                const info = gl.getActiveUniform(this._program, i);
                const loc = gl.getUniformLocation(this._program, info.name);
                this._uniforms[info.name] = {
                    size: info.size,
                    type: info.type,
                    loc: loc
                };
                if (info.type == gl.SAMPLER_2D || info.type == gl.SAMPLER_CUBE) {
                    this.bind();
                    gl.uniform1i(loc, allocateTextureSlot);
                    this._textures[info.name] = allocateTextureSlot++;
                }
            }
            check(allocateTextureSlot <= maxTextureUnits, 'too many texture binding!');
        }
    }

    bind() {
        if (boundShaderId != this._id) {
            gl.useProgram(this._program);
            boundShaderId = this._id;
        }
        return this;
    }

    _setParameter(name, value) {
        const uniform = this._uniforms[name];
        if (value != undefined && uniform) {
            const loc = uniform.loc;
            const size = uniform.size;
            switch (uniform.type) {
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
                // maybe textures should be bound more frequently?
                case gl.SAMPLER_2D:
                case gl.SAMPLER_CUBE:
                    value.bind(this._textures[name]);
                    break;
                default:
                    check(false, 'should never go here!');
                    break;
            }
            return true;
        }
        return false;
    }

    setParameters(params) {
        check(boundShaderId == this._id, 'bind shader first!');

        for (const name in params) {
            this._setParameter(name, params[name]);
        }
    }

    destory() {
        gl.deleteProgram(this._program);
    }
}

// render pass
let genRenderPassId = 0;
let boundRenderPassId = -1;

const DepthFunc = {
    ZTEST_NEVER: gl.NEVER,
    ZTEST_LESS: gl.LESS,
    ZTEST_EQUAL: gl.EQUAL,
    ZTEST_LEQUAL: gl.LEQUAL,
    ZTEST_GREATER: gl.GREATER,
    ZTEST_NOTEQUAL: gl.NOTEQUAL,
    ZTEST_GEQUAL: gl.GEQUAL,
    ZTEST_ALWAYS: gl.ALWAYS
};

const BlendFunc = {
    BLEND_OPAQUE: 0,
    BLEND_TRANSLUCENT: 1,
    // todo
    //BLEND_ADDICTIVE: 2,
};

const CullFace = {
    FACE_NONE: 0,
    FACE_FRONT: 1,
    FACE_BACK: 2
};

let curCullFace = CullFace.FACE_BACK;
let curDepthFunc = DepthFunc.ZTEST_LEQUAL;
let curBlendFunc = BlendFunc.BLEND_OPAQUE;
let curDepthWrite = true;
let curColorWrite = 0xF;

class RenderPass {
    constructor(name) {
        this.name = name;
        this._id = genRenderPassId++;

        this._isReady = false;
        
        this._shaderMap = {};
        this._shaderParams = {};
        this._shaderFlags = {};

        this._viewport = null;// follow canvas size
        this._cullFace = CullFace.FACE_BACK;
        this._depthFunc = DepthFunc.ZTEST_LEQUAL;
        this._blendFunc = BlendFunc.BLEND_OPAQUE;
        this._depthWrite = true;
        this._colorWrite = 0xF;

        this._needLoadColor = true;
        this._needLoadDepth = true;
    }

    setShaderSource(vsSrc, fsSrc) {
        this._vsSrc = vsSrc;
        this._fsSrc = fsSrc;
        this._isReady = true;
    }

    setViewport(x, y, width, height) {
        this._viewport = [ x, y, width, height ];
        return this;
    }

    setCullFace(cullFace) {
        this._cullFace = cullFace;
        return this;
    }

    setDepthFunc(func) {
        this._depthFunc = func;
        return this;
    }

    setBlendFunc(func) {
        this._blendFunc = func;
        return this;
    }

    setDepthWrite(enabled) {
        this._depthWrite = enabled;
        return this;
    }

    setColorWrite(writeMask) {
        this._colorWrite = writeMask;
        return this;
    }

    // true means load
    setLoadAction(colorAction, depthAction) {
        this._needLoadColor = colorAction;
        this._needLoadDepth = depthAction;
        return this;
    }

    setShaderFlag(name, value) {
        // must set before execute!
        for (const key in this._shaderMap) check(false, `already has shader ${key}!`);
        this._shaderFlags[name] = value;
        return this;
    }

    setShaderParameters(params) {
        if (!this._isReady) return this;

        for (const shaderName in this._shaderMap) {
            this._shaderMap[shaderName].bind().setParameters(params);
        }
        Object.assign(this._shaderParams, params);
        return this;
    }

    getShaderMacros() {
        let ret = isWebGL2 ? '#define WEBGL2_CONTEXT 1\n' : '#define WEBGL2_CONTEXT 0\n';
        for (const flagName in this._shaderFlags) {
            ret += `#define ${flagName} ${this._shaderFlags[flagName]}\n`;
        }
        return ret;
    }

    execute(drawcallList, renderTarget) {
        check(boundRenderPassId == -1, 'must be outside begin/end pair!');
        if (!this._isReady) return false;

        const err = gl.getError();
        if (err != gl.NO_ERROR) {
            error(`error ${err} caught before render pass <${this.name}>!`);
        }

        boundRenderPassId = this._id;
        // viewport
        if (this._viewport) gl.viewport(...this._viewport);
        else gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // cull face
        if (this._cullFace != curCullFace) {
            if (this._cullFace == CullFace.FACE_NONE) gl.disable(gl.CULL_FACE);
            else {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(this._cullFace == CullFace.FACE_BACK ? gl.BACK : gl.FRONT);
            }
            curCullFace = this._cullFace;
        }
        // depth func
        if (this._depthFunc != curDepthFunc) {
            gl.depthFunc(this._depthFunc);
            curDepthFunc = this._depthFunc;
        }
        // blend func
        if (this._blendFunc != curBlendFunc) {
            if (this._blendFunc == BlendFunc.BLEND_OPAQUE) gl.disable(gl.BLEND);
            else {
                gl.enable(gl.BLEND);
                if (this._blendFunc == BlendFunc.BLEND_TRANSLUCENT) gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                else error('unsupported blend func!');// todo: more blend func
            }
            curBlendFunc = this._blendFunc;
        }
        // write mask
        if (this._depthWrite != curDepthWrite) {
            gl.depthMask(this._depthWrite);
            curDepthWrite = this._depthWrite;
        }
        if (this._colorWrite != curColorWrite) {
            gl.colorMask(this._colorWrite & 0x8, this._colorWrite & 0x4, this._colorWrite & 0x2, this._colorWrite & 0x1);
            curColorWrite = this._colorWrite;
        }
        // render target
        let clearColor = !this._needLoadColor;
        let clearDepth = !this._needLoadDepth;
        if (renderTarget) {
            renderTarget.bind().clear(clearColor, clearDepth);
        }
        else {// use default framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            boundRenderTargetId = -1;
            if (clearColor) {
                clearDepth ? gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) : gl.clear(gl.COLOR_BUFFER_BIT);
            }
            else if (clearDepth) gl.clear(gl.DEPTH_BUFFER_BIT);
        }

        // handle drawcall
        for (const drawcall of drawcallList) {
            let shader = this._shaderMap[drawcall.getShaderKey()];
            if (!shader) {
                const macros = this.getShaderMacros() + drawcall.getShaderMacros();
                const vsSrc = macros + this._vsSrc;
                const fsSrc = macros + this._fsSrc;
                shader = new Shader(vsSrc, fsSrc, drawcall.attribs);
                shader.bind().setParameters(this._shaderParams);
                this._shaderMap[drawcall.getShaderKey()] = shader;
            }
            // set per drawcall parameters
            shader.bind().setParameters(drawcall.parameters);
            drawcall.submit();
        }

        // finish
        gl.bindVertexArray(null);
        boundDrawcallId = -1;
        boundRenderPassId = -1;
        return true;
    }

    destory() {// what about async?
        for (const shaderName in this._shaderMap) {
            this._shaderMap[shaderName].destory();
        }
        this._shaderMap = {};
    }
}

class RenderContext {
    constructor() {
        Object.assign(this,
            DataType,
            BufferType,
            PrimitiveType,
            TextureType,
            PixelFormat,
            FilterType,
            WarpType,
            DepthFunc,
            BlendFunc,
            CullFace
        );

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(curDepthFunc);
        if (curCullFace == CullFace.FACE_NONE) gl.disable(gl.CULL_FACE);
        else {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(curCullFace == CullFace.FACE_BACK ? gl.BACK : gl.FRONT);
        }
    }

    getCanvas() {
        return gl.canvas;
    }

    // buffer
    createVertexBuffer() {
        return new Buffer(BufferType.BUFFER_VERTEX);
    }

    createIndexBuffer() {
        return new Buffer(BufferType.BUFFER_INDEX);
    }

    // drawcall
    createDrawcall(primitiveType, vertexCount) {
        return new Drawcall(primitiveType, vertexCount);
    }

    // texture
    createTexture(textureType) {
        return new Texture(textureType);
    }

    createTextureFromUrl(url, filter = FilterType.FILTER_BILINEAR, warp = WarpType.WARP_REPEAT, sRGB = false, callback = null) {
        let tex = new Texture(TextureType.TEX_2D, sRGB);
        if (url.endsWith('.hdr')) {
            assetUtils.loadHDRImage(url, (hdri) => {
                tex.bind().setData(hdri.width, hdri.height, PixelFormat.PIXEL_RGB16F, hdri.data).setSampler(filter, warp);
                if (callback) callback(tex);
            });
        }
        else {
            assetUtils.loadImage(url, (img) => {// any async problem here?
                tex.bind().setImage(img).setSampler(filter, warp);
                if (callback) callback(tex);
            });
        }
        return tex;
    }

    // render target
    createRenderTarget() {
        return new RenderTarget();
    }

    // render pass
    createRenderPassFromSourcePath(name, vsPath, fsPath, callback = null) {
        let renderPass = new RenderPass(name);
        assetUtils.loadVertexShaderAndFragmentShader(vsPath, fsPath, (vsSrc, fsSrc) => {
            renderPass.setShaderSource(vsSrc, fsSrc);
            if (callback) callback(renderPass);
        });
        return renderPass;
    }
}

const renderContext = new RenderContext();

export { renderContext }

