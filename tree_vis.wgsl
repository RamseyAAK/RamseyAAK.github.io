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

struct CNode {
  prev_x: f32,
  prev_y: f32,
  accum_x: f32,
  accum_y: f32,
  count: u32
}

struct Edge {
  a: u32,
  b: u32,
  color: u32
}

@group(0) @binding(0) var<uniform> numParticles: u32;
@group(0) @binding(1) var<uniform> iResolution: vec2u;
@group(0) @binding(2) var<uniform> iParticleSize: f32;
@group(0) @binding(3) var<uniform> numEdges: u32;
@group(1) @binding(0) var<storage, read_write> computeNodes: array<CNode>;
@group(1) @binding(1) var<storage> renderNodes: array<vec2f>;
@group(2) @binding(0) var<storage> edges: array<Edge>;

fn getNew(i: u32) -> vec2f {
  return renderNodes[i];
}

fn getOld(i: u32) -> vec2f {
  return vec2f(computeNodes[i].prev_x, computeNodes[i].prev_y);
}

fn getAccum(i: u32) -> vec2f {
  return vec2f(computeNodes[i].accum_x, computeNodes[i].accum_y);
}

fn getDisplay(i: u32) -> vec2f {
  return vec2f(renderNodes[i].x, renderNodes[i].y);
}

fn setPos(i: u32, v: vec2f) {
  computeNodes[i].accum_x = v.x;
  computeNodes[i].accum_y = v.y;
}

fn accum(i: u32, v: vec2f) {
  computeNodes[i].accum_x += v.x;
  computeNodes[i].accum_y += v.y;
  computeNodes[i].count += 1;
}

// fn consolidate(i: u32) {
//   var newPos = getAccum(i);
//   newPos /= f32(computeNodes[i].count);
//   computeNodes[i].accum_x = newPos.x;
//   computeNodes[i].accum_y = newPos.y;
//   computeNodes[i].count = 1;
// }

//-------------------------------------------------------------------------------
// VERTEX NODE

const triangle = mat3x2f(vec2f(-1, -1),
                         vec2f(-1,  3),
                         vec2f( 3, -1));

@vertex
fn vertexNode(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.uv = triangle[in.vi];
  out.pos = vec4f(iParticleSize * triangle[in.vi] + getDisplay(in.instance), 0, 1);
  out.id = in.instance;
  return out;
}
//-------------------------------------------------------------------------------
// VERTEX EDGE

@vertex
fn vertexEdge(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let node1 = getDisplay(edges[in.instance].a);
  let node2 = getDisplay(edges[in.instance].b);

  let l = normalize(node2 - node1);
  let w = vec2f(-l.y, l.x);

  // manually assign 4 quad points
  switch (in.vi) {
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
  out.id = edges[in.instance].a;
  return out;
}
//-------------------------------------------------------------------------------
// FRAGMENT

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
  out.color = vec4f(vec3f(light(sph, normalize(LIGHT_POS - (vec3f(getDisplay(in.id), 0) + (sph * iParticleSize))))), 1);
  out.depth = 1 + sph.z;
  return out;
}
//-------------------------------------------------------------------------------
// NODE CONSTRAINTS

const wgs = 32;
@compute @workgroup_size(wgs)
fn nodeConstraints(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < numParticles) {
    var nextPos = getNew(id.x);

    // Gravity
    nextPos += -0.0005 * normalize(nextPos);

    // Boundries
    nextPos = clamp(nextPos, vec2f(-1 + iParticleSize), vec2f(1 - iParticleSize));

    // Collide
    var count = 1.0;
    var avg = nextPos;
    for (var i: u32 = 0; i < numParticles; i++) {
      if (i == id.x) { continue; }
      let diff = getNew(i) - nextPos;
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
// INTEGRATE

// @compute @workgroup_size(wgs)
// fn integrate(@builtin(global_invocation_id) id: vec3u) {
//   if (id.x < numParticles) {
//     computeNodes[id.x].prev_x = computeNodes[id.x].x;
//     computeNodes[id.x].prev_y = computeNodes[id.x].y;
//     consolidate(id.x);
//     var preNew = getAccum(id.x);
//     preNew += 0.99 * (preNew - getNew(id.x));
//     computeNodes[id.x].x = preNew.x;
//     computeNodes[id.x].y = preNew.y;
//     computeNodes[id.x].accum_x = preNew.x;
//     computeNodes[id.x].accum_y = preNew.y;


//     // let tempNew = getNew(id.x);
//     // let newNew = getNew(id.x) + 0.99 * (getNew(id.x) - getOld(id.x));
//     // computeNodes[id.x].x = newNew.x;
//     // computeNodes[id.x].y = newNew.y;
//     // computeNodes[id.x].prev_x = tempNew.x;
//     // computeNodes[id.x].prev_y = tempNew.y;
//   }
// }
//-------------------------------------------------------------------------------
// EDGE CONSTRAINTS

// this method of collision avoidance restricts the number of edge 'colors'
// to the size of the workgroup 
var<workgroup> colorGroup: u32;
@compute @workgroup_size(wgs)
fn edgeConstriants(@builtin(global_invocation_id) id: vec3u) {
  if (id.x == 0u) {
    colorGroup = 0u;
  }

  for (var i = 0u; i < wgs; i++) {
    workgroupBarrier();
    if ((id.x < numEdges) && (edges[id.x].color == colorGroup)) {
      let node1 = getNew(edges[id.x].a);
      let node2 = getNew(edges[id.x].b);

      let center = (node1 + node2) / 2.0;
      let norm = normalize(node2 - node1);

      let new1 = center - (norm * iParticleSize * 2.3);
      let new2 = center + (norm * iParticleSize * 2.3);

      accum(edges[id.x].a, new1);
      accum(edges[id.x].b, new2);
    }
    if (id.x == 0u) {
      colorGroup++;
    }
  }
}

//-------------------------------------------------------------------------------
// CONSOLIDATE

// @compute @workgroup_size(wgs)
// fn consolidate(@builtin(global_invocation_id) id: vec3u) {
//   setPos(id.x, getAccum(id.x) / f32(oldState[id.x].count));
//   oldState[id.x].count = 1;
// }
//-------------------------------------------------------------------------------