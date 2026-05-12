

struct CNode {
  prev_x: f32,
  prev_y: f32,
  accum_x: f32,
  accum_y: f32,
  count: u32
}

@group(0) @binding(0) var<uniform> numParticles: u32;
@group(0) @binding(1) var<storage, read_write> computeNodes: array<CNode>;
@group(0) @binding(2) var<storage, read_write> renderNodes: array<vec2f>;

fn getAccum(i: u32) -> vec2f {
  return vec2f(computeNodes[i].accum_x, computeNodes[i].accum_y);
}

fn consolidate(i: u32) {
  var newPos = getAccum(i);
  newPos /= f32(computeNodes[i].count);
  computeNodes[i].accum_x = newPos.x;
  computeNodes[i].accum_y = newPos.y;
  computeNodes[i].count = 1;
}

fn integrate(i: u32) {
  let tempNew = renderNodes[i];
  let prev = vec2f(computeNodes[i].prev_x, computeNodes[i].prev_y);
  renderNodes[i] += 0.99 * (tempNew - prev);
  computeNodes[i].prev_x = tempNew.x;
  computeNodes[i].prev_y = tempNew.y;
}

const wgs = 32;
@compute @workgroup_size(wgs)
fn advance(@builtin(global_invocation_id) id: vec3u) {
  if (id.x < numParticles) {
    consolidate(id.x);
    renderNodes[id.x] = getAccum(id.x);
    integrate(id.x);
    computeNodes[id.x].accum_x = renderNodes[id.x].x;
    computeNodes[id.x].accum_y = renderNodes[id.x].y;
  }
}