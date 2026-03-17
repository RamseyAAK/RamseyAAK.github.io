
document.querySelectorAll('.projectContents').forEach(x => { assignShader(x, x.id)});

// hljs.highlightAll();

async function assignShader(div, shaderFile) {

  const canvas = div.querySelector('canvas');
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false} );
  const showcase = div.querySelector('.showcase');

  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
  }

  gl.clearColor(0.0, 0.0, 1.0, 1.0);
  // gl.enable(gl.DEPTH_TEST); 
  // gl.depthFunc(gl.LEQUAL); 

  const vsSource = `#version 300 es
    layout(location=0) in vec4 vertexPos;
    void main() {
      gl_Position = vertexPos;
    }
`;

  const fsSource = await getFileAsString('./' + shaderFile);

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

  const points = [ -1, -1
                 ,  1, -1
                 , -1,  1
                 ,  1,  1
                 ,  1, -1
                 , -1,  1 ];

  const buffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(location);

  const vertex_location = gl.getAttribLocation(program, 'vertexPos');

  gl.vertexAttribPointer(vertex_location, 2, gl.FLOAT, false, 0, 0);

  // Click / Drag input:
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
      gl.uniform2i(gl.getUniformLocation(program, 'iDrag'), dragLog.x, dragLog.y);
      draw(gl);
    }

    canvas.addEventListener('mousedown', (click) => {
      dragLog.startAt(click.clientX - rect.left, rect.top - click.clientY)
      document.addEventListener('mousemove', onDrag)
    });
    document.addEventListener('mouseup', (_) => {
      document.removeEventListener('mousemove', onDrag);
    });
  }

  // Time input:
  if (fsSource.includes('iTime')) {
    const startTime = new Date();
    function drawInTime() {
      gl.uniform1f(gl.getUniformLocation(program, 'iTime'), (Date.now() - startTime) / 1000.0);
      draw(gl);
    };
    setInterval(drawInTime, 1000.0/30.0, []);
  }
  // Slider input
  if (fsSource.includes('iSlider')) {
    const newSlider = document.createElement('input')
    newSlider.setAttribute('type', 'range');
    newSlider.setAttribute('class', 'slider-1');
    newSlider.setAttribute('min', '0');
    newSlider.setAttribute('max', '600');
    newSlider.setAttribute('value', '300');
    showcase.appendChild(newSlider);

    gl.uniform1f(gl.getUniformLocation(program, 'iSlider'), newSlider.value / newSlider.max);

    newSlider.addEventListener('input', () => {
      gl.uniform1f(gl.getUniformLocation(program, 'iSlider'), newSlider.value / newSlider.max);
      draw(gl);
    })
  }

  // TODO: eventListener resolution change => update iResolution
  //   if there is ever anything that changes shader resolution
  gl.uniform2f(gl.getUniformLocation(program, 'iResolution'), canvas.width, canvas.height);

  draw(gl);

  // ---- Shape code display -----------------------------------------
  let code = div.querySelector('code')
  code.textContent = fsSource;

  // This needs to happen after any manipulation of the showcase
  div.querySelector('.shader-code').style.height = showcase.scrollHeight + "px";
  //------------------------------------------------------------------

  hljs.highlightElement(code);
}

function draw(gl) {
  // gl.clear(gl.COLOR_BUFFER_BIT);
  // gl.clear(gl.DEPTH_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

async function getFileAsString(filepath) {
  return fetch(filepath).then(r=>r.text());
}
