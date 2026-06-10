export async function getFileAsString(filepath) {
  if (!(filepath)) { return null; }
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

export function detectVisibility(vis, element) {
  // Detect visibility within window
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      vis.intersecting = entry.isIntersecting
    });
  }, { threshold: 0.1 });
  observer.observe(element);

  // Detect OS window focus and tab visability
  window.addEventListener('focus', () => {
    vis.focus = true;
  });
  window.addEventListener('blur', () => {
    vis.focus = false;
  });
}

export function timeInput(gl, program, canvas, draw, shouldDraw = true) {
  let vis = { intersecting: canvas.isIntersecting
            , focus: document.hasFocus()
            , visible() { return this.intersecting && this.focus; }
  };
  detectVisibility(vis, canvas);
  const startTime = new Date();
  function drawInTime() {
  if (!vis.visible()) { return; }
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

export function dragInput(gl, program, document, canvas, draw, shouldDraw = true) {
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

  const dpr = window.devicePixelRatio || 1;
  
  function onDrag(drag) {
    const x = drag.clientX - rect.left;
    const y = rect.top - drag.clientY;
    dragLog.dragTo(x,y);
    gl.useProgram(program);
    gl.uniform2i(gl.getUniformLocation(program, 'iDrag'), dpr * dragLog.x, dpr * dragLog.y);
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

export function mouseInput(gl, program, canvas, draw, shouldDraw = true) {
  const dpr = window.devicePixelRatio || 1;
  let mouseState = 0;

  function updateMouse(mouse, canvas) {
    gl.useProgram(program);
    const rect = canvas.getBoundingClientRect();
    gl.uniform2i(gl.getUniformLocation(program, 'iMouse'), dpr * (mouse.clientX - rect.left)
                                                         , dpr * (1.0 - ((mouse.clientY - rect.top))));
    gl.uniform1ui(gl.getUniformLocation(program, 'iClick'), mouseState);
    if (shouldDraw) {
      draw();
    }
  }

  function onMouseMove(mouse) {
    updateMouse(mouse, canvas);
  }

  function onMouseDown(mouse) {
    if (!(mouseState & 1) && (mouse.button === 0)) {
      mouseState += 1;
      canvas.addEventListener('mousemove', onMouseMove);
    } else if (!(mouseState & 2) && (mouse.button === 2)) {
      mouseState += 2;
      canvas.addEventListener('mousemove', onMouseMove);
    }
    updateMouse(mouse, canvas);
  }

  function onMouseUp(mouse) {
    if ((mouseState & 1) && (mouse.button === 0)) {
      mouseState -= 1;
      canvas.removeEventListener('mousemove', onMouseMove);
    } else if ((mouseState & 2) && (mouse.button === 2)) {
      mouseState -= 2;
      canvas.removeEventListener('mousemove', onMouseMove);
    }
    updateMouse(mouse, canvas);
  }

  function onRClickDown(mouse) {
    mouse.preventDefault();
  }
  
  function mouseReset() {
    mouseState = 0; 
  }

  canvas.addEventListener('mouseenter', (_) => {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onRClickDown);
  });
  canvas.addEventListener('mouseleave', (mouse) => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onRClickDown);
    mouseReset();
  });
}

export async function createFrameBuffer(gl, width, height, imageSource = null) {
  // Create a texture to render to
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let textureData = null;

  // Handle image source loading synchronously via Promise BEFORE initializing the texture
  if (imageSource != null) {
    try {
      textureData = await new Promise((resolve, reject) => {
        const image = new Image();
        
        image.onload = function() {
          const canvas2d = document.createElement('canvas');
          // Use the real image dimensions for extraction to ensure 1:1 pixel mapping
          canvas2d.width = width;
          canvas2d.height = height;
          
          const ctx = canvas2d.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);
          
          const imgData = ctx.getImageData(0, 0, width, height).data;

          // Convert to float values
          const floatData = new Float32Array(imgData.length);
          for (let i = 0; i < imgData.length; i++) {
            floatData[i] = imgData[i] / 255.0; 
          }
          resolve(floatData);
        };
        
        image.onerror = function() {
          reject(new Error("Error Loading Image: " + imageSource));
        };
        
        image.src = imageSource;
      });
    } catch (err) {
      console.error(err);
    }
  }

  // upload either floatData or null
  // Ensure the texture is bound right before uploading
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  
  gl.texImage2D(
    gl.TEXTURE_2D, 
    0, 
    gl.RGBA32F, 
    width, height, 0, 
    gl.RGBA, 
    gl.FLOAT,
    textureData
  );

  // Setup and attach Framebuffer
  const frameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    targetTexture,
    0
  );

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    console.error("Framebuffer is incomplete");
  }

  // Clean up bindings
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return [targetTexture, frameBuffer];
}

export function setupCanvas(gl, canvas) {
    // // Get the device pixel ratio
    // const dpr = window.devicePixelRatio || 1;

    // // Scale rendering size based on set rendering size and dpr
    // canvas.width = canvas.width * dpr;
    // canvas.height = canvas.height * dpr;

    // Scale the context
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}