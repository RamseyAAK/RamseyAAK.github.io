// with help from:
// https://codelabs.developers.goocontexte.com/your-first-webgpu-app

import { getFileAsString, createSimpleProgram,
         sliderInput, timeInput, resolutionInput, 
         mouseInput}
  from './shader_setup.js';

document.querySelectorAll('.webgpu_test').forEach(x => { assignShader(x, x.id)});

async function assignShader(div, shaderFile) {

  // Iinitalize -----------------------------------------------------------------
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }

  const device = await adapter.requestDevice();

  const canvas = div.querySelector('canvas');
  const context = canvas.getContext('webgpu');
  const showcase = div.querySelector('.showcase');

  if (context === null) {
    alert(
      "Unable to initialize WebGPU. Your browser or machine may not support it."
    );
  }
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
    alphaMode: 'premultiplied'
  });
  //_____________________________________________________________________________

  // Prepare Shaders ------------------------------------------------------------
  const shader = await getFileAsString('./' + shaderFile);
  const shaderModule = device.createShaderModule({
    label: "Cell shader",
    code: shader
  });
  //_____________________________________________________________________________

  // Shape code Display: --------------------------------------------------------
  let code = div.querySelector('code')
  code.textContent = shader;

  hljs.highlightElement(code);
//_____________________________________________________________________________

  // Vertex Buffer --------------------------------------------------------------
  const vertices = new Float32Array([
  //   X,    Y,
    -1, -1,
    -1,  3,
    3,  -1,
  ]);

  const vertexBuffer = device.createBuffer({
    label: "Cell vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
      format: "float32x2",
      offset: 0,
      shaderLocation: 0, // Position, see vertex shader
    }],
  };
  //_____________________________________________________________________________

  // Create Pipeline ------------------------------------------------------------
  // create a bind group layout that matches the bind group in the shader
  const bgLayoutInit = device.createBindGroupLayout({
    label: "Initalization Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' }
      },
      { binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }
    ]
  });

  const bgLayoutData = device.createBindGroupLayout({
    label: "Cell State Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      { binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }
    ]
  });

  // put multiple bind group layouts together
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bgLayoutInit, bgLayoutData],
  });

  const pipeline = device.createRenderPipeline({
    label: "Render pipeline",
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
      buffers: [vertexBufferLayout]
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{
        format: canvasFormat
      }]
    }
  });

  // Create a compute pipeline that updates the game state.
  const simulationPipeline = device.createComputePipeline({
    label: "Simulation pipeline",
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "computeMain",
    }
  });
  //_____________________________________________________________________________

  // Grid input: ----------------------------------------------------------------
  const GRID_SIZE = 16;
  const gridSize = new Float32Array([GRID_SIZE, GRID_SIZE]);
  const uGridSize = device.createBuffer({
    label: "Grid Size uniform",
    size: gridSize.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uGridSize, 0, gridSize);
  //_____________________________________________________________________________

  // Create and populate storeage buffer ----------------------------------------
  // Create an array representing the active state of each cell.
  const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

  // Create two storage buffers to hold the cell state.
  const cellStateStorage = [
    device.createBuffer({
      label: "Cell State A",
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: "Cell State B",
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  ];

  // Set each cell to a random state, then copy the JavaScript array 
  // into the storage buffer.
  for (let i = 0; i < cellStateArray.length; ++i) {
    cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
  }
  device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);
  device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray);
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  const canvasResolution = new Uint32Array([context.canvas.width, context.canvas.height]);
  const uResolution = device.createBuffer({
    label: "Canvas Resolution uniform",
    size: canvasResolution.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uResolution, 0, canvasResolution);
  //_____________________________________________________________________________

  // Slider input: --------------------------------------------------------------
  // const newSlider = document.createElement('input')
  // newSlider.setAttribute('type', 'range');
  // newSlider.setAttribute('class', 'slider-1');
  // newSlider.setAttribute('min', '0');
  // newSlider.setAttribute('max', '600');
  // newSlider.setAttribute('value', '300');
  // showcase.appendChild(newSlider);

  // const sliderInput = new Float32Array([newSlider.value / newSlider.max]);
  // const uSlider = device.createBuffer({
  //   label: "Slider input buffer",
  //   size: sliderInput.byteLength,
  //   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  // });
  // device.queue.writeBuffer(uSlider, 0, sliderInput);

  // newSlider.addEventListener('input', () => {
  //   gl.useProgram(program);
  //   gl.uniform1f(gl.getUniformLocation(program, 'iSlider'), newSlider.value / newSlider.max);

  //_____________________________________________________________________________

//   // Click / Drag input: --------------------------------------------------------
//   if (fsSource.includes('iDrag')) {
//     mouseInput(context, pCalculate, document, canvas, draw);
//   }
//   //_____________________________________________________________________________

//   // Time input: ----------------------------------------------------------------
//   if (fsSource.includes('iTime')) {
//     timeInput(context, pCalculate, draw);
//   }
//   //_____________________________________________________________________________

  // Bind Groups: ----------------------------------------------------------
  const bindGroupInit = device.createBindGroup({
    label: "Initalizing Bind Group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uGridSize } },
      { binding: 1, resource: { buffer: uResolution } }
    ]
  });

    const bgData = [
      device.createBindGroup({
        label: "Cell Data Bind Group A",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: cellStateStorage[0] } },
          { binding: 1, resource: { buffer: cellStateStorage[1] } }
        ]
      }),
      device.createBindGroup({
        label: "Cell Data Bind Group B",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: cellStateStorage[1] } },
          { binding: 1, resource: { buffer: cellStateStorage[0] } }
        ]
      })
    ];

  // const bindGroupSlider = device.createBindGroup({
  //   label: "Slider Bind Group",
  //   layout: pipeline.getBindGroupLayout(1),
  //   entries: [{
  //     binding: 0,
  //     resource: { buffer: uSlider }
  //   }]
  // });
  //_____________________________________________________________________________

  // create and submit render pass ----------------------------------------------
  // const encoder = device.createCommandEncoder();
  // const pass = encoder.beginRenderPass({
  // colorAttachments: [{
  //    view: context.getCurrentTexture().createView(),
  //    loadOp: "clear",
  //    clearValue: {r: 1, g: 0, b: 1, a: 1},
  //    storeOp: "store",
  //   }]
  // });
  // pass.setPipeline(pipeline);
  // pass.setVertexBuffer(0, vertexBuffer);
  // pass.setBindGroup(0, bindGroupInit);
  // pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE); // verticies, instances
  // pass.end();

  // device.queue.submit([encoder.finish()]);
  //_____________________________________________________________________________

  // Create and run Draw/calculate loop -----------------------------------------
  const UPDATE_INTERVAL = 200; // Update every 200ms (5 times/sec)
  let step = 0;

  function updateGrid() {
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();

    computePass.setPipeline(simulationPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgData[step % 2]);

    const workgroupCount = Math.ceil(GRID_SIZE / 8);
    computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

    computePass.end();

    step++; // Increment the step count
    
    // Start a render pass 
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue: { r: 1, g: 1, b: 1, a: 0 },
        storeOp: "store",
      }]
    });

    // Draw the grid.
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroupInit);
    pass.setBindGroup(1, bgData[step % 2]);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

    // End the render pass and submit the command buffer
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Schedule updateGrid() to run repeatedly
  setInterval(updateGrid, UPDATE_INTERVAL);
  //_____________________________________________________________________________
}