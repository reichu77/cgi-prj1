#version 300 es

// The corners of the quad are already in clip space, so they pass straight
// through.

in vec2 bg_a_position;
uniform vec2 u_center;
uniform float u_scale;
uniform float u_world_half_width;
out vec2 v_world;

void main() {
    gl_Position = vec4(bg_a_position, 0.0f, 1.0f);
    gl_PointSize = 4.0f;
    v_world = bg_a_position * (u_scale * u_world_half_width) + u_center;

}
