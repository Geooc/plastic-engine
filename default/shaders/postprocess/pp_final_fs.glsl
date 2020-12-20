// pp_final_fs.glsl: final pass

precision highp float;

varying vec2 vUV;
uniform sampler2D uInput;

void main() {
    gl_FragColor = texture2D(uInput, vUV);
}

