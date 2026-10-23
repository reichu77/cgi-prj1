#version 300 es

// Técnica 2: superfícies e depth buffer.
// Não há atributos nem buffers: gl_InstanceID diz qual é o site e
// gl_VertexID diz qual é o vértice da superfície (0 = topo/centro, resto = borda).

const int MAX_SITES = 32;

uniform vec2 u_site_position[MAX_SITES];
uniform vec3 u_site_color[MAX_SITES];
uniform int u_n_sites;      // how many of MAX_SITES are actually in use
uniform int u_metric;       // 0 Euclidean, 1 Manhattan, 2 Chebyshev

uniform vec2 u_center;
uniform float u_scale;
uniform float u_world_half_width;
uniform float u_aspect;     // canvas.width / canvas.height

out vec3 v_color;

// cantos do quadrado, por ordem à volta do centro
const vec2 quadrado[4] = vec2[4](vec2(1.0f, 1.0f), vec2(-1.0f, 1.0f), vec2(-1.0f, -1.0f), vec2(1.0f, -1.0f));

void main() {
    vec2 site = u_site_position[gl_InstanceID];
    vec2 p;
    float r = 2.0f;
    float h;
    if(gl_VertexID == 0) {
        p = site;
        h = 0.0f;      // centro
    } else {
        p = site + r * quadrado[(gl_VertexID - 1) % 4];
        h = r;     // cantos 
    }

    v_color = u_site_color[gl_InstanceID];
    vec2 half_size = vec2(u_world_half_width, u_world_half_width / u_aspect) * u_scale;
    gl_Position = vec4((p - u_center) / half_size, h / 1000.0f, 1.0f);
}
