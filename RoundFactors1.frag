#version 300 es
precision lowp float;

uniform vec2 iResolution;
uniform float iSlider;

out vec4 finalColor;

#define LOOP_MAX 150
#define EXIT_LOOP int(iSlider * float(LOOP_MAX))

void main() {
  // input number: x * y
  float numIn = ceil(gl_FragCoord.x) * ceil(gl_FragCoord.y);

  // Factor 1 guess: starts at or just above the sqrt of the number
  float F1G = ceil(sqrt(numIn));

  // Factor 2 guess: starts at or around the number
  //  that multiplies with F1G to get num
  float F2G = floor(numIn/F1G);

  // the goal is to start as close to F1G = F2G as possible, 
  //  then increment F1G and F2G away from equality to find 
  //  the first pair of integer factors that multiply to num

  bool found = false;
  float loopsTaken = 0.0;

  for (int i = 0; i <= LOOP_MAX; i++) {
    if (i > EXIT_LOOP) {
        break;
    }
    if (F1G * F2G == numIn) {
      found = true;
      loopsTaken = float(i);
      break;
    } else {
      F1G = F1G + 1.0;
      F2G = floor((numIn/F1G) + 0.5);
    }
  }

  vec3 col = vec3(0.0);
  
  //if (found) {col = vec3(loopsTaken/float(loops));} 
  // if (found) {col = vec3(normalize(vec2(F1G,F2G)), loopsTaken / float(EXIT_LOOP));}


  vec2 uv = gl_FragCoord.xy / iResolution.y;
  vec2 guv = vec2(F1G, F2G) / iResolution.y;
  if (found) { col = vec3(sqrt(distance(guv, uv)), guv.x, guv.y); }

  finalColor = vec4(col, 1.0);
}