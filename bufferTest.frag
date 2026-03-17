#version 300 es
precision lowp float;

uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

vec4 measure(ivec2 offset) {
  ivec2 res = ivec2(iResolution);
  ivec2 coord = ivec2(gl_FragCoord.xy) + offset;
  coord = ivec2((coord.x + res.x) % res.x, 
                (coord.y + res.y) % res.y);
  return texelFetch(buff, coord, 0);
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

float near(vec2 a, vec2 b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, distance(a, b));
}

void main() {
  if (iTime < 1.0) {
    finalColor = vec4(near(gl_FragCoord.xy, vec2(100.0, 100.0), 0.10));
  } else {
    finalColor = measure(ivec2(-1,-3));
  }
}