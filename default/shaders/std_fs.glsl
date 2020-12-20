precision highp float;

#ifndef USE_NORMAL_TEX
#define USE_NORMAL_TEX 0
#endif

#ifndef USE_EMISSIVE_TEX
#define USE_EMISSIVE_TEX 0
#endif

#ifndef USE_BASECOLOR_TEX
#define USE_BASECOLOR_TEX 0
#endif

#ifndef USE_METALROUGH_TEX
#define USE_METALROUGH_TEX 0
#endif

#ifdef USE_ATTRIB_A_UV0
varying vec2 vUV;
#endif

uniform sampler2D uBaseColorTex;
uniform sampler2D uNormalTex;
uniform sampler2D uMetalRoughTex;
uniform sampler2D uEmissiveTex;

uniform vec3 uBaseColorFactor;
uniform float uMetallicFactor;
uniform float uRoughnessFactor;
uniform vec3 uEmissiveFactor;

struct MaterialParameters {
    vec3 baseColor;
    vec3 normal;
    vec3 emissive;
    float metallic;
    float roughness;
    float ao;
};

MaterialParameters GetMaterialParameters(vec2 uv) {
    MaterialParameters params;
#if USE_BASECOLOR_TEX
    params.baseColor = texture2D(uBaseColorTex, uv).rgb;
#else
    params.baseColor = uBaseColorFactor;
#endif
#if USE_NORMAL_TEX
    params.normal = texture2D(uNormalTex, uv).xyz * 2.0 - 1.0;
#else
    params.normal = vec3(0.0, 0.0, 1.0);
#endif
#if USE_EMISSIVE_TEX
    params.emissive = texture2D(uEmissiveTex, uv).rgb;
#else
    params.emissive = uEmissiveFactor;
#endif
#if USE_METALROUGH_TEX
    vec3 arm = texture2D(uMetalRoughTex, uv).rgb;
    params.metallic = arm.z;
    params.roughness = arm.y;
    params.ao = arm.x;
#else
    params.metallic = uMetallicFactor;
    params.roughness = uRoughnessFactor;
    params.ao = 1.0;
#endif
    return params;
}

void main() {
#ifdef USE_ATTRIB_A_UV0
    MaterialParameters matParams = GetMaterialParameters(vUV);
#else
    MaterialParameters matParams = GetMaterialParameters(vec2(0.0, 0.0));
#endif
    gl_FragColor = vec4(matParams.baseColor, 1.0);
}

