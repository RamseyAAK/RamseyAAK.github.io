struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(vertex_index) vi: u32,
  @builtin(instance_index) instance: u32
}

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) cell: vec2f,
  @location(1) uv: vec2f
}

@group(0) @binding(0) var<uniform> iGridSize: vec2f;
@group(0) @binding(1) var<uniform> iResolution: vec2u;
@group(1) @binding(0) var<storage> cellStateIn: array<u32>;
@group(1) @binding(1) var<storage, read_write> cellStateOut: array<u32>;


//-------------------------------------------------------------------------------

const triangle = mat3x2f(vec2f(-1, -1),
                         vec2f(-1,  3),
                         vec2f( 3, -1));
const SCALE = 1.0;

@vertex
fn vertexMain(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.uv = triangle[in.vi];

  let i = f32(in.instance);
  var cell = vec2f(i % iGridSize.x, floor(i / iGridSize.x));
  out.cell = cell;

  var cellOffset = vec2f(select(0.0, 1.0 / iGridSize.x, (i32(cell.y) % 2) == 0), 0.0) + cell / iGridSize * 2;
  cellOffset *= vec2f(0.872, 0.752);
  let cellState = f32(cellStateIn[in.instance]);
  let triPos = (SCALE * triangle[in.vi]);
  let gridPos = (cellState * triPos + 1) / iGridSize - 1 + cellOffset;
  out.pos = vec4f(gridPos, 0, 1);

  return out;
}

//-------------------------------------------------------------------------------

fn near(a: f32, b: f32, sharpness: f32) -> f32 {
  return smoothstep(1.0 / sharpness, 0.0, abs(a - b));
}

fn hexDist(p: vec2f) -> f32 {
  let d = abs(p);
  let c = dot(d, normalize(vec2f(1.0,sqrt(3.0))));
  return max(c, d.x);
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  let h = hexDist(in.uv);
  if (h > 0.87) {
    discard;
  }
  return vec4f(vec3f(select(0.0, 1.0, h < 0.4)), 1);
}

//-------------------------------------------------------------------------------

fn cellIndex(cell: vec2u) -> u32 {
  return (cell.y % u32(iGridSize.y)) * u32(iGridSize.x) +
          (cell.x % u32(iGridSize.x));
}

fn cellActive(x: u32, y: u32) -> u32 {
  return cellStateIn[cellIndex(vec2(x, y))];
}

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
  let even = (i32(cell.y) % 2) == 0;

  // Determine how many active neighbors this cell has.
  var activeNeighbors = cellActive(cell.x+1, cell.y) +
                        cellActive(cell.x, cell.y-1) +
                        cellActive(cell.x-1, cell.y) +
                        cellActive(cell.x, cell.y+1);
  if (even) {
    activeNeighbors += cellActive(cell.x+1, cell.y+1) +
                      cellActive(cell.x+1, cell.y-1);
  } else {
    activeNeighbors += cellActive(cell.x-1, cell.y+1) +
                      cellActive(cell.x-1, cell.y-1);
  }

  let i = cellIndex(cell.xy);

  switch activeNeighbors {
    case 3: {
      cellStateOut[i] = cellStateIn[i];
    }
    case 2: {
      cellStateOut[i] = 1;
    }
    default: {
      cellStateOut[i] = 0;
    }
  }
}