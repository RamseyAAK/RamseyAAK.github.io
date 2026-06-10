#version 300 es

precision lowp float;

uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

// vec3 pos_col = vec3(1.0, 0.7, 0.5);
// vec3 neg_col = vec3(0.7, 0.5, 1.0);

vec3 pos_col = vec3(0.0, 1.0, 0.0);
vec3 neg_col = vec3(1.0, 0.0, 0.0);

vec3 mix3(vec3 colH, vec3 colM, vec3 colL, float v) {
  if (v >= 0.0) {
    return mix(colM, colH, v);
  } else {
    return mix(colM, colL, -v);
  }
}

void main() {
  vec4 value = texelFetch(buff, ivec2(gl_FragCoord.xy), 0);
  float height = value.x;
  float velo = value.y - value.x;

  finalColor = vec4(mix3(pos_col, vec3(0.0), neg_col, pow(abs(height), 0.5) * sign(height)), 1.0);

  // finalColor = vec4(mix(neg_col, pos_col, (height + 1.0) / 2.0), 1.0);

  // finalColor = vec4(vec3(mix(0.0, 1.0, (height + 1.0) / 2.0)), 1.0);

  finalColor.z = value.z;
}