#version 300 es

precision highp float;

in vec2 v_world;
out vec4 color;

const int MAX_SITES = 32;

uniform vec2  u_site_position[MAX_SITES];
uniform vec3  u_site_color[MAX_SITES];
uniform int   u_n_sites;      // how many of MAX_SITES are actually in use
uniform int   u_metric;       // 0 Euclidean, 1 Manhattan, 2 Chebyshev

float euc_dist(vec2 p,vec2 q){
    float dist = sqrt(pow(p.x - q.x,2.0) + pow(p.y - q.y,2.0));
    return dist;
}

float man_dist(vec2 p,vec2 q){
    float dist = abs(p.x - q.x) + abs(p.y - q.y);
    return dist;
}

float cheb_dist(vec2 p,vec2 q){
    float dist = max(abs(p.x - q.x),abs(p.y - q.y));
    return dist;
}

void main() {
    for(int i=0;i<u_n_sites;i++){
        switch()
    }
    color = vec4(0.2f, 0.4f, 0.6f, 1.0f);
}
