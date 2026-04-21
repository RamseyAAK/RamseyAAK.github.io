// with help from:
// https://codelabs.developers.goocontexte.com/your-first-webgpu-app

import { getFileAsString }
  from './shader_setup.js';

document.querySelectorAll('.beans').forEach(x => { assignShader(x, x.id)});

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

  // This needs to happen after any manipulation of the showcase
  div.querySelector('.shader-code').style.height = showcase.scrollHeight + "px";
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
      }, 
      { binding: 2,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' }
      }
    ]
  });

  const bgLayoutState = device.createBindGroupLayout({
    label: "Cell State Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
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
    bindGroupLayouts: [ bgLayoutInit, bgLayoutState],
  });

  const pipeline = device.createRenderPipeline({
    label: "Render pipeline",
    layout: pipelineLayout,
    primitive: {
      topology: 'triangle-list'
    },
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
    },
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain"
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

  // Depth Texture --------------------------------------------------------------
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  const canvasResolution = new Uint32Array([context.canvas.width, context.canvas.height]);
  const uResolution = device.createBuffer({
    label: "Canvas Resolution uniform",
    size: canvasResolution.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uResolution, 0, canvasResolution);
  //_____________________________________________________________________________

  // Number of particles uniform buffer -----------------------------------------
  const BATCH_SIZE = 32;
  const NUM_BATCHES = 1;
  const NUM_PARTICLES = BATCH_SIZE * NUM_BATCHES;
  const dataNumParticles = new Uint32Array([BATCH_SIZE * NUM_BATCHES]);
  const uNumParticles = device.createBuffer({
    label: "u32 Number of particles uniform buffer",
    size: dataNumParticles.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uNumParticles, 0, dataNumParticles);
  //_____________________________________________________________________________

  // Particle size uniform buffer -----------------------------------------
  const PARTICLE_SIZE = 0.08;
  const dataParticleSize = new Float32Array([PARTICLE_SIZE]);
  const uParticleSize = device.createBuffer({
    label: "f32 Size of Particles",
    size: dataParticleSize.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uParticleSize, 0, dataParticleSize);
  //_____________________________________________________________________________


  // Create and populate storeage buffer ----------------------------------------
  const positionsArray = new Float32Array(NUM_PARTICLES * 2);
  for (let i = 0; i < NUM_PARTICLES; ++i) {
    positionsArray[(2 * i) + 0] = (2 * Math.random() - 1) * (1 - PARTICLE_SIZE);
    positionsArray[(2 * i) + 1] = (2 * Math.random() - 1) * (1 - PARTICLE_SIZE);
  }

  // Create two storage buffers to hold the cell state.
  const cellStateStorage = [
    device.createBuffer({
      label: "Cell State A",
      size: positionsArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: "Cell State B",
      size: positionsArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  ];

  device.queue.writeBuffer(cellStateStorage[0], 0, positionsArray);
  device.queue.writeBuffer(cellStateStorage[1], 0, positionsArray);
  //_____________________________________________________________________________

  // Bind Groups: ----------------------------------------------------------
  const bindGroupInit = device.createBindGroup({
    label: "Initalizing Bind Group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uNumParticles } },
      { binding: 1, resource: { buffer: uResolution } }, 
      { binding: 2, resource: { buffer: uParticleSize } }
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
  //_____________________________________________________________________________

  // Create and run Draw/calculate loop -----------------------------------------
  const UPDATE_INTERVAL = 0.2 * 100;
  let step = 0;

  function updateGrid() {
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();

    computePass.setPipeline(simulationPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgData[step % 2]);

    const workgroupCount = Math.ceil(NUM_BATCHES);
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();

    step++; // Increment the step count
    
    // Start a render pass 
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });

    // Draw the grid.
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroupInit);
    pass.setBindGroup(1, bgData[step % 2]);
    pass.draw(3, NUM_PARTICLES);

    // End the render pass and submit the command buffer
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Schedule updateGrid() to run repeatedly
  setInterval(updateGrid, UPDATE_INTERVAL);
  //_____________________________________________________________________________
}