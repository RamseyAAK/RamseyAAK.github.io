#version 300 es 
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;

#define SCALE (iSlider * 12.0)

out vec4 finalColor;

float hexDist(vec2 p) {
  p = abs(p);

  float c = dot(p, normalize(vec2(1.0,sqrt(3.0))));
  c = max(c, p.x);

  return c;
}

vec4 hexUVs(vec2 uvIn) {
  vec2 r = vec2(1.0, sqrt(3.0));
  vec2 h = r * 0.5;

  vec2 uv1 = mod(uvIn, r) - h;
  vec2 uv2 = mod(uvIn - h, r) - h;

  if (length(uv1) < length(uv2)) {
    return vec4(uv1, uvIn - uv1);
  } else {
    return vec4(uv2, uvIn - uv2);
  }
}

void main () {

  vec2 uv = (gl_FragCoord.xy / iResolution.y);
  uv *= SCALE;

  vec4 huv = hexUVs(uv);

  finalColor = vec4(huv.zw / SCALE, 0.0, smoothstep(0.4, 0.41, hexDist(huv.xy)));
}