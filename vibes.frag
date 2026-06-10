#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iTime;
uniform ivec2 iMouse;
uniform uint iClick;
uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

bool get_bit(uint digit, uint value) {
  return ((value & (1u << digit)) >> digit) == 1u;
}

// looped space
// vec4 measure(ivec2 offset) {
//   ivec2 pos = ivec2(gl_FragCoord);
//   ivec2 res = ivec2(iResolution);
//   offset = ivec2(((pos + offset) + res) % res);
//   return texelFetch(buff, offset, 0);
// }

// edges are pinned to 0.0
vec4 measure(ivec2 offset) {
  ivec2 pos = ivec2(gl_FragCoord);
  // ivec2 res = ivec2(iResolution);
  // offset = ivec2(((pos + offset) + res) % res);
  return texelFetch(buff, pos + offset, 0);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

const mat3 laplacian = mat3(
  0.05, 0.2, 0.05,
  0.2, -1.0, 0.2,
  0.05, 0.2, 0.05
);

vec4 convolute(mat3 kernel) {
  vec4 result = vec4(0.0);

  for (int i = 0; i < 3; ++i) {
    for (int j = 0; j < 3; ++j) {
      result += kernel[i][j] * measure(ivec2(j - 1, i - 1));
    }
  }

  return result;
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.y;
  vec4 prev = measure(ivec2(0u));
  finalColor = prev; // comment out for strage result
  finalColor.z = prev.z; // persist weights
  finalColor.y = prev.x; // move last frame's current value into current frame's previous value
  finalColor.x += prev.x - prev.y; // apply velocity/momentum: integrate previous frame into current value
  finalColor.x += (0.5 * convolute(laplacian).x) / ((finalColor.z * 1.0) + 1.0);
  if (get_bit(0u, iClick)) {
    vec4 n = vec4(near(distance(mod(vec2(iMouse) / iResolution.y, 1.0), uv), 0.0, 10.0));
    n.z = 0.0;
    finalColor.xy = mix(finalColor, n, n.w).xy;
  } else if (get_bit(1u, iClick)) {
    finalColor.z += 0.01 * near(distance(mod(vec2(iMouse) / iResolution.y, 1.0), uv), 0.0, 10.0);
  }
  finalColor.w = 1.0;
}