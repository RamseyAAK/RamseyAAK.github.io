#version 300 es 

precision lowp float;

uniform ivec2 iDrag;
uniform float iSlider;

out vec4 finalColor;

uint extract_bit(uint i, uint num) {
  return (num >> i) % 2u;
}

void main() {
  uvec2 iCoord = uvec2(gl_FragCoord.xy) - uvec2(0u, 2 * iDrag.y) + uvec2(0u, iSlider * float((1 << 31) - 1));
  finalColor = vec4(extract_bit(iCoord.x, iCoord.y));
}