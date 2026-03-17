#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iTime;
uniform ivec2 iDrag;
uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

# define D_a  1.0
# define D_b  0.5
# define F    0.055
# define K    0.062
# define dT   1.0

vec4 measure(ivec2 coord) {
  ivec2 res = ivec2(iResolution);
  coord = ivec2((coord.x + res.x) % res.x, 
                (coord.y + res.y) % res.y);
  return texelFetch(buff, coord, 0);
}

// https://thebookofshaders.com/10/
float random (vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898,78.233))) * 43758.5453123);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

float near(vec2 a, vec2 b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, distance(a, b));
}

vec4 laplacian(ivec2 coord) {
  vec4 sum = vec4(0.0);
  sum += measure(coord + ivec2( 1, 0));
  sum += measure(coord + ivec2(-1, 0));
  sum += measure(coord + ivec2( 0, 1));
  sum += measure(coord + ivec2( 0,-1));
  sum *= 4.0;
  
  sum += measure(coord + ivec2(1,1));
  sum += measure(coord + ivec2(1,-1));
  sum += measure(coord + ivec2(-1,1));
  sum += measure(coord + ivec2(-1,-1));
  sum *= 1.0/20.0;
  
  return sum - measure(coord);
}

vec2 reactionDiffusion(ivec2 coord) {
  vec2 self = measure(coord).xy;
  vec2 lap = laplacian(coord).xy;
  
  float A = self.x + (dT * ((D_a * lap.x) - (self.x * self.y * self.y) + F * (1.0 - self.x)));
  float B = self.y + (dT * ((D_b * lap.y) + (self.x * self.y * self.y) - (self.y * (F + K))));

  return vec2(A,B);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  
  vec3 col = vec3(1.0,0.0,0.0);
  if (iTime < 0.1) {
    col.z = random(uv);
  } else if (iTime < 1.0) {
    col.z = measure(ivec2(gl_FragCoord.xy)).z + (laplacian(ivec2(gl_FragCoord.xy)).z * 0.5);
    col.y = smoothstep(0.5, 0.6, col.z);
  } else {
    col = vec3(reactionDiffusion(ivec2(gl_FragCoord)), 0.0);
    col.z = 0.0;
  }

  col.y += clamp(0.0, 1.0, near(distance(mod(vec2(2 * iDrag) / iResolution.y, 1.0), uv), 0.03, 100.0) / 50.0);
  
  finalColor = vec4(col.x, col.y, col.z, smoothstep(0.0, 0.2, col.y));
}