#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;

out vec4 finalColor;

#define LOOP_MAX 150
#define EXIT_LOOP int(iSlider * float(LOOP_MAX))

int my_round(float x) {
  return int(x + 0.5);
}

void main() {
  
  // Factor 1 guess: starts at x
  int F1G = int(gl_FragCoord.x) + 1;
  
  // Factor 2 guess: starts at y
  int F2G = int(gl_FragCoord.y) + 1;
  
  // input number: x*y 
  int numIn = F1G * F2G;
  
  // each pixel represents a guess that its
  //   x and y are the roundest factors of x*y,
  //   then it iterates until a better guess is found,
  //   or until x or y = x*y
 
  for (int i = 0; i <= LOOP_MAX + 1; i++) {
    if (i > EXIT_LOOP) {
      // unconfirmed
      finalColor = vec4(vec3(0.3), 1.0);
      break;
    }

    if (F1G < F2G) {
      F1G = F1G + 1;
      F2G = my_round(float(numIn)/float(F1G));
      
      if (F1G > F2G) {
        // confirmed roundest
        if (i == EXIT_LOOP) {
          finalColor = vec4(0.0, 1.0, 0.0, 1.0);
        } else {
          finalColor = vec4(1.0);
        }
        break;
      }
      
    } else {
      F2G = F2G + 1;
      F1G = my_round(float(numIn)/float(F2G));
      
      if (F1G < F2G) {
        // confirmed roundest
        if (i == EXIT_LOOP) {
          finalColor = vec4(0.0, 1.0, 0.0, 1.0);
        } else {
          finalColor = vec4(1.0);
        }
        break;
      }
    }
    
    if (F1G * F2G == numIn) {
      // confirmed not roundest
      if (i == EXIT_LOOP) {
        finalColor = vec4(1.0, 0.0, 0.0, 1.0);
      } else {
        finalColor = vec4(0.0);
      }
      break;
    }
  }
}