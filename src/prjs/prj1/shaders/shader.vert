#version 300 es

in vec4 s_a_position;

uniform vec2 u_center;
uniform float u_scale;
uniform float u_world_half_width;

void main() {
    gl_Position = vec4((s_a_position.xy - u_center) / (u_scale * u_world_half_width), 0.0, 1.0);
    gl_PointSize = 10.0;
}
