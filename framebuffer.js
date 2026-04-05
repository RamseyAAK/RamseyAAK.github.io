import { getFileAsString, createSimpleProgram,
         sliderInput, timeInput, resolutionInput, 
         mouseInput, createFrameBuffer}
  from './shader_setup.js';

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

  // Configure Calculate and Draw Functions: ---------------------------------------------------
  function draw(gl) {
    calculate(gl, pCalculate, fbA, fbB, textureA, textureB);
    drawFromBuffer(gl, pDisplay, textureB);
  }
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  if (fsSource.includes('iResolution')) {
    resolutionInput(gl, pCalculate, canvas);
  }
  //_____________________________________________________________________________

  // Slider input: --------------------------------------------------------------
  if (fsSource.includes('iSlider')) {
    sliderInput(gl, pCalculate, document, showcase, draw, false);
  }
  //_____________________________________________________________________________

  // Click / Drag input: --------------------------------------------------------
  if (fsSource.includes('iDrag')) {
    mouseInput(gl, pCalculate, document, canvas, draw);
  }
  //_____________________________________________________________________________

  // Time input: ----------------------------------------------------------------
  if (fsSource.includes('iTime')) {
    timeInput(gl, pCalculate, draw);
  }
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

function calculate(gl, pCalc, fbA, fbB, textureA, textureB) {
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
}

function drawFromBuffer(gl, pDisp, displayTexture) {
  // Draw from buffer to canvas
  gl.useProgram(pDisp);
  // Assign buffer B as input
  gl.bindTexture(gl.TEXTURE_2D, displayTexture)
  // Unassign buffer as output
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}