// irradiance_fs.glsl
#if !WEBGL2_CONTEXT
#extension GL_EXT_shader_texture_lod : enable
#define textureCubeLod textureCubeLodEXT
#endif

#define PI 3.14159265359
#define INV_PI 0.318309886

in vec3 vViewDir;

uniform samplerCube uHDRI;
uniform float uEnvResSqr;

const int ConvolutionSampleCount = 4096;

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

vec3 importanceSampleDiffuse(vec2 Xi, vec3 N )
{
    float CosTheta = 1.0-Xi.y;
    float SinTheta = sqrt(1.0-CosTheta*CosTheta);
    float Phi = 2.*PI*Xi.x;

    vec3 H;
    H.x = SinTheta * cos( Phi );
    H.y = SinTheta * sin( Phi );
    H.z = CosTheta;

    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0,0,1) : vec3(1,0,0);
    vec3 TangentX = normalize( cross( UpVector, N ) );
    vec3 TangentY = cross( N, TangentX );

    return TangentX * H.x + TangentY * H.y + N * H.z;
}

vec3 ImportanceSample (vec3 N)
{
    vec3 V = N;
    vec4 result = vec4(0.0);

    for(int i = 0; i < ConvolutionSampleCount; i++ )
    {
        vec2 Xi = Hammersley(i, ConvolutionSampleCount);
        vec3 H = importanceSampleDiffuse( Xi, N);
        vec3 L = normalize(2. * dot( V, H ) * H - V);
        float NoL = clamp(dot( N, L ), 0.0, 1.0);
        if (NoL > 0.0)
        {
            float pdf = max(0.0, dot(N, L) * INV_PI);
            
            float solidAngleTexel = 4. * PI / (6. * uEnvResSqr);
            float solidAngleSample = 1.0 / (float(ConvolutionSampleCount) * pdf);
            float lod = 0.5 * log2(solidAngleSample / solidAngleTexel);

            result += vec4(textureCubeLod(uHDRI, H, lod).rgb * NoL, 1.0);
        }
    }
    
    return result.xyz / result.w;
}

void main()
{
    outColor = vec4(ImportanceSample(normalize(vViewDir)), 1.0);
}

