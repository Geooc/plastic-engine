// brdf_lut_fs.glsl

#define PI 3.14159265359
#define INV_PI 0.318309886

in vec2 vUV;

float geometryGGX(float NoV, float a)
{
    // http://graphicrants.blogspot.com.au/2013/08/specular-brdf-reference.html
    // Schlick-Beckmann G.
    float k = a *.5;
    return NoV / (NoV * (1.0 - k) + k);
}

float fresnel(float VoH)
{
    return pow(1.0-VoH, 5.);
}

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

vec3 importanceSampleGGX(vec2 Xi, float a, vec3 N)
{
    float Phi = 2. * PI * Xi.x;
    float CosTheta = sqrt((1. - Xi.y) / (1. + (a*a - 1.) * Xi.y));
    float SinTheta = sqrt(1. - CosTheta * CosTheta);

    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;

    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0., 0., 1.) : vec3(1., 0., 0.);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);

    return TangentX * H.x + TangentY * H.y + N * H.z;
}

vec2 integrate(float roughness, float NoV)
{
    vec3 N = vec3(0.0, 0.0, 1.0);
    vec3 V = vec3(sqrt(1.0 - NoV * NoV), 0.0, NoV);
    vec2 result = vec2(0.,0.);

    const int NumSamples = 1024;

    float a = roughness * roughness;

    float Vis = geometryGGX(NoV, a);

    for (int i = 0; i < NumSamples; i++)
    {
        vec2 Xi = Hammersley(i, NumSamples);
        vec3 H = importanceSampleGGX(Xi, a, N);
        vec3 L = 2.0 * dot(V, H) * H - V;

        float NoL = clamp(L.z, 0., 1.);
        float NoH = clamp(H.z, 0., 1.);
        float VoH = clamp(dot(V, H), 0., 1.);
        float NoV = clamp(dot(N, V), 0., 1.);
        if (NoL > 0.)
        {
            float G = geometryGGX(NoL, a) * Vis;
            float F = fresnel(VoH);
            float GVis = G *  VoH / (NoH * NoV);
            result.x += (1. - F) * GVis;
            result.y += F * GVis;
        }
    }

    return result / float(NumSamples);
}

void main()
{
    outColor = vec4(integrate(vUV.y, vUV.x), 0.0, 0.0);
}

