// pp_final_fs.glsl: final pass
#if !WEBGL2_CONTEXT
#extension GL_EXT_shader_texture_lod : enable
#define textureCubeLod textureCubeLodEXT
#endif

precision highp float;

varying vec2 vUV;
varying vec3 vViewDir;
varying vec2 vKeepAspectUV;
uniform samplerCube uBackGround;
uniform sampler2D uBRDF;

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

void main() {
    gl_FragColor = textureCubeLod(uBackGround, normalize(vViewDir), 0.);
    gl_FragColor.rgb = LinearToSrgb(ACESToneMapping(gl_FragColor.rgb, 2.));
	gl_FragColor.a = 1.0;

	//vec2 extent = abs(vKeepAspectUV - 0.5);
	//gl_FragColor = max(extent.x, extent.y) <= 0.5 ? texture2D(uBRDF, vKeepAspectUV) : vec4(0.0);
}

