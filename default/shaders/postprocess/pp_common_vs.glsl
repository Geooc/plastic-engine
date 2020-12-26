// pp_common_vs.glsl: common vs for most post-processing

precision highp float;

attribute vec2 aPos;
varying vec2 vUV;

#ifdef USE_CUBEMAP_TEXCOORD
varying vec3 vViewDir;
uniform mat4 uInvViewProj;
#endif

void main()
{
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 1.0, 1.0);
#ifdef USE_CUBEMAP_TEXCOORD
    vec4 viewCoord = uInvViewProj * gl_Position;
    vViewDir = normalize(viewCoord.xyz / viewCoord.w);
#endif
}

