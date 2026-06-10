#version 300 es

precision lowp float;

uniform vec2 iResolution;
// uniform float iSli-der;

uniform sampler2D buff;

layout(location=0) out vec4 finalColor;

// // reflected space
// vec4 measure(ivec2 coord) {
//   ivec2 res = ivec2(iResolution);
//   ivec2 flip = (coord / res) % 2;
//   coord = (coord % res) * (-2 * flip + 1) + res * flip;
//   return texelFetch(buff, coord, 0);
// }

float hexDist(vec2 p) {
  p = abs(p);

  float c = dot(p, normalize(vec2(1.0,sqrt(3.0))));
  c = max(c, p.x);

  return c;
}

// x and y is uv within a hex
// z and w is uv between hexes
vec4 hexUVs(vec2 uvIn) {
  vec2 r = vec2(1.0, sqrt(3.0));
  vec2 h = r * 0.5;

  vec2 uv1 = mod(uvIn, r) - h;
  vec2 uv2 = mod(uvIn - h, r) - h;

  uvIn *= vec2(1.0, 2.0 / sqrt(3.0));

  if (length(uv1) < length(uv2)) {
    return vec4(uv1, uvIn - uv1 - vec2(0.5, 0.0));
  } else {
    return vec4(uv2, uvIn - uv2);
  }
}

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
  vec2 uv = gl_FragCoord.xy;// * (iSli-der * 20.0);// / iResolution.xy;
  // uv *= 10.0;
  vec2 huv = hexUVs(uv).zw;
  huv *= vec2(1.0, iResolution.x / iResolution.y);

  ivec2 hex_coord = ivec2(round(huv));

  // testing that hexagons increment by whole numbers
  // finalColor = vec4(round(huv), 0.0, 1.0);

  // testing that hexagons are shaped correctly, and reach full extent of buffer
  // finalColor = vec4(huv / 10.0, 0.0, 1.0);
  // return;


  vec4 value = texelFetch(buff, hex_coord, 0);
  // vec4 value = measure(hex_coord); // reflected space
  float height = value.x;
  float velo = value.y - value.x;

  finalColor = vec4(mix3(pos_col, vec3(0.0), neg_col, pow(abs(height), 0.5) * sign(height)), 1.0);

  // finalColor = vec4(mix(neg_col, pos_col, (height + 1.0) / 2.0), 1.0);

  // finalColor = vec4(vec3(mix(0.0, 1.0, (height + 1.0) / 2.0)), 1.0);

  finalColor.z = value.z;
}