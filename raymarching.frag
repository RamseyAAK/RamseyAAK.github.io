#version 300 es
#define MAX_STEPS 300
#define MAX_DIST 100.
#define SURFACE_DIST .005
#define PI 3.14159265358979

precision lowp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

float nsin(float num) {
  return (sin(num * 2.0 * PI) + 1.)/2.0;
}

float ncos(float num) {
  return (cos(num * 2.0 * PI) + 1.0)/2.0;
}

vec2 Circling(float f) {
  return vec2(nsin(iTime/f),ncos(iTime/f));
}

mat2 Rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float DistPlaneY(vec3 p) {
  return p.y - 0.2 * sin(p.x) - 0.2 * cos(p.z);
}

float DistSphere(vec4 sph, vec3 p) {
  return length(p-sph.xyz)-sph.w;
}

float DistCapsule(vec3 a, vec3 b, float r, vec3 p) {
  vec3 ap = p-a;
  vec3 ab = b-a;
  float t = dot(ap,ab)/dot(ab,ab);
  t = clamp(t, 0.0, 1.0);
  vec3 c = a + t * ab;
  return length(p-c)-r;
}

float DistTorus(vec3 to, float r1, float r2, vec3 p) {
  float x = length(p.xz - to.xz) - r1;
  return length(vec2(x,p.y - to.y)) - r2;
}

float DistBox(vec3 bo, vec3 bsz, vec3 p) {
  return length(max(abs(p - bo) - bsz, 0.0));
}

float GetDist1(vec3 p) {
  return max( DistSphere(vec4(0,1.5, 5.3, 0.5),p) * -1.0
            , (abs(DistSphere(vec4(0, 1, 6, 0.9),p)) - 0.2) );
}

float GetDist2(vec3 p) {
  return mix( DistSphere(vec4(-2.0, 2.0, 6.5, 1), p)
            , DistBox(vec3(-2.0, 2.0, 6.5), vec3(0.5, 0.5, 0.5), p)
            , Circling(6.0).x );
}

float GetDist3(vec3 p) {
  vec3 ddp = p;
  ddp -= vec3(-3, 1.2, 5.4);
  ddp.xz = Rot(iTime*PI/3.)*ddp.xz;
  
  return max( DistSphere(vec4(0.2, 0.0, 0.0, 0.6), ddp)
            , DistSphere(vec4(-0.2, 0.0, 0.0, 0.6), ddp) );
}

float GetDist(vec3 p) {
  float dp = DistPlaneY(p);

  float d = min(dp, GetDist1(p));
  d = min(d, GetDist2(p));
  d = min(d, GetDist3(p));
  return d;
}

vec3 GetNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  float d = GetDist(p);
  vec3 n = d - vec3(
              GetDist(p - e.xyy),
              GetDist(p - e.yxy),
              GetDist(p - e.yyx));
  return normalize(n);
}

float RayMarch(vec3 ro, vec3 rd) {
  float dO = 0.0;
  for (int i=0; i < MAX_STEPS; i++) {
    vec3 p = ro + dO * rd;
    float dS = GetDist(p);
    dO += dS;
    if (dS<SURFACE_DIST || abs(dO) > MAX_DIST) break;
  }
  return dO;
}

float Light(vec3 lo, vec3 so, vec3 sn) {
  vec3 ld = normalize(lo-so);
  float l = dot(ld, sn);
  if (RayMarch(so + sn*SURFACE_DIST*1.1, ld) < length(lo-so)) l *= 0.2;
  return l;
}

bool within(float tolerance, float a, float b) {
  return abs(a - b) < tolerance;
}

bool near(float a, float b) {
  return within(0.000001, a, b);
}

void main() {

  vec2 uv = (gl_FragCoord.xy / iResolution.y) - 0.5;

  vec3 ro = vec3( (float(-iDrag.x) / 124.0) - 0.5 + Circling(12.0).x
                , (float(-iDrag.y) / 124.0) + 3.0 + 0.6 * Circling(6.0).x
                , iSlider * 10.0 - 6.0 );
  vec3 rd = normalize(vec3(uv.x-.25,uv.y-.3,1));

  float d = RayMarch(ro,rd);
  vec3 lo = vec3(5.*Circling(8.).x+0.5,5.*Circling(8.).y+2.,3);
  vec3 so = ro + d * rd;
  vec3 sn = GetNormal(so);

  d /= MAX_DIST;

  vec3 l = vec3(Light(lo,so,sn));
  
  vec4 col = vec4(l,1.0);
  if(d >= 1.) col = vec4(0.);
  if(near(GetDist(so), GetDist1(so))) {
    col *= vec4(1.,0.,0.,1.);
  }
  if(near(GetDist(so), GetDist2(so))) {
     col *= vec4(0.,1.,0.,1.);
  }
  if(near(GetDist(so), GetDist3(so))) {
     col *= vec4(0.,0.,1.,1.);
  }

  finalColor = vec4(col);
}