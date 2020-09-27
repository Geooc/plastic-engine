const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

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
        return glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(), rotation ? rotation : [0, 0, 0, 1], translate ? translate : [0, 0, 0], scale ? scale : [1, 1, 1]);
    },
    
    mulMatrices : function(m0, m1) {
        return glMatrix.mat4.multiply(glMatrix.mat4.create(), m0, m1);
    },
    
    identityMatrix : function() {
        return glMatrix.mat4.create();
    },
};

export { mathUtils }