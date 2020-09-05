varying vec2 vUV;

uniform sampler2D uTestTex;

void main() {
    gl_FragColor = texture2D(uTestTex, vUV);
}