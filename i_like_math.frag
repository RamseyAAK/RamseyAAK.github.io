#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

#define TAU 6.2831853071795864769252867
#define SCALE iSlider * 10.0;

float norm_sin(float angle) {
  return (1.0 + sin(TAU * angle)) / 2.0;
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - vec2(iDrag * 2)) / iResolution.y;
  uv -= 0.5;
  uv *= 2.0;
  uv *= SCALE;

  float value1 = norm_sin(uv.x * uv.y);
  float value2 = norm_sin(uv.x / uv.y);
  float value3 = near(value1, value2, 1.0);

  finalColor = vec4(value3);
}