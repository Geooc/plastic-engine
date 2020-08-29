const canvas = document.querySelector('#glcanvas');
const gl = canvas.getContext('webgl');
if (!gl) alert('Your browser or machine may not support webgl.');

class WebGLContext {
    constructor() {
        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.blendFunc(gl.SRC_SLPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    getCanvas() {
        return canvas;
    }

    clearColor() {
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    clearDepth() {
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    clearColorAndDepth() {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    setViewport(x, y, width, height) {
        gl.viewport(x, y, width, height);
    }

}

export { WebGLContext }