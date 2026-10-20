#version 300 es

precision highp float;

in vec2 v_world;
out vec4 color;

const int MAX_SITES = 32;

uniform vec2 u_site_position[MAX_SITES];
uniform vec3 u_site_color[MAX_SITES];
uniform int u_n_sites;      // how many of MAX_SITES are actually in use
uniform int u_metric;       // 0 Euclidean, 1 Manhattan, 2 Chebyshev

float euc_dist(vec2 p, vec2 q) {
    float dist = sqrt(pow(p.x - q.x, 2.0f) + pow(p.y - q.y, 2.0f));
    return dist;
}

float man_dist(vec2 p, vec2 q) {
    float dist = abs(p.x - q.x) + abs(p.y - q.y);
    return dist;
}

float cheb_dist(vec2 p, vec2 q) {
    float dist = max(abs(p.x - q.x), abs(p.y - q.y));
    return dist;
}

void main() {
    float min_dist = 100000.0f;// a large value because compares first with this one
    int nearest_site = -1; // compares with no one first
    color = vec4(fract(v_world.x), fract(v_world.y), 0.0f, 1.0f);

    for(int i = 0; i < u_n_sites; i++) {
        float d = euc_dist(v_world, u_site_position[i]);
        if(d < min_dist) {
            min_dist = d;
            nearest_site = i;
        }
    }

    if(nearest_site >= 0) {
        color = vec4(float(nearest_site) / float(u_n_sites), 0.0f, 0.0f, 1.0f);
    }
}
