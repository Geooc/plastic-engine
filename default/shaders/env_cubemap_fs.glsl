
varying vec3 vViewDir;

uniform sampler2D uHDRI;
uniform mat4 uViewProj;

vec2 ViewVectorToUV(vec3 ViewVector)
{
    vec2 uv = vec2(atan(ViewVector.z, ViewVector.x), asin(ViewVector.y));
    uv *= vec2(0.1591, 0.3183);
    uv += 0.5;
    return uv;
}

void main()
{
    gl_FragColor = texture2D(uHDRI, ViewVectorToUV(normalize(vViewDir)));
}