// env_cubemap.glsl

in vec3 vViewDir;

uniform sampler2D uHDRI;

vec2 ViewVectorToUV(vec3 ViewVector)
{
    vec2 uv = vec2(atan(ViewVector.z, ViewVector.x), asin(ViewVector.y));
    uv *= vec2(0.1591, 0.3183);
    uv += 0.5;
    return uv;
}

void main()
{
    vec2 uv = ViewVectorToUV(normalize(vViewDir));
    uv.y = 1. - uv.y;// flip y
    outColor = min(texture2D(uHDRI, uv), 65504.);
}

