const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

function degreeToRadian(degree) {
    return degree / 180 * Math.PI;
}

function calcPerspectiveProjMatrix(fovy, aspect, near, far) {
    return mat4.perspective(mat4.create(), degreeToRadian(fovy), aspect, near, far);
}

function calcLookAtViewMatrix(eye, at, up) {
    return mat4.lookAt(mat4.create(), eye, at, up);
}

function calcOrbitViewMatrix(pitch, yaw, radius, at) {
    let x = degreeToRadian(pitch);
    let y = degreeToRadian(yaw);
    let eye = [
        Math.cos(y) * Math.cos(x),
        Math.sin(y),
        Math.cos(y) * Math.sin(x)
    ];
    vec3.scale(eye, eye, radius);
    vec3.add(eye, eye, at);

    return calcLookAtViewMatrix(eye, at, [0, 1, 0]);
}

function calcTransform(translate, rotation, scale) {
    return glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(), rotation ? rotation : [0, 0, 0, 1], translate ? translate : [0, 0, 0], scale ? scale : [1, 1, 1]);
}

function mulMatrices(m0, m1) {
    return glMatrix.mat4.multiply(glMatrix.mat4.create(), m0, m1);
}

function identityMat() {
    return glMatrix.mat4.create();
}

export { calcPerspectiveProjMatrix, calcLookAtViewMatrix, calcOrbitViewMatrix, calcTransform, mulMatrices, identityMat }