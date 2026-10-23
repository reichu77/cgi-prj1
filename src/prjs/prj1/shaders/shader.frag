#version 300 es

precision mediump float;

out vec4 outColor;

void main() {
    float d = length(gl_PointCoord - 0.5);   // 0 no centro, 0.5 na borda
    if (d > 0.5) discard;                    // fora do círculo

    // interior branco, anel preto por fora
    vec3 color = d < 0.3 ? vec3(1.0) : vec3(0.0);
    outColor = vec4(color, 1.0);
}
