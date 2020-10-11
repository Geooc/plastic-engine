precision highp float;
varying vec2 vUV;

uniform sampler2D uSceneColor;
uniform vec2 uScreenSize;
uniform vec2 uSize;

void main()
{
    vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
    vec2 st = uv - 0.5;                 // centered
    vec2 wh = uScreenSize / uSize;
    st *= wh / min(wh.x, wh.y);         // keep aspect
    uv = st + 0.5;

    gl_FragColor = texture2D(uSceneColor, uv);
}