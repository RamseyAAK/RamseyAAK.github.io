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

@group(0) @binding(0) var<uniform> numParticles: u32;
@group(0) @binding(1) var<uniform> iResolution: vec2u;
@group(0) @binding(2) var<uniform> iParticleSize: f32;
@group(0) @binding(3) var<uniform> numEdges: u32;
@group(1) @binding(0) var<storage> newState: array<i32>;
@group(1) @binding(1) var<storage, read_write> oldState: array<atomic<i32>>;
@group(2) @binding(0) var<storage> edges: array<vec2u>;

fn toPos(i: vec2i) -> vec2f {
  return vec2f(i) / f32(1 << 26);
}

fn getNewState(i: u32) -> vec2f {
  return toPos(vec2i(newState[3*i], newState[3*i + 1]));
}

fn getOldState(i: u32) -> vec2f {
  return toPos(vec2i(atomicLoad(&oldState[3*i]), atomicLoad(&oldState[3*i + 1])));
}

fn fromPos(f: vec2f) -> vec2i {
  return vec2i(f * f32(1 << 26));
}

fn setPos(i: u32, pos: vec2f) {
  let toStore = fromPos(pos);
  atomicStore(&oldState[3*i + 0], toStore.x);
  atomicStore(&oldState[3*i + 1], toStore.y);
  atomicStore(&oldState[3*i + 2], 1);
}

//-------------------------------------------------------------------------------

const triangle = mat3x2f(vec2f(-1, -1),
                         vec2f(-1,  3),
                         vec2f( 3, -1));

@vertex
fn vertexNode(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.uv = triangle[in.vi];
  out.pos = vec4f(iParticleSize * triangle[in.vi] + getNewState(in.instance), 0, 1);
  out.id = in.instance;
  return out;
}

//-------------------------------------------------------------------------------

@vertex
fn vertexEdge(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let node1 = getNewState(edges[in.instance].x);
  let node2 = getNewState(edges[in.instance].y);

  let l = normalize(node2 - node1);
  let w = vec2f(-l.y, l.x);

  // manually assign 6 vertex points to points of a quad
  switch ((in.vi % 3) + (in.vi / 3)) {
    default {
      out.pos = vec4f(node1 - (w * iParticleSize / 4), 0, 1);
      out.uv = vec2f(-1, -1);
    }
    case 1 {
      out.pos = vec4f(node1 + (w * iParticleSize / 4), 0, 1);
      out.uv = vec2f(1, -1);
    }
    case 2 {
      out.pos = vec4f(node2 - (w * iParticleSize / 4), 0, 1);
      out.uv = vec2f(-1, 1);
    }
    case 3 {
      out.pos = vec4f(node2 + (w * iParticleSize / 4), 0, 1);
      out.uv = vec2f(1, 1);
    }
  }
  out.id = edges[in.instance].x;
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
fn computeNodes(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < numParticles) {
    var nextPos = getNewState(id.x);

    // Gravity
    // nextPos += -0.0005 * normalize(nextPos);

    // Boundries
    nextPos = clamp(nextPos, vec2f(-1 + iParticleSize), vec2f(1 - iParticleSize));

    // Integrate
    nextPos += 0.99 * (nextPos - getOldState(id.x));

    // Collide
    var count = 1.0;
    var avg = nextPos;
    for (var i: u32 = 0; i < numParticles; i++) {
      if (i == id.x) { continue; }
      let diff = getNewState(i) - nextPos;
      let len = length(diff);
      avg += nextPos - ((diff * 0.001)/(len * len));
      count += 1;
    }
    nextPos = avg/count;

    // Set
    setPos(id.x, nextPos);
  }
}

//-------------------------------------------------------------------------------

@compute @workgroup_size(32)
fn computeEdges(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < numEdges) {
    let node1 = getOldState(edges[id.x].x);
    let node2 = getOldState(edges[id.x].y);

    let center = (node1 + node2) / 2.0;
    let norm = normalize(node2 - node1);

    let new1 = fromPos(center - (norm * iParticleSize * 2.0));
    let new2 = fromPos(center + (norm * iParticleSize * 2.0));

    atomicAdd(&oldState[3*(edges[id.x].x) + 0], new1.x);
    atomicAdd(&oldState[3*(edges[id.x].x) + 1], new1.y);
    atomicAdd(&oldState[3*(edges[id.x].x) + 2], 1);

    atomicAdd(&oldState[3*(edges[id.x].y) + 0], new2.x);
    atomicAdd(&oldState[3*(edges[id.x].y) + 1], new2.y);
    atomicAdd(&oldState[3*(edges[id.x].y) + 2], 1);
  }
}

//-------------------------------------------------------------------------------

@compute @workgroup_size(32)
fn consolidate(@builtin(global_invocation_id) id: vec3u) {
  setPos(id.x, getOldState(id.x) / f32(atomicLoad(&oldState[3*id.x + 2])));
}