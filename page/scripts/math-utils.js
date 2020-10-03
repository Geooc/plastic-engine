const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const quat = glMatrix.quat;

let mathUtils = {
    degreeToRadian : function(degree) {
        return degree / 180 * Math.PI;
    },
    
    calcPerspectiveProjMatrix : function(fovy, aspect, near, far) {
        return mat4.perspective(mat4.create(), this.degreeToRadian(fovy), aspect, near, far);
    },
    
    calcLookAtViewMatrix : function(eye, at, up) {
        return mat4.lookAt(mat4.create(), eye, at, up);
    },
    
    calcOrbitViewMatrix : function(pitch, yaw, radius, at) {
        let x = this.degreeToRadian(pitch);
        let y = this.degreeToRadian(yaw);
        let eye = [
            Math.cos(y) * Math.cos(x),
            Math.sin(y),
            Math.cos(y) * Math.sin(x)
        ];
        vec3.scale(eye, eye, radius);
        vec3.add(eye, eye, at);
    
        return this.calcLookAtViewMatrix(eye, at, [0, 1, 0]);
    },
    
    calcTransform : function(translate, rotation, scale) {
        return mat4.fromRotationTranslationScale(mat4.create(), rotation ? rotation : [0, 0, 0, 1], translate ? translate : [0, 0, 0], scale ? scale : [1, 1, 1]);
    },
    
    mulMatrices : function(m0, m1) {
        return mat4.multiply(mat4.create(), m0, m1);
    },
    
    identityMatrix : function() {
        return mat4.create();
    },

    lerpVector : function(vector0, vector1, k) {
        return vec3.lerp(vec3.create(), vector0, vector1, k);
    },

    slerpQuat : function(quat0, quat1, k) {
        return quat.slerp(quat.create(), quat0, quat1, k);
    }
};

export { mathUtils }