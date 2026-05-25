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

// export function createFrameBuffer(gl, width, height, imageSource) {
//   // Create a texture to render to
//   const targetTexture = gl.createTexture();
//   gl.bindTexture(gl.TEXTURE_2D, targetTexture);
  
//   // gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
//   gl.texImage2D(
//     gl.TEXTURE_2D, 
//     0, 
//     gl.RGBA32F, // internal format: 32bit float
//     width, height, 0, 
//     gl.RGBA, // color format
//     gl.FLOAT,
//     null
//   );

//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
//   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  
//   // Create a framebuffer
//   const frameBuffer = gl.createFramebuffer();
//   gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  
//   // Attach the texture as the first color attachment
//   gl.framebufferTexture2D(
//     gl.FRAMEBUFFER,
//     gl.COLOR_ATTACHMENT0,
//     gl.TEXTURE_2D,
//     targetTexture,
//     0 // mip level
//   );

//   if (imageSource != null) {
//     const image = new Image();
//     image.onload = function() {
//       // create canvas to convert image to float values
//       const canvas2d = document.createElement('canvas');
//       canvas2d.width = width;
//       canvas2d.height = height;
//       const ctx = canvas2d.getContext('2d');
//       ctx.drawImage(image, 0, 0);
//       // This is a Uint8ClampedArray
//       const imgData = ctx.getImageData(0, 0, width, height).data;

//       // Convert the 0-255 byte data into 0.0 - 1.0 float data
//       const floatData = new Float32Array(imgData.length);
//       for (let i = 0; i < imgData.length; i++) {
//         floatData[i] = imgData[i] / 255.0; 
//       }
//       // Flip the image's Y axis to match WebGL's coordinate system
//       gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//       // Upload the image to the texture
//       gl.texImage2D(
//         gl.TEXTURE_2D,
//         0,                 // level
//         gl.RGBA32F,        // internal format: 32bit float
//         width, height, 0,  // width, height, border
//         gl.RGBA,           // source format
//         gl.FLOAT,          // source type
//         floatData
//       );
//     }
//     image.onerror = function() {
//       console.log("Error Loading Image: ", imageSource);
//     }

//     // Trigger the image download
//     image.src = imageSource;
//   }
  
//   // Check if the framebuffer is complete
//   if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
//     console.error("Framebuffer is incomplete");
//   }

//   // Unbind the framebuffer when done with setup
//   gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//   return [targetTexture, frameBuffer];
// }

export async function createFrameBuffer(gl, width, height, imageSource = null) {
  // Create a texture to render to
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let textureData = null;

  // 1. Handle image source loading synchronously via Promise BEFORE initializing the texture
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
          ctx.drawImage(image, 0, 0, width, height); // Scale image cleanly to target width/height
          
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

  // 2. Now upload either your pristine floatData or null (empty initialization)
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
    textureData // This will safely be either your Float32Array or null
  );

  // 3. Setup and attach Framebuffer
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