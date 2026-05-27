document.querySelectorAll('canvas').forEach(canvas => { prescaleCanvas(canvas)});

function prescaleCanvas(canvas) {
  // Get the device pixel ratio
  const dpr = window.devicePixelRatio || 1;

  // Scale rendering size based on set rendering size and dpr
  canvas.width = canvas.width * dpr;
  canvas.height = canvas.height * dpr;
}