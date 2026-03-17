document.querySelectorAll('.framebuffer_project').forEach(x => { assignShader(x, x.id)});

async function assignShader(div, shaderFile) {

  // Iinitalize -----------------------------------------------------------------
  const canvas = div.querySelector('canvas');
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false} );
  const showcase = div.querySelector('.showcase');

  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
  }

  // enable float textures
  const ext = gl.getExtension("EXT_color_buffer_float");
  if (!ext) {
    console.error("Your device does not support rendering to float textures!");
  }

  gl.clearColor(0.0, 0.0, 1.0, 1.0);
  // gl.enable(gl.DEPTH_TEST); 
  // gl.depthFunc(gl.LEQUAL); 

  const vsSource = `#version 300 es
    layout(location=0) in vec4 aVertexPos;
    void main() {
      gl_Position = aVertexPos;
    }
  `;

  const fsDisplay = `#version 300 es
    precision lowp float;
    uniform sampler2D buff;
    layout(location=0) out vec4 finalColor;
    void main() {
      finalColor = texelFetch(buff, ivec2(gl_FragCoord.xy), 0);
    }
  `;

  const fsSource = await getFileAsString('./' + shaderFile);

  const pDisplay = createSimpleProgram(gl, vsSource, fsDisplay);
  const pCalculate = createSimpleProgram(gl, vsSource, fsSource);
  //_____________________________________________________________________________
  
  // Create Frame Buffers: ------------------------------------------------------
  const [textureA, fbA] = createFrameBuffer(gl, canvas.width, canvas.height);
  const [textureB, fbB] = createFrameBuffer(gl, canvas.width, canvas.height);
  //_____________________________________________________________________________

  // Configure Draw Function: ---------------------------------------------------
  function draw(gl) {
    bufferDraw(gl, pCalculate, pDisplay, fbA, fbB, textureA, textureB);
  }
  //_____________________________________________________________________________

  // Click / Drag input: --------------------------------------------------------
  if (fsSource.includes('iDrag')) {
    const dragLog = {
      x: 0,
      y: 0,
      prevXPos: 0,
      prevYpos: 0,
      startAt: function(xStart, yStart) {
        this.prevXPos = xStart;
        this.prevYpos = yStart;
      },
      dragTo: function(newX, newY) {
        this.x += newX - this.prevXPos;
        this.y += newY - this.prevYpos;
        this.prevXPos = newX;
        this.prevYpos = newY;
      }
    }
    const rect = canvas.getBoundingClientRect();
    
    function onDrag(drag) {
      const x = drag.clientX - rect.left;
      const y = rect.top - drag.clientY;
      dragLog.dragTo(x,y);
      gl.useProgram(pCalculate);
      gl.uniform2i(gl.getUniformLocation(pCalculate, 'iDrag'), dragLog.x, dragLog.y);
      // draw(gl);
    }
    
    canvas.addEventListener('mousedown', (click) => {
      dragLog.startAt(click.clientX - rect.left, rect.top - click.clientY)
      document.addEventListener('mousemove', onDrag)
    });
    document.addEventListener('mouseup', (_) => {
      document.removeEventListener('mousemove', onDrag);
    });
  }
  //_____________________________________________________________________________
  
  // Time input: ----------------------------------------------------------------
  if (fsSource.includes('iTime')) {
    const startTime = new Date();
    function drawInTime() {
      gl.useProgram(pCalculate);
      gl.uniform1f(gl.getUniformLocation(pCalculate, 'iTime'), (Date.now() - startTime) / 1000.0);
      draw(gl);
    };
    setInterval(drawInTime, 1000.0/30.0, []);
  }
  //_____________________________________________________________________________

  // Slider input: --------------------------------------------------------------
  if (fsSource.includes('iSlider')) {
    const newSlider = document.createElement('input')
    newSlider.setAttribute('type', 'range');
    newSlider.setAttribute('class', 'slider-1');
    newSlider.setAttribute('min', '0');
    newSlider.setAttribute('max', '600');
    newSlider.setAttribute('value', '300');
    showcase.appendChild(newSlider);

    gl.useProgram(pCalculate);
    gl.uniform1f(gl.getUniformLocation(pCalculate, 'iSlider'), newSlider.value / newSlider.max);

    newSlider.addEventListener('input', () => {
      gl.useProgram(pCalculate);
      gl.uniform1f(gl.getUniformLocation(pCalculate, 'iSlider'), newSlider.value / newSlider.max);
      draw(gl);
    })
  }
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  // TODO: eventListener resolution change => update iResolution
  //   if there is ever anything that changes shader resolution
  gl.useProgram(pCalculate);
  gl.uniform2f(gl.getUniformLocation(pCalculate, 'iResolution'), canvas.width, canvas.height);
  //_____________________________________________________________________________

  // Shape code Display: --------------------------------------------------------
  let code = div.querySelector('code')
  code.textContent = fsSource;

  hljs.highlightElement(code);

  // This needs to happen after any manipulation of the showcase
  div.querySelector('.shader-code').style.height = showcase.scrollHeight + "px";
  //_____________________________________________________________________________

  // Draw: ----------------------------------------------------------------------
  // Just gotta draw once here so that the shaders start off visible
  draw(gl);
  //_____________________________________________________________________________
}

function bufferDraw(gl, pCalc, pDisp, fbA, fbB, textureA, textureB) {
  // Draw from buffer to buffer
  gl.useProgram(pCalc);
  // Assign buffer B as input
  gl.bindTexture(gl.TEXTURE_2D, textureB)
  // Assign buffer A as output
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // Assign buffer A as input
  gl.bindTexture(gl.TEXTURE_2D, textureA);
  // Assign buffer B as output
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Draw from buffer to canvas
  gl.useProgram(pDisp);
  // Assign buffer B as input
  gl.bindTexture(gl.TEXTURE_2D, textureB)
  // Unassign buffer as output
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

async function getFileAsString(filepath) {
  return fetch(filepath).then(r=>r.text());
}

function createSimpleProgram(gl, vsSource, fsSource) {
  const program = gl.createProgram();

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  gl.shaderSource(vertexShader, vsSource)
  gl.shaderSource(fragmentShader, fsSource);

  gl.compileShader(vertexShader);
  gl.compileShader(fragmentShader);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);
  gl.useProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program Error: \n", gl.getProgramInfoLog(program));
    console.error("Vertex Error: \n", gl.getShaderInfoLog(vertexShader));
    console.error("Fragment Error: \n", gl.getShaderInfoLog(fragmentShader));
  }

  // Vertex Array Buffer --------------------------------------------------------
  const points = [ -1, -1
                 ,  4, -1
                 , -1,  4 ];

  const arrayBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(location);

  const vertex_location = gl.getAttribLocation(program, 'aVertexPos');

  gl.vertexAttribPointer(vertex_location, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  //_____________________________________________________________________________

  gl.useProgram(null);
  return program;
}

function createFrameBuffer(gl, width, height) {
  // Create a texture to render to
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  
  // gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  gl.texImage2D(
    gl.TEXTURE_2D, 
    0, 
    gl.RGBA32F, // internal format: 32bit float
    width, height, 0, 
    gl.RGBA, // format
    gl.FLOAT,
    null
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  
  // Create a framebuffer
  const frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  
  // Attach the texture as the first color attachment
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    targetTexture,
    0 // mip level
  );
  
  // Check if the framebuffer is complete
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Framebuffer is incomplete");
  }

  // Unbind the framebuffer when done with setup
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return [targetTexture, frameBuffer];
}