#version 300 es 
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;

out vec4 finalColor;

float conj_dot(float a, float b) {
  return a * b;
}

float implication(float a, float b) {
  return min(1.0, b / a);
}

float negation(float a) {
  return implication(a, 0.0);
}

float conj_wedge(float a, float b) {
  return conj_dot(a, implication(a, b));
  // return min(a, b);
}

int dither(int amount) {
  return max(1 - ((int(gl_FragCoord.x * gl_FragCoord.y) % amount)), 0);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution;
  float A = uv.x;
  float B = uv.y;
  // float C = iSlider;

  float result = conj_wedge(A, B);
  finalColor = vec4(mix(result, float(dither(2)), near(result, iSlider, 80.0)));
}