import { loadShadersFromURLS, buildProgramFromSources, setupWebGL } from "../../libs/utils.js";
import { vec2,vec3, flatten } from "../../libs/MV.js";

/** @type {HTMLCanvasElement} */
let canvas;
/** @type {WebGL2RenderingContext} */
let gl;

const MAX_SITES = 32;
const FLOATS_PER_POINT = 2;
const FSIZE = Float32Array.BYTES_PER_ELEMENT; // 4 bytes
const STRIDE = 2 * FSIZE;
const WORLD_HALF_WIDTH = 10.0;
const DRAG_THRESHOLD = 4;
const sites = [];
const sites_col = [];

let quad_program;
let sites_program;
let surface_program;
let quad_vao;       // the quad covering the whole viewport
let sites_vao;
let surface_vao;    // vazio: a técnica 2 não lê buffers, só gl_VertexID e gl_InstanceID
let scale = 1;
var sitesBuffer;
var metric = 0;
var render_type = 0;    // 0 search (fragment shader), 1 superfícies (vertex shader)
var lastPos = null;
var drag_point = null;
var borders = true;


var bg_u_center_loc, bg_u_world_half_width_loc, bg_u_scale_loc,
    bg_u_sites_pos_loc, bg_u_metric_loc, bg_u_n_sites_loc, bg_u_sites_col_loc,
    bg_u_borders_loc, bg_u_aspect_loc;
var s_u_center_loc, s_u_world_half_width_loc, s_u_scale_loc, s_u_aspect_loc;

var sur_u_center_loc,sur_u_metric_loc,sur_u_n_sites_loc,
    sur_u_scale_loc,sur_u_sites_col_loc,sur_u_sites_pos_loc,sur_u_world_half_width_loc,
    sur_u_aspect_loc;

var u_center = [0.0, 0.0];
var mouseDownPos = null;
var mousePos = null;
var panning = false;


// ---------------------------------------------------------------------------
// Input. The event listeners are already set up in setup_input(); fill in
// these functions. Mouse positions are in canvas pixels, with (0, 0) at the
// top-left corner and y growing downwards.
// ---------------------------------------------------------------------------
function find_site(x,y){                //função auxiliar que verifica se o rato está em cima de um ponto
    for(var i = 0;i < sites.length;i++){
        const dx = x-sites[i][0];
        const dy = y-sites[i][1];
        if(Math.hypot(dx,dy) <= ((14*2*WORLD_HALF_WIDTH*scale)/canvas.width)){
           //console.log("Site found"); 
            return i;
        }
        //console.log("Resultado da pesquisa",dx,dy,Math.hypot(dx,dy),((8*2*WORLD_HALF_WIDTH*scale)/canvas.width));
    }
    return null;
}
function on_mouse_down(x, y) {
    console.log("Click:",x,y);
    mouseDownPos = [x, y];              //posição do rato quando dispara o evento mouseDown
    lastPos = [x, y];
    //mousePos = mouseDownPos;
    console.log(JSON.stringify(mousePos));
    const [wx,wy] = to_clip_space(x,y);     //conversão de x e y para coordenadas do mundo para serem usadas na função find_site
    drag_point = find_site(wx,wy);
    panning = false;
}

function on_mouse_move(x, y) {
    if (!mouseDownPos) return;
    
    const dx = x - mouseDownPos[0];         //deslocação do rato no eixo do x e y
    const dy = y - mouseDownPos[1];

    if (!panning && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        panning = true;
        console.log("Panning...");
    }

    if (panning) {
        // tamanho de um pixel em unidades do mundo (agora é igual em x e y)
        const scaleX = (scale * 2 * WORLD_HALF_WIDTH) / (canvas.width);
        const scaleY = (scale * 2 * WORLD_HALF_WIDTH / aspect()) / (canvas.height);
        if (drag_point == null) {
            u_center[0] -= (x - lastPos[0]) * scaleX;       //caso não esteja em cima de um ponto
            u_center[1] += (y - lastPos[1]) * scaleY;       
        }
        else{
            sites[drag_point][0] += (x - lastPos[0]) * scaleX;      //caso esteja em cima de um ponto
            sites[drag_point][1] -= (y - lastPos[1]) * scaleY;
            update_site_buffer(drag_point);
        }  
        lastPos = [x, y];
    }   
}

function on_mouse_up(x, y) {
    if (mouseDownPos && !panning && drag_point  == null && sites.length < MAX_SITES) {
            sites.push([...to_clip_space(x, y)]);
            update_buffer();
            sites_col.push([...random_color()])
            //console.log(JSON.stringify(sites));
        }
        panning = false;        //fim de pan
        mouseDownPos = null;    //reset da posição de mouse_down
        drag_point = null;      //reset do indice do ponto movido
}

// dy > 0 when the wheel is scrolled down (towards the user)
function on_wheel(x, y, dy) {
    scale = Math.min(4.0, Math.max(0.2, scale * (1 + dy / 1000)));
}

function on_key(key) {
    switch (key) {
        case '1':       // Euclidean distance
        metric = 0;
            break;
        case '2':       // Manhattan distance
        metric = 1;
            break;
        case '3':       // Chebyshev distance
        metric = 2;
            break;
        case 'b':       // toggle cell borders
            if(borders){borders = false;}
            else {borders = true;}
            break;
        case 'x': {       // remove the site under the pointer
            if (!mousePos) break;       //rato fora do canvas
            const [wx,wy] = to_clip_space(mousePos[0],mousePos[1]);     //conversão de x e y para coordenadas do mundo para serem usadas na função find_site
            let i = find_site(wx,wy);
            console.log("Site encontrado:",i);
            if(i != null){
                var p = i;
                sites.splice(i,1);
                sites_col.splice(i,1);
                drag_point = null;
                while(p < sites.length){        //os sites depois de i mudaram de índice, é preciso reescrevê-los no buffer
                    update_site_buffer(p);
                    p += 1;
                }
            }
            break;
        }
        case 'm':       // switch rendering technique / split view
            render_type = (render_type + 1) % 2;
            break;
    }
}

// ---------------------------------------------------------------------------

function aspect() {
    return canvas.width / canvas.height;
}

function to_clip_space(x, y) {
    return vec2(((x / canvas.width) * 2 - 1) * WORLD_HALF_WIDTH * scale + u_center[0],
            (1 - (y / canvas.height) * 2) * (WORLD_HALF_WIDTH / aspect()) * scale + u_center[1]);  // invertido: os pixels crescem para baixo, o espaço de recorte cresce para cima
}

function update_buffer() {
    const offset = (sites.length - 1) * FLOATS_PER_POINT * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, flatten([sites[sites.length - 1]]));
}

function random_color() {
        return vec3(Math.random(), Math.random(), Math.random());
    }
function update_site_buffer(i) {
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, i * STRIDE, new Float32Array(sites[i]));
}

function resize() {
    // Match the canvas's drawing bgBuffer to the size it is shown at, and
    // draw over all of it
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function setup_input() {
    canvas.addEventListener("mousedown", (event) => on_mouse_down(event.offsetX, event.offsetY));
    canvas.addEventListener("mousemove", (event) => {
        mousePos = [event.offsetX,event.offsetY];
        on_mouse_move(event.offsetX, event.offsetY)});
    window.addEventListener("mouseup", (event) => on_mouse_up(event.offsetX, event.offsetY));
    canvas.addEventListener("wheel", (event) => {
        on_wheel(event.offsetX, event.offsetY, event.deltaY);
        event.preventDefault();     // don't let the page scroll as well
    });
    canvas.addEventListener("mouseleave", () => { mousePos = null; });
    window.addEventListener("keydown", (event) => on_key(event.key));
}

function setup(shaders) {
    canvas = document.getElementById("gl-canvas");
    gl = setupWebGL(canvas);

    quad_program = buildProgramFromSources(gl, shaders["quad.vert"], shaders["quad.frag"]);
    sites_program = buildProgramFromSources(gl,shaders["shader.vert"],shaders["shader.frag"]);
    surface_program = buildProgramFromSources(gl,shaders["surface.vert"],shaders["surface.frag"]);


    // A quad covering the whole viewport, as two triangles: its corners are
    // the corners of clip space, from (-1, -1) to (1, 1)
    const corners = new Float32Array([
        -1, -1,     1, -1,     1, 1,       // first triangle
        -1, -1,     1, 1,     -1, 1,       // second triangle
    ]);

    /** @type {WebGLBuffer} */
    const bgBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);

    sitesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_SITES * STRIDE, gl.DYNAMIC_DRAW);
 

    quad_vao = gl.createVertexArray();
    gl.bindVertexArray(quad_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuffer);
    const bg_a_position = gl.getAttribLocation(quad_program, "bg_a_position");
    bg_u_scale_loc = gl.getUniformLocation(quad_program, "u_scale");
    bg_u_center_loc = gl.getUniformLocation(quad_program, "u_center");
    bg_u_world_half_width_loc = gl.getUniformLocation(quad_program, "u_world_half_width");
    bg_u_aspect_loc = gl.getUniformLocation(quad_program, "u_aspect");
    bg_u_sites_pos_loc = gl.getUniformLocation(quad_program,"u_site_position");
    bg_u_sites_col_loc = gl.getUniformLocation(quad_program,"u_site_color");
    bg_u_n_sites_loc = gl.getUniformLocation(quad_program,"u_n_sites");
    bg_u_borders_loc = gl.getUniformLocation(quad_program, "u_borders_on");
    bg_u_metric_loc = gl.getUniformLocation(quad_program,"u_metric");
    gl.vertexAttribPointer(bg_a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(bg_a_position);

    sites_vao = gl.createVertexArray();
    gl.bindVertexArray(sites_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    const s_a_position = gl.getAttribLocation(sites_program, "s_a_position");
    s_u_scale_loc = gl.getUniformLocation(sites_program, "u_scale");
    s_u_center_loc = gl.getUniformLocation(sites_program, "u_center");
    s_u_world_half_width_loc = gl.getUniformLocation(sites_program, "u_world_half_width");
    s_u_aspect_loc = gl.getUniformLocation(sites_program, "u_aspect");
    gl.vertexAttribPointer(s_a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(s_a_position);

    surface_vao = gl.createVertexArray();
    sur_u_scale_loc = gl.getUniformLocation(surface_program, "u_scale");
    sur_u_center_loc = gl.getUniformLocation(surface_program, "u_center");
    sur_u_world_half_width_loc = gl.getUniformLocation(surface_program, "u_world_half_width");
    sur_u_aspect_loc = gl.getUniformLocation(surface_program, "u_aspect");
    sur_u_sites_pos_loc = gl.getUniformLocation(surface_program,"u_site_position");
    sur_u_sites_col_loc = gl.getUniformLocation(surface_program,"u_site_color");
    sur_u_n_sites_loc = gl.getUniformLocation(surface_program,"u_n_sites");
    sur_u_metric_loc = gl.getUniformLocation(surface_program,"u_metric");

    gl.bindVertexArray(null);

    resize();
    window.addEventListener("resize", resize);
    setup_input();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    window.requestAnimationFrame(animate);
}

function animate(timestamp) {
    window.requestAnimationFrame(animate);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if(render_type == 0){
        gl.useProgram(quad_program);
        gl.bindVertexArray(quad_vao);

        gl.uniform2fv(bg_u_center_loc, u_center);
        gl.uniform1f(bg_u_world_half_width_loc, WORLD_HALF_WIDTH);
        gl.uniform1f(bg_u_aspect_loc, aspect());
        gl.uniform1f(bg_u_scale_loc, scale);
        if (sites.length > 0) gl.uniform2fv(bg_u_sites_pos_loc,flatten(sites));    //array vazio dá erro no WebGL
        gl.uniform1i(bg_u_n_sites_loc,sites.length);
        gl.uniform1i(bg_u_metric_loc,metric);
        if (sites.length > 0) gl.uniform3fv(bg_u_sites_col_loc,flatten(sites_col));    //array vazio dá erro no WebGL
        gl.uniform1i(bg_u_borders_loc, borders ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    else{
        gl.useProgram(surface_program);
        gl.bindVertexArray(surface_vao);

        gl.uniform2fv(sur_u_center_loc, u_center);
        gl.uniform1f(sur_u_world_half_width_loc, WORLD_HALF_WIDTH);
        gl.uniform1f(sur_u_aspect_loc, aspect());
        gl.uniform1f(sur_u_scale_loc, scale);
        if (sites.length > 0) gl.uniform2fv(sur_u_sites_pos_loc,flatten(sites));    //array vazio dá erro no WebGL
        gl.uniform1i(sur_u_n_sites_loc,sites.length);
        gl.uniform1i(sur_u_metric_loc,metric);
        if (sites.length > 0) gl.uniform3fv(sur_u_sites_col_loc,flatten(sites_col));    //array vazio dá erro no WebGL

        if(metric != 1 && metric != 2) {
            gl.drawArraysInstanced(gl.TRIANGLE_FAN,0,64,sites.length);
        gl.enable(gl.DEPTH_TEST);}
        else
            gl.drawArraysInstanced(gl.TRIANGLE_FAN,0,6,sites.length); // penso q tem de ser 6 
        gl.enable(gl.DEPTH_TEST);
    }

    gl.useProgram(sites_program);
    gl.bindVertexArray(sites_vao);
    
    gl.uniform2fv(s_u_center_loc, u_center);
    gl.uniform1f(s_u_world_half_width_loc, WORLD_HALF_WIDTH);
    gl.uniform1f(s_u_aspect_loc, aspect());
    gl.uniform1f(s_u_scale_loc, scale);
    gl.drawArrays(gl.POINTS,0,sites.length);

    gl.bindVertexArray(null);
}

loadShadersFromURLS(["quad.vert", "quad.frag","shader.frag","shader.vert","surface.frag","surface.vert"]).then(shaders => setup(shaders));
