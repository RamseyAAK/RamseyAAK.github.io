#version 300 es
precision lowp float;

uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

void main() {
  
  float x = ceil(-float(2 * iDrag.x) * iSlider) + ceil(gl_FragCoord.x * iSlider);
  float y = ceil(-float(2 * iDrag.y) * iSlider) + ceil(gl_FragCoord.y * iSlider);

  float xy = abs(x/y);
  vec3 col = vec3(abs(xy - floor(xy + 0.5)));

  if (abs(xy - floor(xy + 0.5)) <= .00001) {
    col = vec3(0.000, 0.630, 0.630);
  }

  if (abs(xy - mod(y,x)) < 1.0) {
    col = vec3(0.183, 0.730, 0.000);
  }

  if (floor(xy) == ceil(xy)) {
    col = vec3(0.995, 0.249, 0.746);
  }

  if (xy == mod(y,x)) {
    col = vec3(1.000, 0.000, 0.000);
  }

  finalColor = vec4(col, 1.0);
}