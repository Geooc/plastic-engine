// pp_common_vs.glsl: common vs for most post-processing

attribute vec2 aPos;
out vec2 vUV;

#ifdef USE_CUBEMAP_TEXCOORD
out vec3 vViewDir;
uniform mat4 uInvViewProj;
#endif

#ifdef KEEP_INPUT_ASPECT
out vec2 vKeepAspectUV;
uniform vec2 uInputSize;
uniform vec2 uBufferSize;
#endif

void main()
{
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 1.0, 1.0);
#ifdef USE_CUBEMAP_TEXCOORD
    vec4 viewCoord = uInvViewProj * gl_Position;
    vViewDir = normalize(viewCoord.xyz / viewCoord.w);
#endif

#ifdef KEEP_INPUT_ASPECT
    vec2 st = vUV - 0.5;// centered
    vec2 wh = uBufferSize / uInputSize;
    st *= wh / min(wh.x, wh.y);// keep aspect
    vKeepAspectUV = st + 0.5;
#endif
}

