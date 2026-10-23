#version 300 es

precision highp float;

in vec2 v_world;
out vec4 color;

const int MAX_SITES = 32;
const float border_tol = 0.05;  // grossura da borda com zoom 1 (multiplicada por u_scale)
const float max_dist = 5.0;

uniform vec2 u_site_position[MAX_SITES];
uniform vec3 u_site_color[MAX_SITES];
uniform int u_n_sites;      // how many of MAX_SITES are actually in use
uniform int u_metric;       // 0 Euclidean, 1 Manhattan, 2 Chebyshev
uniform bool u_borders_on;
uniform float u_scale;     // zoom: a borda tem de escalar com ele para ter sempre a mesma grossura em pixels

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
    int n1 = -1; // compares with no one first,closest site
    int n2 = 0; //second closest site
    float d1 = 1e18; //distance of the closest site
    float d2 = 1e19; //distance of the second closest site
    color = vec4(fract(v_world.x), fract(v_world.y), 0.0f, 1.0f);
    for(int i = 0; i < u_n_sites; i++) {
        float d;
        switch(u_metric){
            case 0:
                d = euc_dist(v_world, u_site_position[i]);
                break;
            case 1:
                 d = man_dist(v_world, u_site_position[i]);
                break;
            case 2:
                 d = cheb_dist(v_world, u_site_position[i]);
                break;
        }
        if (d < d1) {            // mais próximo do que o primeiro
            d2 = d1; 
            n2 = n1;
            d1 = d;  
            n1 = i;
    } else if (d < d2) {     // mais próximo do que o segundo mas mais longe do que o primeiro
        d2 = d;  
        n2 = i;
        }
    }

    if(n1 >= 0 && (abs(d1 - d2) > border_tol * u_scale && u_borders_on || !u_borders_on)) {
        float shade = mix(1.0, 0.3, clamp(d1 / max_dist, 0.0, 1.0));    //sombreamento das áreas
        color = vec4(u_site_color[n1]*shade , 1.0f);
        }
    else if (u_borders_on) color = vec4(1,1,1,1);
}
