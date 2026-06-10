#version 300 es
precision lowp float;

uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

// left and bottom edges dissipate vibrations, other edges reflect (pinned to 0)
vec4 measure(ivec2 offset) {
  ivec2 pos = ivec2(gl_FragCoord) + offset;
  // if (pos.x < 0 || pos.y < 0 || pos.x >= int(iResolution.x) || pos.y >= int(iResolution.y)) {
  if (pos.x < 0 || pos.y < 0) {
    return texelFetch(buff, ivec2(gl_FragCoord), 0).yyzw;
  }
  return texelFetch(buff, pos, 0);
}

void main() {
  finalColor = measure(ivec2(0,0)).yxzw;
}