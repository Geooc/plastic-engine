precision highp float;
varying vec2 vUV;

uniform sampler2D uSceneColor;
uniform sampler2D uDepth;

void main()
{
    gl_FragColor = vec4((texture2D(uDepth, vUV).rgb), 1.0);
}