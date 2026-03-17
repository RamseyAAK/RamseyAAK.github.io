#version 300 es

precision lowp float;

uniform vec2 iResolution;

out vec4 finalColor;

void main() {
    vec2 uv = gl_FragCoord.xy / iResolution;
    finalColor = vec4(uv.x, uv.y, 1.0 - (uv.x + uv.y) * 0.5, 1.0);
}