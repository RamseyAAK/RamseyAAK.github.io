#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

#define TAU 6.2831853071795864769252867
#define PI 3.1415926535897932384626
#define SCALE iSlider;

float norm_cos(float angle) {
  return (1.0 + cos(TAU * angle)) / 2.0;
}

float norm_sin(float angle) {
  return (1.0 + sin(TAU * angle)) / 2.0;
}

bool within(float tolerance, float a, float b) {
  return abs(a - b) < tolerance;
}

float near(float a, float b, float sharpness) {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - vec2(iDrag * 2)) / iResolution.y;
  uv -= 0.5;
  uv *= 2.0;
  uv *= SCALE;

  float dist = sqrt(uv.x * uv.x + uv.y * uv.y);
  float angle = atan(uv.x, uv.y) / PI;

  float centric = dist;
        centric = fract(centric);
        centric = near(centric, 0.0, 1.0);

  float radial = angle;
        radial = fract(radial);
        radial = near(radial, 0.0, 1.0);

  float grad = mod(uv.x, pow(2.0, floor(uv.y)));
  finalColor = vec4(near(grad, 0.0, 100.0));

  // finalColor = vec4(centric, radial, 0.0, 1.0);

  // float value1 = angle * dist;
  // value1 = fract(value1);
  // float value2 = dist / angle;
  // value2 = fract(value2);

  // float value1 = uv.x / uv.y;
  // value1 = abs(fract(value1));
  // float value2 = uv.y * uv.x;
  // value2 = abs(fract(value2));

  // float value3 = near(value1, value2, 1.0);
  // finalColor = vec4(vec3(value3), 1.0);

  // float value = 0.0;
  // if (within(0.01, value2, 0.0)) {
  //   value = 1.0;
  // }
  // finalColor = vec4(vec3(value), 1.0);

  // float value = 0.0;
  // if (within(0.01, fract(uv.x), 0.0)) {
  //   value = 1.0;
  // }
  // if (uv.y > 0.1 && within(0.01, fract(uv.x * 2.0), 0.0)) {
  //   value = 0.5;
  // }

  // float value1 = (1.0 + sin(TAU * dist / angle)) / 2.0;
  // float value2 = (1.0 + sin(TAU * angle * dist)) / 2.0;
  // float value3 = near(value1, value2, 1.0);

  // float value1 = norm_sin(uv.x * uv.y);
  // float value2 = norm_sin(uv.x / uv.y);
  // float value3 = near(value1, value2, 1.0);

  // finalColor = vec4(vec3(value3), 1.0);
}