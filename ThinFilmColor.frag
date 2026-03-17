#version 300 es
#define TAU    6.2831853071795864769252867
#define RED    575.0
#define GREEN  535.0
#define BLUE   445.0

precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;
uniform ivec2 iDrag;

out vec4 finalColor;

float norm_cos(float angle) {
  return (1.0 + cos(TAU * angle)) / 2.0;
}

float tfi_A(float wavelength, float phase_diff) {
  return 1.0 - norm_cos(phase_diff / wavelength);
}

void main() {
  float depth = ((gl_FragCoord.x - float(iDrag.x * 2)) / iResolution.x) * iSlider * 3000.0;
  finalColor = vec4(
    tfi_A(RED  , 2.0 * depth)
  , tfi_A(GREEN, 2.0 * depth)
  , tfi_A(BLUE , 2.0 * depth)
  , 1
  );
}

// float tfi_B(float wavelength, float phase_diff) {
//   return norm_cos(phase_diff / wavelength);
// }

// void main() {
//   float depth = ((gl_FragCoord.x - float(iDrag.x * 2)) / iResolution.x) * iSlider * 3000.0;
//   if (gl_FragCoord.y < (iResolution.y / 2.0)) { 
//     finalColor = vec4(
//         tfi_A(RED  , 2.0 * depth)
//       , tfi_A(GREEN, 2.0 * depth)
//       , tfi_A(BLUE , 2.0 * depth)
//       , 1
//     );
//   } else {
//         finalColor = vec4(
//         tfi_B(RED  , 2.0 * depth)
//       , tfi_B(GREEN, 2.0 * depth)
//       , tfi_B(BLUE , 2.0 * depth)
//       , 1
//     );
//   }
// }