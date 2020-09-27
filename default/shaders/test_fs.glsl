#ifdef USE_ATTRIB_VEC2_A_UV0
varying vec2 vUV;
#endif

uniform sampler2D uTestTex;

void main() {
    #ifdef USE_ATTRIB_VEC2_A_UV0
    gl_FragColor = vec4(vUV, 0.5, 1.0);
    #else
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    #endif
}