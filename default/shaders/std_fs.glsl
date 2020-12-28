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

uniform samplerCube uIrradianceMap;

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
    mat3 tbn = mat3(normalize(vT), normalize(vB), normalize(vN));
    vec3 worldNormal = tbn * matParams.normal;

    vec3 irradiance = textureCube(uIrradianceMap, worldNormal).rgb;
    vec3 radiance = vec3(0.0);// todo

    vec3 diffuse = matParams.baseColor * INV_PI * irradiance;
    vec3 specular = vec3(0.0);// todo

    gl_FragColor.rgb = diffuse;

    gl_FragColor.rgb = LinearToSrgb(ACESToneMapping(gl_FragColor.rgb, 1.));
    gl_FragColor.a = 1.0;
}

