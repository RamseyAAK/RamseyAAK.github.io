import { getFileAsString, createSimpleProgram,
         sliderInput, timeInput, resolutionInput, 
         dragInput, createFrameBuffer,
         clickInput, setupCanvas}
  from './shader_setup.js';

document.querySelectorAll('.framebuffer_project').forEach(x => { assignShader(x)});

async function assignShader(project) {

  // Iinitalize -----------------------------------------------------------------
  const canvas = project.querySelector('canvas');
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false} );
  const showcase = project.querySelector('.showcase');

  if (gl === null) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
  }

  setupCanvas(gl, canvas);

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

  const fsSource = await getFileAsString(project.dataset.frag);

  const pDisplay = createSimpleProgram(gl, vsSource, fsDisplay);
  const pCalculate = createSimpleProgram(gl, vsSource, fsSource);
  //_____________________________________________________________________________
  
  // Create Frame Buffers: ------------------------------------------------------
  const bufferInit = project.dataset.start;
  const [textureA, fbA] = await createFrameBuffer(gl, canvas.width, canvas.height, bufferInit);
  const [textureB, fbB] = await createFrameBuffer(gl, canvas.width, canvas.height, bufferInit);
  //_____________________________________________________________________________

  // Configure Calculate and Draw Functions: ---------------------------------------------------
  const ITERATIONS = 3;
  function drawAndCalc(gl) {
    for (let i = 0; i < ITERATIONS; ++i) {
      calculate(gl, pCalculate, fbA, fbB, textureA, textureB);
    }
    draw(gl, pDisplay, textureB);
  }
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  if (fsSource.includes('iResolution')) {
    resolutionInput(gl, pCalculate, canvas);
  }
  //_____________________________________________________________________________

  // Slider input: --------------------------------------------------------------
  if (fsSource.includes('iSlider')) {
    sliderInput(gl, pCalculate, document, showcase, drawAndCalc, false);
  }
  //_____________________________________________________________________________

  // Drag input: --------------------------------------------------------
  if (fsSource.includes('iDrag')) {
    dragInput(gl, pCalculate, document, canvas, drawAndCalc, false);
  }
  //_____________________________________________________________________________

  // Click input: --------------------------------------------------------
  if (fsSource.includes('iClick')) {
    clickInput(gl, pCalculate, canvas, drawAndCalc, false);
  }
  //_____________________________________________________________________________

  // Time input: ----------------------------------------------------------------
  if (fsSource.includes('iTime')) {
    timeInput(gl, pCalculate, canvas, drawAndCalc);
  }
  //_____________________________________________________________________________

  // Shape code Display: --------------------------------------------------------
  let code = project.querySelector('code')
  code.textContent = fsSource;

  hljs.highlightElement(code);
//_____________________________________________________________________________

  // Draw: ----------------------------------------------------------------------
  // Just gotta draw once here so that the shaders start off visible
  drawAndCalc(gl);
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

function draw(gl, pDisp, displayTexture) {
  // Draw from buffer to canvas
  gl.useProgram(pDisp);
  // Assign buffer B as input
  gl.bindTexture(gl.TEXTURE_2D, displayTexture)
  // Unassign buffer as output
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}