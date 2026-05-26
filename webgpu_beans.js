// with help from:
// https://codelabs.developers.goocontexte.com/your-first-webgpu-app

import { getFileAsString, detectVisibility }
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

  const bgLayoutInteraction = device.createBindGroupLayout({
    label: "Interaction bind group",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      },
      { binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      }
    ]
  });

  // put multiple bind group layouts together
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bgLayoutInit, bgLayoutState, bgLayoutInteraction ],
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

  // Interaction ----------------------------------------------------------------
  // Mouse position
  const mousePosTemplate = [0.0, 0.0];
  const initMousePos = new Float32Array(mousePosTemplate);
  
  const mouseStorage = 
    device.createBuffer({
      lavel: "Mouse position storage",
      size: initMousePos.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

  device.queue.writeBuffer(mouseStorage, 0, initMousePos);

  // Click state
  const clickTemplate = [0];
  const initClick = new Uint32Array(clickTemplate);
  
  const clickStorage = 
    device.createBuffer({
      lavel: "Mouse position storage",
      size: initClick.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

  device.queue.writeBuffer(clickStorage, 0, initClick);

  function onMouseMove(mouse) {
    const rect = canvas.getBoundingClientRect();
    device.queue.writeBuffer(mouseStorage, 0, (new Float32Array([(((mouse.clientX - rect.left) / rect.width) - 0.5) * 2.0, ((1.0 - ((mouse.clientY - rect.top) / rect.height)) - 0.5) * 2.0])));
  }

  let mouseState = 0;

  function onMouseDown(mouse) {
    if (!(mouseState & 1) && (mouse.button === 0)) {
      mouseState += 1;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      // console.log("LClick");
    } else if (!(mouseState & 2) && (mouse.button === 2)) {
      mouseState += 2;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      // console.log("RClick");
    }
  }

  function onMouseUp(mouse) {
    if ((mouseState & 1) && (mouse.button === 0)) {
      mouseState -= 1;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      // console.log("LUnClick");
    } else if ((mouseState & 2) && (mouse.button === 2)) {
      mouseState -= 2;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      // console.log("RUnClick");
    }
  }

  function onRClickDown(mouse) {
    mouse.preventDefault();
  }
  
  function mouseReset() {
    mouseState = 0;
    device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
  }

  canvas.addEventListener('mouseenter', (_) => {
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onRClickDown);
  });
  canvas.addEventListener('mouseleave', (mouse) => {
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onRClickDown);
    mouseReset();
  });
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

  const bgInteraction = device.createBindGroup({
    label: "Interaction Bind Group",
    layout: pipeline.getBindGroupLayout(2),
    entries: [
      { binding: 0, resource: { buffer: mouseStorage } },
      { binding: 1, resource: { buffer: clickStorage } }
    ]
  });
  //_____________________________________________________________________________

  // Create and run Draw/calculate loop -----------------------------------------
  const UPDATE_INTERVAL = 0.2 * 100;
  let step = 0;

  let vis = { intersecting: canvas.isIntersecting
            , focus: document.hasFocus()
            , visible() { return this.intersecting && this.focus; }
  };
  detectVisibility(vis, canvas);
  function updateGrid() {
    if (!vis.visible()) { return; }
    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();

    computePass.setPipeline(simulationPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgData[step % 2]);
    computePass.setBindGroup(2, bgInteraction);

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

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroupInit);
    pass.setBindGroup(1, bgData[step % 2]);
    pass.setBindGroup(2, bgInteraction);
    pass.draw(3, NUM_PARTICLES);

    // End the render pass and submit the command buffer
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  // Schedule updateGrid() to run repeatedly
  setInterval(updateGrid, UPDATE_INTERVAL);
  //_____________________________________________________________________________
}