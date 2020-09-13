varying vec2 vUV;

uniform mat4 uView;
uniform mat4 uProj;

void main() {
    vUV = aUV0;
    gl_Position = uProj * uView * vec4(aLocalPosition, 1.0);
}