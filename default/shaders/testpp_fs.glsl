precision highp float;
varying vec2 vUV;

uniform mat4 uInvViewProj;
uniform samplerCube uCubemap;
uniform sampler2D uSceneColor;
uniform vec2 uScreenSize;
uniform vec2 uSize;

void main()
{
    // can be done in vs shader
    vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
    vec2 st = uv - 0.5;                 // centered
    vec2 wh = uScreenSize / uSize;
    st *= wh / min(wh.x, wh.y);         // keep aspect
    uv = st + 0.5;

    vec4 viewCoord = uInvViewProj * vec4((vUV - 0.5) * 2.0, 1.0, 1.0);
    vec3 viewDir = - normalize(viewCoord.xyz / viewCoord.w);

    //gl_FragColor = texture2D(uSceneColor, uv);

    gl_FragColor = textureCube(uCubemap, viewDir);
}