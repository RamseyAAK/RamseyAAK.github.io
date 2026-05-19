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
  const vertexAdvanceShader = await getFileAsString('./updateVertex.wgsl');

  const VAModule = device.createShaderModule({
    label: "Tree render shader module",
    code: vertexAdvanceShader
  });
  const shaderModule = device.createShaderModule({
    label: "Tree compute shader module",
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
        buffer: { type: "uniform" }
      },
      { binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }, 
      { binding: 2,
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      }, 
      { binding: 3,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      }
    ]
  });

  const bgLayoutNodesCompute = device.createBindGroupLayout({
    label: "Compute Node Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }, 
      { binding: 1,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
      }
    ]
  });

  const bgLayoutEdges = device.createBindGroupLayout({
    label: "Edge Render and Compute Bind Group Layout",
    entries: [ 
      { binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" }
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

  const bgLayoutVA = device.createBindGroupLayout({
    label: "Vertex Advance Bind Group Layout",
    entries: [
      { binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" }
      },
      { binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      },
      { binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" }
      }
    ]
  });

  // put multiple bind group layouts together
  const pipelineLayoutCR = device.createPipelineLayout({
    bindGroupLayouts: [ bgLayoutInit, bgLayoutNodesCompute, bgLayoutEdges, bgLayoutInteraction ],
  });
  const pipelineLayoutVA = device.createPipelineLayout({
    bindGroupLayouts: [ bgLayoutVA ],
  });

  const nodePipeline = device.createRenderPipeline({
    label: "Render Nodes pipeline",
    layout: pipelineLayoutCR,
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
    label: "Render Edges pipeline",
    layout: pipelineLayoutCR,
    primitive: {
      topology: 'triangle-strip'
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

  const VAPipeline = device.createComputePipeline({
      label: "Vertex Advance Pipeline",
      layout: pipelineLayoutVA,
      compute: {
        module: VAModule,
        entryPoint: "advance",
      }
    });

  function makeComputePipeline(name) {
    return device.createComputePipeline({
      label: "Compute pipeline: " + name,
      layout: pipelineLayoutCR,
      compute: {
        module: shaderModule,
        entryPoint: name,
      }
    });
  }
  const nodeCompPipeline = makeComputePipeline("nodeConstraints");
  const edgeCompPipeline = makeComputePipeline("edgeConstriants");
  // const integratePipeline = makeComputePipeline("integrate");
  // const consolidatePipeline = makeComputePipeline("consolidate");
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
  const bytesPerElement = 4;
  const elementsPerNode = 5;
  const bytesPerNode = bytesPerElement * elementsPerNode;
  const nodesArray = new ArrayBuffer(NUM_PARTICLES * bytesPerNode);
  const VANodesArray = new Float32Array(NUM_PARTICLES * 2);
  // Create views to write floats and uints into the same buffer
  const f32View = new Float32Array(nodesArray);
  const u32View = new Uint32Array(nodesArray);
  // populate buffer
  for (let i = 0; i < NUM_PARTICLES; ++i) {
    // Since both views read in 4-byte chunks, our index steps by 3
    const index = i * elementsPerNode;
    f32View[index + 0] = (2 * Math.random() - 1) * (1 - PARTICLE_SIZE);
    f32View[index + 1] = (2 * Math.random() - 1) * (1 - PARTICLE_SIZE);
    f32View[index + 2] = f32View[index + 0];
    f32View[index + 3] = f32View[index + 1];
    u32View[index + 4] = 1;

    VANodesArray[2 * i + 0] = f32View[index + 0];
    VANodesArray[2 * i + 1] = f32View[index + 1];
  }

  const nodeStorage =
    device.createBuffer({
      label: "Node Buffer",
      size: nodesArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

  const VANodeStorage =
    device.createBuffer({
      label: "Vertex Advance Node Buffer",
      size: VANodesArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

  device.queue.writeBuffer(nodeStorage, 0, nodesArray);
  device.queue.writeBuffer(VANodeStorage, 0, VANodesArray);
  //_____________________________________________________________________________

  // Create and populate Edge storeage buffer ----------------------------------------
  // node1, node2, edge group/color
  const arrayTemplate = [0, 1, 0,
                         0, 2, 3,
                         0, 3, 1,
                         2, 4, 2,
                         4, 5, 0,
                         2, 6, 1,
                         2, 7, 0,
                         7, 8, 1,
                         7, 9, 2,
                         7, 10, 3];
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
      console.log("LClick");
    } else if (!(mouseState & 2) && (mouse.button === 2)) {
      mouseState += 2;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      console.log("RClick");
    }
  }

  function onMouseUp(mouse) {
    if ((mouseState & 1) && (mouse.button === 0)) {
      mouseState -= 1;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      console.log("LUnClick");
    } else if ((mouseState & 2) && (mouse.button === 2)) {
      mouseState -= 2;
      device.queue.writeBuffer(clickStorage, 0, new Uint32Array([mouseState]));
      console.log("RUnClick");
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

  // Bind Groups: ---------------------------------------------------------------
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

    const bgNodes =
      device.createBindGroup({
        label: "Node Bind Group A",
        layout: nodePipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: { buffer: nodeStorage } },
          { binding: 1, resource: { buffer: VANodeStorage } }
        ]
      });

    const bgEdges = 
      device.createBindGroup({
        label: "Edges Bind Group",
        layout: nodePipeline.getBindGroupLayout(2),
        entries: [
          { binding: 0, resource: { buffer: edgesStorage } }
        ]
      });

    const bgInteraction = 
      device.createBindGroup({
        label: "Interaction Bind Group",
        layout: nodePipeline.getBindGroupLayout(3),
        entries: [
          { binding: 0, resource: { buffer: mouseStorage } },
          { binding: 1, resource: { buffer: clickStorage } }
        ]
      });

    const bgVA = 
      device.createBindGroup({
        label: "Edges Bind Group",
        layout: VAPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uNumParticles } },
          { binding: 1, resource: { buffer: nodeStorage } },
          { binding: 2, resource: { buffer: VANodeStorage } }
        ]
      });
  //_____________________________________________________________________________
  function compute(encoder, compPipeline, count) {
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(compPipeline);

    computePass.setBindGroup(0, bindGroupInit);
    computePass.setBindGroup(1, bgNodes);
    computePass.setBindGroup(2, bgEdges);
    computePass.setBindGroup(3, bgInteraction);

    const workgroupCount = ((count - 1) / 32) + 1;
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();
  }

  function advance(encoder) {
    const computePass = encoder.beginComputePass();

    computePass.setPipeline(VAPipeline);

    computePass.setBindGroup(0, bgVA);

    const workgroupCount = ((NUM_PARTICLES - 1) / 32) + 1;
    computePass.dispatchWorkgroups(workgroupCount);

    computePass.end();
  }

  function drawEdges(encoder) {
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
    pass.setBindGroup(1, bgNodes);
    pass.setBindGroup(2, bgEdges);
    pass.setBindGroup(3, bgInteraction);
    pass.draw(4, NUM_EDGES);
    pass.end();
  }

  function drawNodes(encoder) {
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
    pass.setBindGroup(1, bgNodes);
    pass.setBindGroup(2, bgEdges);
    pass.setBindGroup(3, bgInteraction);
    pass.draw(3, NUM_PARTICLES);
    pass.end();
  }

  // Create and run Draw/calculate loop -----------------------------------------
  const UPDATE_INTERVAL = 0.2 * 100;

  function update() {
    const encoder = device.createCommandEncoder();
    // compute(encoder, integratePipeline, NUM_PARTICLES);   // INTEGRATE
    compute(encoder, nodeCompPipeline, NUM_PARTICLES);    // NODE
    compute(encoder, edgeCompPipeline, NUM_EDGES);        // EDGE
    // compute(encoder, consolidatePipeline, NUM_PARTICLES); // CONSOLIDATE
    advance(encoder);
    drawEdges(encoder);
    drawNodes(encoder);
    // Submit the command buffer
    device.queue.submit([encoder.finish()]);
  }

  // Schedule updateGrid() to run repeatedly
  setInterval(update, UPDATE_INTERVAL);
  //_____________________________________________________________________________
}