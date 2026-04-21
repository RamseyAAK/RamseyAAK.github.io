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
@group(0) @binding(3) var<uniform> numEdges: u32;
@group(1) @binding(0) var<storage> newState: array<vec2i>;
@group(1) @binding(1) var<storage, read_write> oldState: array<vec2i>;
@group(2) @binding(0) var<storage> edges: array<vec2u>;

fn toPos(i: vec2i) -> vec2f {
  return vec2f(i) / (1 << 31);
}

fn getNewState(i: u32) -> vec2f {
  return toPos(newState[i]);
}

fn getOldState(i: u32) -> vec2f {
  return toPos(oldState[i]);
}

fn fromPos(f: vec2f) -> vec2i {
  return vec2i(f * (1 << 31));
}

fn setPos(i: u32, pos: vec2f) {
  oldState[i] = fromPos(pos);
}

//-------------------------------------------------------------------------------

const triangle = mat3x2f(vec2f(-1, -1),
                         vec2f(-1,  3),
                         vec2f( 3, -1));

@vertex
fn vertexMain(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.uv = triangle[in.vi];
  out.pos = vec4f(iParticleSize * triangle[in.vi] + getNewState(in.instance), 0, 1);
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
  out.color = vec4f(vec3f(light(sph, normalize(LIGHT_POS - (vec3f(getNewState(in.id), 0) + (sph * iParticleSize))))), 1);
  out.depth = 1 + sph.z;
  return out;
}

//-------------------------------------------------------------------------------

@compute @workgroup_size(32)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  var nextPos = getNewState(id.x);

  // Gravity
  nextPos += -0.0001 * normalize(nextPos);

  // Boundries
  nextPos = clamp(nextPos, vec2f(-1 + iParticleSize), vec2f(1 - iParticleSize));

  // Integrate
  nextPos += 0.99 * (nextPos - getOldState(id.x));

  // Collide
  var count = 1.0;
  var avg = nextPos;
  for (var i: u32 = 0; i < particles; i++) {
    if (i == id.x) { continue; }
    let diff = getNewState(i) - nextPos;
    let len = length(diff);
    if (len < (2 * iParticleSize)) {
      avg += nextPos - ((iParticleSize * 2) - len) * (diff/len);
      count += 1;
    }
  }
  nextPos = avg/count;

  // Set
  setPos(id.x, nextPos);
}

//-------------------------------------------------------------------------------

// @compute @workgroup_size(32)
// fn constraintEdges(@builtin(global_invocation_id) id: vec3u) {
//   if (id.x < edges) {
//     let node1 = getNewState(edg)
//   }
// }