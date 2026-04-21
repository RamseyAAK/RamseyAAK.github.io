#version 300 es 
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

int dither(int amount) {
  return max(1 - ((int(gl_FragCoord.x * gl_FragCoord.y) % amount)), 0);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

void main() {
  float d = ((gl_FragCoord.x - float(iDrag.x)) / iResolution.x) * (iSlider/2.0);

  finalColor = vec4(dither(int((1.0 / (d)))));
}