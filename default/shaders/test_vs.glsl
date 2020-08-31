precision mediump float;

attribute vec3 aVertexPosition;
attribute vec2 aUV;

varying vec2 vUV;

uniform mat4 uView;
uniform mat4 uProj;

void main() {
    vUV = aUV;
    gl_Position = uProj * uView * vec4(aVertexPosition, 1.0);
}