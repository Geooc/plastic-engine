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

    calcOrbitViewRightAndUp : function(pitch, yaw) {
        let x = this.degreeToRadian(pitch);
        let y = this.degreeToRadian(yaw);
        let eye = [
            Math.cos(y) * Math.cos(x),
            Math.sin(y),
            Math.cos(y) * Math.sin(x)
        ];
        let front = vec3.create();
        vec3.negate(front, eye);
        let right = vec3.create();
        vec3.normalize(right, vec3.cross(right, front, [0, 1, 0]));
        let up = vec3.create();
        vec3.normalize(up, vec3.cross(up, right, front));
        return [ right, up ];
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

    addVector : function(vector0, vector1) {
        return vec3.add(vec3.create(), vector0, vector1);
    },

    subVector : function(vector0, vector1) {
        return vec3.sub(vec3.create(), vector0, vector1);
    },

    mulVector : function(vector0, vector1) {
        return vec3.mul(vec3.create(), vector0, vector1);
    },

    scaleVector : function(vector, scale) {
        return vec3.scale(vec3.create(), vector, scale);
    },

    lerpVector : function(vector0, vector1, k) {
        return vec3.lerp(vec3.create(), vector0, vector1, k);
    },

    slerpQuat : function(quat0, quat1, k) {
        return quat.slerp(quat.create(), quat0, quat1, k);
    }
};

export { mathUtils }