#version 300 es 
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;
uniform float iTime;

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

float highlight(float x) {
  float hl = float(dither(2));
  float t = iTime / 6.0;
  float scrolling = 
    ((int(t) % 2) == 0) ? fract(t) : fNot(fract(t));
  return mix(x, hl, near(x, scrolling, 80.0));
}

float carosel(float x, float a, float b) {
  int c = int(x * 8.0);
  if (c == 0) { return highlight(fAnd(a, b)); }
  if (c == 1) { return highlight(fOr(a, b)); }
  if (c == 2) { return highlight(fIfThen(a, b)); }
  if (c == 3) { return highlight(fIFF(a, b)); }
  if (c == 4) { return highlight(fXOR(a, b)); }
  if (c == 5) { return highlight(fAnd(a, fNot(a))); }
  if (c == 6) { return highlight(fOr(a, fNot(a))); }
  if (c == 7) { return highlight(fIFF(a, fNot(a))); }
  if (c == 8) { return highlight(fXOR(a, fNot(a))); }
}



void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.y;
  float A = uv.x;
  float B = uv.y;

  finalColor = vec4(carosel(iSlider, A, B));
}