struct VertexInput {
  @builtin(vertex_index) vi: u32,
  @builtin(instance_index) instance: u32
}

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) @interpolate(flat) id: u32
}

struct FragmentOutput {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32
}

@group(0) @binding(0) var<uniform> particles: u32;
@group(0) @binding(1) var<uniform> iResolution: vec2u;
@group(0) @binding(2) var<uniform> iParticleSize: f32;
@group(1) @binding(0) var<storage> newState: array<vec2f>;
@group(1) @binding(1) var<storage, read_write> oldState: array<vec2f>;
@group(2) @binding(0) var<uniform> mousePos: vec2f;
@group(2) @binding(1) var<uniform> clickState: u32;

//-------------------------------------------------------------------------------

const triangle = mat3x2f(vec2f(-1, -1),
                         vec2f(-1,  3),
                         vec2f( 3, -1));

@vertex
fn vertexMain(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.uv = triangle[in.vi];
  out.pos = vec4f(iParticleSize * triangle[in.vi] + newState[in.instance], 0, 1);
  out.id = in.instance;
  return out;
}

//-------------------------------------------------------------------------------

const LIGHT_POS = vec3f(0, 0, -1);

fn sphere_normal(uv: vec2f, r: f32) -> vec3f {
    let dist = length(uv);
    if (dist > r) { discard; }
    let z = -sqrt((r * r) - (dist * dist));
    let surface = normalize(vec3f(uv, z));
    return surface;
}

fn light(normal: vec3f, light: vec3f) -> f32 {
  return dot(normal, light);
}

@fragment
fn fragmentMain(in: VertexOutput) -> FragmentOutput {
  // if (abs(in.uv.x) > 1 || abs(in.uv.y) > 1) {
  //   discard;
  // }
  var out: FragmentOutput;
  let sph = sphere_normal(in.uv, 1.0);
  out.color = vec4f(vec3f(light(sph, normalize(vec3(mousePos, -0.5) - (vec3f(newState[in.id], 0) + (sph * iParticleSize))))), 1);
  out.depth = 1 + sph.z;
  return out;
}

//-------------------------------------------------------------------------------

@compute @workgroup_size(32)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  var nextPos = newState[id.x];

  // Gravity
  nextPos += -0.0001 * nextPos;

  // Boundries
  nextPos = clamp(nextPos, vec2f(-1 + iParticleSize), vec2f(1 - iParticleSize));

  // Integrate
  nextPos += 0.99 * (nextPos - oldState[id.x]);

  // Collide
  var count = 1.0;
  var avg = nextPos;
  for (var i: u32 = 0; i < particles; i++) {
    if (i == id.x) { continue; }
    let diff = newState[i] - nextPos;
    let len = length(diff);
    if (len < (2 * iParticleSize)) {
      avg += nextPos - ((iParticleSize * 2) - len) * (diff/len);
      count += 1;
    }
  }
  nextPos = avg/count;

  // Set
  if (((clickState & 1) == 1) && (length(mousePos - newState[id.x]) < iParticleSize)) {
    oldState[id.x] = mousePos;
  } else {
    oldState[id.x] = nextPos;
  }
}