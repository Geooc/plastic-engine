varying vec2 vUV;

uniform sampler2D uTestTex;

void main() {
    //gl_FragColor = texture2D(uTestTex, vUV);
    gl_FragColor = vec4(vUV, 0.5, 1.0);
}