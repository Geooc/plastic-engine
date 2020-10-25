
varying vec3 vViewDir;
uniform mat4 uInvViewProj;

void main()
{
    vec4 ndcCoord = vec4(aPos, 0.0, 1.0);
    vec4 viewCoord = uInvViewProj * ndcCoord;
    vViewDir = (viewCoord.xyz / viewCoord.w);
    gl_Position = ndcCoord;
}