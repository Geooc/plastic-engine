// radiance_fs.glsl
#if !WEBGL2_CONTEXT
#extension GL_EXT_shader_texture_lod : enable
#define textureCubeLod textureCubeLodEXT
#endif

#define PI 3.14159265359
#define INV_PI 0.318309886

precision highp float;

varying vec3 vViewDir;

uniform samplerCube uHDRI;
uniform float uRoughness;

const int ConvolutionSampleCount = 512;

float reversebits(int n, int base)
{
    float invBase = 1.0 / float(base);
    float denom   = 1.0;
    float result  = 0.0;

    for(int i = 0; i < 32; ++i)
    {
        if(n > 0)
        {
            denom   = mod(float(n), 2.0);
            result += denom * invBase;
            invBase = invBase / 2.0;
            n       = int(float(n) / 2.0);
        }
    }

    return result;
}

vec2 Hammersley(int i, int N) 
{
    float ri = reversebits(i, 2);
    return vec2(float(i) / float(N), ri);
}

vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness)
{
    float a = roughness * roughness;
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    vec3 H;
    H.x = sinTheta * cos(phi);
    H.y = sinTheta * sin(phi);
    H.z = cosTheta;

    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);

    return TangentX * H.x + TangentY * H.y + N * H.z;
}
// GGX / Trowbridge-Reitz
float D_GGX(float roughness, float NoH)
{
	float a = roughness * roughness;
	float a2 = a * a;
	float d = (NoH * a2 - NoH) * NoH + 1.0;
	return a2 / (PI * d * d);
}

vec3 ImportanceSample (vec3 N)
{
    vec3 V = N;
    vec3 R = N;
    vec4 result = vec4(0.0);

    for(int i = 0; i < ConvolutionSampleCount; i++ )
    {
        vec2 Xi = Hammersley(i, ConvolutionSampleCount);
        vec3 H = ImportanceSampleGGX(Xi, N, uRoughness);
        vec3 L = normalize(2. * dot(V, H) * H - V);
        float NoL = clamp(dot(N, L), 0.0, 1.0);
        float NoH = clamp(dot(N, H), 0.0, 1.0);
        float VoH = clamp(dot(V, H), 0.0, 1.0);
        if (NoL > 0.0)
        {
            float D = D_GGX(uRoughness, NoH);
            float pdf = D * NoH / (4.0 * VoH);
            float solidAngleTexel = 4. * PI / (6. * 256. * 256.);
            float solidAngleSample = 1.0 / (float(ConvolutionSampleCount) * pdf);
            float lod = uRoughness == 0.0 ? 0.0 : 2.0 + 0.5 * log2(solidAngleSample / solidAngleTexel);

            result += vec4(textureCubeLod(uHDRI, L, lod).rgb, 1.0) * NoL;
        }
    }

    return result.xyz / result.w;
}

void main()
{
    gl_FragColor = vec4(ImportanceSample(normalize(vViewDir)), 1.0);
}

