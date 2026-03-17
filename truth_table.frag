#version 300 es 

precision lowp float;

uniform vec2 iResolution;

out vec4 finalColor;

#define NUM_VALUES 3u

uint extract_bit(uint i, uint num) {
  return (num >> i) % 2u;
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

int dither(int amount) {
  return max(1 - ((int(gl_FragCoord.x * gl_FragCoord.y) % amount)), 0);
}

bool p(bool a, bool b, bool c) {
  return a && (b != c);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.y;
  uv *= float(1u << NUM_VALUES);
  uvec2 iCoord = uvec2(uv);

  vec4 table = vec4(extract_bit(iCoord.x, iCoord.y));
  vec4 border = vec4(dither(2));
  float grid = near(fract(uv.x - 0.5) + 0.5, 1.0, 20.0)
             + near(fract(uv.y - 0.5) + 0.5, 1.0, 20.0);

  vec4 value = vec4(p(bool(extract_bit(0u, iCoord.y)),
                      bool(extract_bit(1u, iCoord.y)),
                      bool(extract_bit(2u, iCoord.y))));

  finalColor = mix(value, table, step(float(iCoord.x), float(NUM_VALUES)));
  finalColor = mix(finalColor, border, grid);
}