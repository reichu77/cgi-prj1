#version 300 es

precision mediump float;

out vec4 outColor;

void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;     // 0.5 * 0.5 = 0.25
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
