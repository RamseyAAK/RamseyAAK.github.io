#version 300 es 
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;

out vec4 finalColor;

float fAnd(float a, float b) {
  return a * b;
}

float fNot(float a) {
  return 1.0 - a;
}

float fOr(float a, float b) {
  return (a + b) - (a * b);
}

float fIfThen(float a, float b) {
  return fOr(fNot(a), b);
}

float fIFF(float a, float b) {
  return fAnd(fIfThen(a, b), fIfThen(b, a));
}

float fXOR(float a, float b) {
  return fNot(fIFF(a, b));
}

int dither(int amount) {
  return max(1 - ((int(gl_FragCoord.x * gl_FragCoord.y) % amount)), 0);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

vec3 near(vec3 a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

float var_spread(float u) {
  float var = fract(4.0 * u);
  float seg = floor(4.0 * u);
  if (seg <= 1.0) {
    return seg;
  } else if (seg == 2.0) {
    return fNot(var);
  } else {
    return var;
  }
}

float highlight(float x) {
  float hl = float(dither(2));
  return mix(x, hl, near(x, iSlider, 40.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.y;
  float A = uv.x;
  float B = uv.y;
  // float C = iSlider;

  float resultA = fAnd(var_spread(A), var_spread(B));
  float resultO = fIfThen(var_spread(A), var_spread(B));
  float resultI = fXOR(var_spread(A), var_spread(B));
  vec3 result = vec3(highlight(resultA), highlight(resultO), highlight(resultI));
  finalColor = vec4(result, 1.0);
}