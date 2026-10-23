#version 300 es

in vec4 s_a_position;

uniform vec2 u_center;
uniform float u_scale;
uniform float u_world_half_width;
uniform float u_aspect;     // canvas.width / canvas.height

void main() {
    vec2 half_size = vec2(u_world_half_width, u_world_half_width / u_aspect) * u_scale;
    gl_Position = vec4((s_a_position.xy - u_center) / half_size, 0.0, 1.0);
    gl_PointSize = 16.0;
}
