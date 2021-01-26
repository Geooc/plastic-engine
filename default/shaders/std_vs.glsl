attribute vec4 aLocalPosition;
attribute vec3 aNormal;
attribute vec3 aTangent;
attribute vec2 aUV0;
attribute vec2 aUV1;
attribute vec2 aUV2;
attribute vec4 aJoints;
attribute vec4 aWeights;

#ifdef USE_ATTRIB_A_UV0
out vec2 vUV;
#endif
out vec3 vT;
out vec3 vB;
out vec3 vN;
out vec3 vV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uInvView;
uniform sampler2D uAnimTex;
uniform vec2 uAnimInfo;

#ifdef USE_ATTRIB_A_JOINTS
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
#ifdef USE_ATTRIB_A_UV0
    vUV = aUV0;
#endif

#ifdef USE_ATTRIB_A_JOINTS
    mat4 finalTransform = calcAnimatedTransform();
#else
    mat4 finalTransform = uModel;
#endif
    vec4 worldPos = finalTransform * vec4(aLocalPosition.rgb, 1.0);
    gl_Position = uProj * uView * worldPos;

    vec4 camPos = uInvView * vec4(0., 0., 0., 1.0);
    vV = normalize(camPos.xyz/camPos.w - worldPos.xyz/worldPos.w);
    
    vT = normalize(vec3(finalTransform * vec4(aTangent, 0.0)));
    vN = normalize(vec3(finalTransform * vec4(aNormal, 0.0)));
    // re-orthogonalize T with respect to N
    vT = normalize(vT - dot(vT, vN) * vN);
    vB = cross(vT, vN);
}