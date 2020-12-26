// pp_final_fs.glsl: final pass

precision highp float;

varying vec2 vUV;
varying vec3 vViewDir;
uniform sampler2D uInput;
uniform samplerCube uBackGround;

void main() {
    vec4 sceneColor = texture2D(uInput, vUV);
    gl_FragColor = sceneColor.a > 1e-05 ? sceneColor : textureCube(uBackGround, normalize(vViewDir));
}

