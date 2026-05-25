#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

vec4 measure(ivec2 coord) {
  ivec2 res = ivec2(iResolution);
  if ((coord.x >= res.x || coord.x < 0) ||
      (coord.y >= res.y || coord.y < 0)    ) {
    return vec4(0.0);
  } else {
    return texelFetch(buff, coord, 0);
  }
}

const mat3 laplacian = mat3( 
  0.05, 0.2, 0.05,
  0.2, -1.0, 0.2,
  0.05, 0.2, 0.05
);

const mat3 v_edge = mat3(
  0.15, 0.0, 0.15,
  0.2, -1.0, 0.2,
  0.15, 0.0, 0.15
);

const mat3 h_edge = mat3(
  0.15, 0.2, 0.15,
  0.0, -1.0, 0.0,
  0.15, 0.2, 0.15
);

vec4 convolute(ivec2 coord, mat3 kernel) {
  vec4 result = vec4(0.0);

  for (int i = 0; i < 3; ++i) {
    for (int j = 0; j < 3; ++j) {
      result += kernel[i][j] * measure(ivec2(j - 1, i - 1) + coord);
    }
  }

  return result;
}

float greyscale(vec4 color) {
  return (color.x + color.y + color.z) / 3.0;
}

void main() {
  float v = abs(greyscale(convolute(ivec2(gl_FragCoord), v_edge)));
  float h = abs(greyscale(convolute(ivec2(gl_FragCoord), h_edge)));
  float c = abs(greyscale(convolute(ivec2(gl_FragCoord), laplacian)));
  finalColor = 3.0 * vec4(v, h, c, 1.0);
  // finalColor = vec4(vec3(0.5) + (3.0 * convolute(ivec2(gl_FragCoord), laplacian).xyz), 1.0);
}