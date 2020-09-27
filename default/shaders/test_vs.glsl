#ifdef USE_ATTRIB_VEC2_A_UV0
varying vec2 vUV;
#endif

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

void main() {
    #ifdef USE_ATTRIB_VEC2_A_UV0
    vUV = aUV0;
    #endif
    gl_Position = uProj * uView * uModel * vec4(aLocalPosition, 1.0);
}