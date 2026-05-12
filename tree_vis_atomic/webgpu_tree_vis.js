// with help from:
// https://codelabs.developers.goocontexte.com/your-first-webgpu-app

import { getFileAsString }
  from './shader_setup.js';

document.querySelectorAll('.tree_vis').forEach(x => { assignShader(x, x.id)});

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
      }, 
      { binding: 3,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' }
      }
    ]
  });

  const bgLayoutNodes = device.createBindGroupLayout({
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

  const bgLayoutEdges = device.createBindGroupLayout({
    label: "Cell State Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      }
    ]
  });

  // put multiple bind group layouts together
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [ bgLayoutInit, bgLayoutNodes, bgLayoutEdges ],
  });

  const nodePipeline = device.createRenderPipeline({
    label: "Render Nodes pipeline",
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
      entryPoint: "vertexNode"
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{
        format: canvasFormat
      }]
    }
  });

    const edgePipeline = device.createRenderPipeline({
    label: "Render Nodes pipeline",
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
      entryPoint: "vertexEdge"
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [{
        format: canvasFormat
      }]
    }
  });

  // Comipute pipeline: one thread per node
  const nodeCompPipeline = device.createComputePipeline({
    label: "Simulation pipeline",
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "computeNodes",
    }
  });

    // Comipute pipeline: one thread per edge
  const edgeCompPipeline = device.createComputePipeline({
    label: "Simulation pipeline",
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "computeEdges",
    }
  });

    // Comipute pipeline: one thread per node
  const consolidatePipeline = device.createComputePipeline({
    label: "Simulation pipeline",
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "consolidate",
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
  const NUM_PARTICLES = 11;
  const dataNumParticles = new Uint32Array([NUM_PARTICLES]);
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

  // Number of particles uniform buffer -----------------------------------------
  const NUM_EDGES = 10;
  const dataNumEdges = new Uint32Array([NUM_EDGES]);
  const uNumEdges = device.createBuffer({
    label: "u32 Number of particles uniform buffer",
    size: dataNumEdges.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uNumEdges, 0, dataNumEdges);
  //_____________________________________________________________________________

  // Create and populate Node storeage buffer ----------------------------------------
  // each particle is represented by a vec3i(posx, posy, totalweight) where the position
  // is the sum of several positions and totalweight is the number of positions that were summed
  const nodesArray = new Int32Array(NUM_PARTICLES * 3);
  for (let i = 0; i < NUM_PARTICLES; ++i) {
    nodesArray[(3 * i) + 0] = Math.trunc(((2 * Math.random() - 1) * (1 << 26)) * (1 - PARTICLE_SIZE));
    nodesArray[(3 * i) + 1] = Math.trunc(((2 * Math.random() - 1) * (1 << 26)) * (1 - PARTICLE_SIZE));
    nodesArray[(3 * i) + 2] = 1;
  }

  // Create two storage buffers to hold the Nodes.
  const nodeStorage = [
    device.createBuffer({
      label: "Cell State A",
      size: nodesArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: "Cell State B",
      size: nodesArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  ];

  device.queue.writeBuffer(nodeStorage[0], 0, nodesArray);
  device.queue.writeBuffer(nodeStorage[1], 0, nodesArray);
  //_____________________________________________________________________________

  // Create and populate Edge storeage buffer ----------------------------------------
  const arrayTemplate = [0, 1, 0, 2, 0, 3, 2, 4, 4, 5, 2, 6, 2, 7, 7, 8, 7, 9, 7, 10];
  const edgesArray = new Uint32Array(arrayTemplate);
  // const edgesArray = new Uint32Array(NUM_EDGES * 2);
  // for (let i = 0; i < NUM_EDGES; ++i) {
  //   edgesArray[(2 * i) + 0] = 0;
  //   edgesArray[(2 * i) + 1] = 1;
  // }

  // Create storage buffer to hold the Edges.
  const edgesStorage = 
    device.createBuffer({
      label: "Edges Storage",
      size: edgesArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

  device.queue.writeBuffer(edgesStorage, 0, edgesArray);
  //_____________________________________________________________________________

  // Bind Groups: ----------------------------------------------------------
  const bindGroupInit = device.createBindGroup({
    label: "Initalizing Bind Group",
    layout: nodePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uNumParticles } },
      { binding: 1, resource: { buffer: uResolution } }, 
      { binding: 2, resource: { buffer: uParticleSize } },
      { binding: 3, resource: { buffer: uNumEdges } }
    ]
  });

    const bgNodes = [
      device.createBindGroup({
        label: "Node Bind Group A",
        layout: nodePipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: nodeStorage[0] } },
          { binding: 1, resource: { buffer: nodeStorage[1] } }
        ]
      }),
      device.createBindGroup({
        label: "Node Bind Group B",
        layout: nodePipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: nodeStorage[1] } },
          { binding: 1, resource: { buffer: nodeStorage[0] } }
        ]
      })
    ];

    const bgEdges = 
      device.createBindGroup({
        label: "Edges Bind Group",
        layout: nodePipeline.getBindGroupLayout(2),
        entries: [
          { binding: 0, resource: { buffer: edgesStorage } }
        ]
      });
  //_____________________________________________________________________________

  function computeNodes(encoder, step) {
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(nodeCompPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgNodes[step % 2]);
    computePass.setBindGroup(2, bgEdges);

    const workgroupCount = ((NUM_PARTICLES - 1) / 32) + 1;
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();
  }

  function computeEdges(encoder, step) {
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(edgeCompPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgNodes[step % 2]);
    computePass.setBindGroup(2, bgEdges);

    const workgroupCount = ((NUM_EDGES - 1) / 32) + 1;
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();
  }

  function consolidate(encoder, step) {
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(consolidatePipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgNodes[step % 2]);
    computePass.setBindGroup(2, bgEdges);

    const workgroupCount = ((NUM_PARTICLES - 1) / 32) + 1;
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();
  }

  function drawEdges(encoder, step) {
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

    // Draw
    pass.setPipeline(edgePipeline);
    pass.setBindGroup(0, bindGroupInit);
    pass.setBindGroup(1, bgNodes[step % 2]);
    pass.setBindGroup(2, bgEdges);
    pass.draw(6, NUM_PARTICLES);
    pass.end();
  }

  function drawNodes(encoder, step) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "load",
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: "store",
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      }
    });

    // Draw
    pass.setPipeline(nodePipeline);
    pass.setBindGroup(0, bindGroupInit);
    pass.setBindGroup(1, bgNodes[step % 2]);
    pass.setBindGroup(2, bgEdges);
    pass.draw(3, NUM_PARTICLES);
    pass.end();
  }

  // Create and run Draw/calculate loop -----------------------------------------
  const UPDATE_INTERVAL = 0.2 * 100;
  let step = 0;

  function update() {
    const encoder = device.createCommandEncoder();
    computeNodes(encoder, step);
    computeEdges(encoder, step);
    consolidate(encoder, step);
    step++; // Increment the step count
    drawEdges(encoder, step);
    drawNodes(encoder, step);
    // Submit the command buffer
    device.queue.submit([encoder.finish()]);
  }

  // Schedule updateGrid() to run repeatedly
  setInterval(update, UPDATE_INTERVAL);
  //_____________________________________________________________________________
}