import { getFileAsString, createSimpleProgram,
         sliderInput, timeInput, resolutionInput,
         dragInput }
  from './shader_setup.js';

document.querySelectorAll('.fragment_project').forEach(x => { assignShader(x, x.id)});

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

  gl.clearColor(0.0, 0.0, 1.0, 1.0);
  // gl.enable(gl.DEPTH_TEST); 
  // gl.depthFunc(gl.LEQUAL); 

  const vsSource = `#version 300 es
    layout(location=0) in vec4 aVertexPos;
    void main() {
      gl_Position = aVertexPos;
    }
`;

  const fsSource = await getFileAsString('./' + shaderFile);

  const program = createSimpleProgram(gl, vsSource, fsSource);
  gl.useProgram(program);
  //_____________________________________________________________________________

  // Configure Draw Function: ---------------------------------------------------
  function draw(gl) {
    fragment_draw(gl, program);
  }
  //_____________________________________________________________________________

  // Resolution input: ----------------------------------------------------------
  if (fsSource.includes('iResolution')) {
    resolutionInput(gl, program, canvas);
  }
  //_____________________________________________________________________________

  // Slider input: --------------------------------------------------------------
  if (fsSource.includes('iSlider')) {
    sliderInput(gl, program, document, showcase, draw);
  }
  //_____________________________________________________________________________

  // Drag input: --------------------------------------------------------
  if (fsSource.includes('iDrag')) {
    dragInput(gl, program, document, canvas, draw);
  }
  //_____________________________________________________________________________

  // Time input: ----------------------------------------------------------------
  if (fsSource.includes('iTime')) {
    timeInput(gl, program, draw);
  }
  //_____________________________________________________________________________

  // ---- Shape code display ----------------------------------------------------
  let code = div.querySelector('code')
  code.textContent = fsSource;
  
  hljs.highlightElement(code);
  //------------------------------------------------------------------

  // Draw: ----------------------------------------------------------------------
  // Just gotta draw once here so that the shaders start off visible
  draw(gl);
  //_____________________________________________________________________________
}

function fragment_draw(gl, program) {
  // gl.clear(gl.COLOR_BUFFER_BIT);
  // gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}