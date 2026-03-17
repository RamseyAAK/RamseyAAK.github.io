#version 300 es

#define TAU 6.2831853071795864769252867

precision lowp float;

uniform vec2 iResolution;

out vec4 finalColor;

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

vec4 accum(vec4 colA, vec4 colB) {
  return vec4(((colA.xyz * colA.w) + (colB.xyz * colB.w)) / (colA.w + colB.w), (colA.w + colB.w));
}

bool set(vec2 uv, vec2 center, float radius, vec3 color) {
  finalColor = accum(finalColor, vec4(color, 0.7) * near(distance(center, uv), radius, 100.0));
  finalColor = accum(finalColor, vec4(color, 0.2) * smoothstep(radius + 0.01, radius - 0.01, distance(center, uv)));
  return distance(center, uv) < radius;
}

vec2 radial_point(float angle, float radius) {
  return vec2((sin(angle * TAU) * radius) + 0.5, (cos(angle * TAU) * radius) + 0.5);
}

void main() {
  finalColor = vec4(0.0001);
  vec2 uv = gl_FragCoord.xy / iResolution.y;
  bool A = set(uv, radial_point(0.000, 0.18), 0.25, vec3(0.6, 0.2, 0.4));
  bool B = set(uv, radial_point(0.333, 0.18), 0.25, vec3(0.2, 0.6, 0.4));
  bool C = set(uv, radial_point(0.666, 0.18), 0.25, vec3(0.4, 0.2, 0.6));
  if  (A && (B != C)) {
    finalColor = vec4(1.0);
  }
}

