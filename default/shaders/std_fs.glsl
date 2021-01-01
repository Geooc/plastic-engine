#if !WEBGL2_CONTEXT
#extension GL_EXT_shader_texture_lod : enable
#define textureCubeLod textureCubeLodEXT
#endif

precision highp float;

#define PI 3.14159265359
#define INV_PI 0.318309886

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
varying vec3 vT;
varying vec3 vB;
varying vec3 vN;
varying vec3 vV;

uniform samplerCube uIrradianceMap;
uniform samplerCube uRadianceMap;
uniform sampler2D uBRDF;

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

vec3 ACESToneMapping(vec3 color, float adapted_lum)
{
	const float A = 2.51;
	const float B = 0.03;
	const float C = 2.43;
	const float D = 0.59;
	const float E = 0.14;

	color *= adapted_lum;
	return (color * (A * color + B)) / (color * (C * color + D) + E);
}

float sRGBToLinear( float Color ) 
{
	Color = max(6.10352e-5, Color); // minimum positive non-denormal (fixes black problem on DX11 AMD and NV)
	return Color > 0.04045 ? pow( Color * (1.0 / 1.055) + 0.0521327, 2.4 ) : Color * (1.0 / 12.92);
}

vec3 sRGBToLinear( vec3 Color )
{
    Color.r = sRGBToLinear(Color.r);
    Color.g = sRGBToLinear(Color.g);
    Color.b = sRGBToLinear(Color.b);
    return Color;
}

float LinearToSrgb(float lin) 
{
	if(lin < 0.00313067) return lin * 12.92;
	return pow(lin, (1.0/2.4)) * 1.055 - 0.055;
}

vec3 LinearToSrgb(vec3 Color)
{
	Color.r = LinearToSrgb(Color.r);
	Color.g = LinearToSrgb(Color.g);
	Color.b = LinearToSrgb(Color.b);
	return Color;
}

MaterialParameters GetMaterialParameters(vec2 uv) {
    MaterialParameters params;
#if USE_BASECOLOR_TEX
    params.baseColor = sRGBToLinear(texture2D(uBaseColorTex, uv).rgb);
#else
    params.baseColor = uBaseColorFactor;
#endif
#if USE_NORMAL_TEX
    params.normal = normalize(texture2D(uNormalTex, uv).xyz * 2.0 - 1.0);
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
    mat3 tbn = mat3(normalize(vT), normalize(vB), normalize(vN));

    vec3 V = normalize(vV);
    vec3 N = tbn * normalize(matParams.normal);
    //N=normalize(vN);
    vec3 R = reflect(-V, N);
    float NoV = max(dot(N, V), 0.0);

    vec3 irradiance = textureCube(uIrradianceMap, N).rgb;
    vec3 radiance = textureCubeLod(uRadianceMap, R, matParams.roughness * 6.).rgb;
    vec2 brdf = texture2D(uBRDF, vec2(NoV, matParams.roughness)).rg;

    vec3 f0 = vec3(0.04);
    vec3 diffuseColor = matParams.baseColor * INV_PI * (1. - matParams.metallic);
    vec3 specularColor = mix(f0, matParams.baseColor, matParams.metallic);

    vec3 diffuse = diffuseColor * irradiance;
    vec3 specular = (specularColor * brdf.x + brdf.y) * radiance;

    gl_FragColor.rgb = diffuse + specular + matParams.emissive;

    gl_FragColor.rgb = LinearToSrgb(ACESToneMapping(gl_FragColor.rgb, 2.));
    gl_FragColor.a = 1.0;
}

