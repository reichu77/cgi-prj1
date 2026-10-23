#version 300 es

precision highp float;

const float max_dist = 5.0;     // o mesmo valor do quad.frag

in vec3 v_color;
in float v_dist;
out vec4 color;

void main() {
    float shade = mix(1.0, 0.3, clamp(v_dist / max_dist, 0.0, 1.0));    // o mesmo sombreamento da técnica 1
    color = vec4(v_color * shade, 1.0);
}
