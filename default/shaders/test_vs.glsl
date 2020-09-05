varying vec2 vUV;

uniform mat4 uView;
uniform mat4 uProj;

void main() {
    vUV = aUV;
    gl_Position = uProj * uView * vec4(aVertexPosition, 1.0);
}