#ifdef USE_ATTRIB_VEC2_A_UV0
varying vec2 vUV;
#endif

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform sampler2D uAnimTex;
uniform vec2 uAnimInfo;

#ifdef USE_ATTRIB_VEC4_A_JOINTS
mat4 getMixedJointMatrix(float jointId) {
    vec4 pixel0 = texture2D(uAnimTex, vec2((jointId * 3.0 + 0.5) / uAnimInfo.x, uAnimInfo.y));
    vec4 pixel1 = texture2D(uAnimTex, vec2((jointId * 3.0 + 1.5) / uAnimInfo.x, uAnimInfo.y));
    vec4 pixel2 = texture2D(uAnimTex, vec2((jointId * 3.0 + 2.5) / uAnimInfo.x, uAnimInfo.y));
    
    return mat4(
        pixel0.x, pixel0.y, pixel0.z, 0.0,
        pixel0.w, pixel1.x, pixel1.y, 0.0,
        pixel1.z, pixel1.w, pixel2.x, 0.0,
        pixel2.y, pixel2.z, pixel2.w, 1.0
    );
}

mat4 calcAnimatedTransform() {
    return
        getMixedJointMatrix(aJoints.x) * aWeights.x +
        getMixedJointMatrix(aJoints.y) * aWeights.y +
        getMixedJointMatrix(aJoints.z) * aWeights.z +
        getMixedJointMatrix(aJoints.w) * aWeights.w;
}
#endif

void main() {
    #ifdef USE_ATTRIB_VEC2_A_UV0
    vUV = aUV0;
    #endif

    #ifdef USE_ATTRIB_VEC4_A_JOINTS
    mat4 finalTransform = calcAnimatedTransform();
    #else
    mat4 finalTransform = uModel;
    #endif
    gl_Position = uProj * uView * finalTransform * vec4(aLocalPosition, 1.0);
}