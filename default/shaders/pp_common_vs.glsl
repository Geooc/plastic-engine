precision highp float;

attribute vec2 aPos;
varying   vec2 vUV;

void main()
{
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 1.0, 1.0);
}