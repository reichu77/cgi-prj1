#version 300 es

// Técnica 2: superfícies e depth buffer.
// Não há atributos nem buffers: gl_InstanceID diz qual é o site e
// gl_VertexID diz qual é o vértice da superfície (0 = topo/centro, resto = borda).
// A altura de cada ponto da superfície é a distância ao site; essa altura vai
// para a profundidade, e o depth test fica com a superfície mais baixa, ou seja,
// com o site mais próximo.

const int MAX_SITES = 32;
const float PI = 3.14159265;
const int N_LADOS = 62;     // cone: 64 vértices = 1 centro + 63 na borda (o último repete o primeiro)

uniform vec2 u_site_position[MAX_SITES];
uniform vec3 u_site_color[MAX_SITES];
uniform int u_n_sites;      // how many of MAX_SITES are actually in use
uniform int u_metric;       // 0 Euclidean, 1 Manhattan, 2 Chebyshev

uniform vec2 u_center;
uniform float u_scale;
uniform float u_world_half_width;
uniform float u_aspect;     // canvas.width / canvas.height

out vec3 v_color;
out float v_dist;           // distância ao site, para o sombreamento ser igual ao da técnica 1

// cantos do quadrado (Chebyshev), por ordem à volta do centro
const vec2 quadrado[4] = vec2[4](vec2(1.0f, 1.0f), vec2(-1.0f, 1.0f), vec2(-1.0f, -1.0f), vec2(1.0f, -1.0f));
// cantos do losango (Manhattan), por ordem à volta do centro
const vec2 losango[4] = vec2[4](vec2(1.0f, 0.0f), vec2(0.0f, 1.0f), vec2(-1.0f, 0.0f), vec2(0.0f, -1.0f));

// distância (euclidiana) do site ao canto visível mais afastado
float alcance(vec2 site, vec2 half_size) {
    return length(abs(site - u_center) + half_size);
}

void main() {
    vec2 half_size = vec2(u_world_half_width, u_world_half_width / u_aspect) * u_scale;
    vec2 site = u_site_position[gl_InstanceID];

    // raio da superfície: tem de chegar a todo o canvas visível. Um círculo de raio
    // 'a' cabe dentro do quadrado de raio a, do losango de raio a*sqrt(2) e do
    // polígono de raio a/cos(PI/N_LADOS)
    float a = alcance(site, half_size);
    float r;
    if(u_metric == 0)
        r = a / cos(PI / float(N_LADOS));
    else if(u_metric == 1)
        r = a * sqrt(2.0f);
    else
        r = a;

    vec2 p;
    float h;
    if(gl_VertexID == 0) {
        p = site;       // centro: em cima do site, distância 0
        h = 0.0f;
    } else {
        int k = gl_VertexID - 1;
        vec2 dir;
        if(u_metric == 0) {
            float ang = 2.0f * PI * float(k) / float(N_LADOS);
            dir = vec2(cos(ang), sin(ang));
        } else if(u_metric == 1)
            dir = losango[k % 4];
        else
            dir = quadrado[k % 4];
        p = site + r * dir;
        h = r;          // todos os pontos da borda estão à distância r do site
    }

    // a profundidade tem de usar a mesma escala em todos os sites, senão não dá
    // para comparar superfícies diferentes: divide-se pela maior altura possível
    float h_max = 0.0f;
    for(int i = 0; i < u_n_sites; i++)
        h_max = max(h_max, alcance(u_site_position[i], half_size));
    h_max *= 2.0f;      // maior do que qualquer r acima (sqrt(2) e 1/cos(PI/62) < 2)

    v_color = u_site_color[gl_InstanceID];
    v_dist = h;
    gl_Position = vec4((p - u_center) / half_size, h / h_max * 2.0f - 1.0f, 1.0f);   // h em [0, h_max] -> z em [-1, 1]
}
