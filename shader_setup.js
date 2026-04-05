export async function getFileAsString(filepath) {
  return fetch(filepath).then(r=>r.text());
}

export function createSimpleProgram(gl, vsSource, fsSource) {
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

export function sliderInput(gl, program, document, showcase, draw, shouldDraw = true) {
  const newSlider = document.createElement('input')
  newSlider.setAttribute('type', 'range');
  newSlider.setAttribute('class', 'slider-1');
  newSlider.setAttribute('min', '0');
  newSlider.setAttribute('max', '600');
  newSlider.setAttribute('value', '300');
  showcase.appendChild(newSlider);

  gl.useProgram(program);
  gl.uniform1f(gl.getUniformLocation(program, 'iSlider'), newSlider.value / newSlider.max);

  newSlider.addEventListener('input', () => {
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'iSlider'), newSlider.value / newSlider.max);

    if (shouldDraw) {
      draw(gl);
    }
  })
}

export function timeInput(gl, program, draw, shouldDraw = true) {
  const startTime = new Date();
  function drawInTime() {
    gl.useProgram(program);
    gl.uniform1f(gl.getUniformLocation(program, 'iTime'), (Date.now() - startTime) / 1000.0);
    if (shouldDraw) {
      draw(gl);
    }
  };
  setInterval(drawInTime, 1000.0/30.0, []);
}

export function resolutionInput(gl, program, canvas) {
  // TODO: eventListener resolution change => update iResolution
  //   if there is ever anything that changes shader resolution
  gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, 'iResolution'), canvas.width, canvas.height);
}

export function mouseInput(gl, program, document, canvas, draw, shouldDraw = true) {
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
    gl.useProgram(program);
    gl.uniform2i(gl.getUniformLocation(program, 'iDrag'), dragLog.x, dragLog.y);
    if (shouldDraw) {
      draw(gl);
    }
  }
  
  canvas.addEventListener('mousedown', (click) => {
    dragLog.startAt(click.clientX - rect.left, rect.top - click.clientY)
    document.addEventListener('mousemove', onDrag)
  });
  document.addEventListener('mouseup', (_) => {
    document.removeEventListener('mousemove', onDrag);
  });
}

export function createFrameBuffer(gl, width, height) {
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