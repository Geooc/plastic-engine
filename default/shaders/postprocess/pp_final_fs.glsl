// pp_final_fs.glsl: final pass

precision highp float;

varying vec2 vUV;
varying vec3 vViewDir;
uniform sampler2D uInput;
uniform samplerCube uBackGround;

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

void main() {
    vec4 sceneColor = texture2D(uInput, vUV);
    gl_FragColor = sceneColor.a > 1e-05 ? sceneColor : textureCube(uBackGround, normalize(vViewDir));
    gl_FragColor.rgb = ACESToneMapping(gl_FragColor.rgb, 0.5);
}

