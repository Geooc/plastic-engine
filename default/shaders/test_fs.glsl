#ifdef USE_ATTRIB_VEC2_A_UV0
varying vec2 vUV;
#endif

uniform sampler2D uBaseColorTex;
uniform sampler2D uNormalTex;

void main() {
    #ifdef USE_ATTRIB_VEC2_A_UV0
    gl_FragColor = texture2D(uBaseColorTex, vUV);
    #else
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    #endif
}