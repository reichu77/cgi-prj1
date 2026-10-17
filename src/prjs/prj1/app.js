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
let quad_vao;       // the quad covering the whole viewport
let sites_vao;
let scale = 1;
var sitesBuffer;
var metric = 0;
var lastPos = null;
var drag_point = null;


var bg_u_center_loc, bg_u_world_half_width_loc, bg_u_scale_loc,
    bg_u_colors_loc, bg_u_points_loc,bg_u_sites_pos, bg_u_metric_pos,
    bg_u_n_sites_pos;
var s_u_center_loc, s_u_world_half_width_loc, s_u_scale_loc;

var u_center = [0.0, 0.0];
var mouseDownPos = null;
var panning = false;


// ---------------------------------------------------------------------------
// Input. The event listeners are already set up in setup_input(); fill in
// these functions. Mouse positions are in canvas pixels, with (0, 0) at the
// top-left corner and y growing downwards.
// ---------------------------------------------------------------------------
function find_site(x,y){
    for(var i = 0;i < sites.length;i++){
        const dx = x-sites[i][0];
        const dy = y-sites[i][1];
        if(Math.hypot(dx,dy) <= ((8*2*WORLD_HALF_WIDTH*scale)/canvas.width)){
           console.log("Site found"); 
            return i;
        }
        console.log("Resultado da pesquisa",dx,dy,Math.hypot(dx,dy),((8*2*WORLD_HALF_WIDTH*scale)/canvas.width));
    }
    return null;
}
function on_mouse_down(x, y) {
    console.log("Click:",x,y);
    mouseDownPos = [x, y];
    lastPos = [x, y];
    const [wx,wy] = to_clip_space(x,y);
    drag_point = find_site(wx,wy);
    console.log(drag_point);
    panning = false;
}

function on_mouse_move(x, y) {
    if (!mouseDownPos) return;
    
        const dx = x - mouseDownPos[0];
        const dy = y - mouseDownPos[1];

        if (!panning && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
            panning = true;
            console.log("Panning...");
        }

    if (panning) {
        const scaleX = (scale * 2 * WORLD_HALF_WIDTH) / (canvas.width);
        const scaleY = (scale * 2 * WORLD_HALF_WIDTH) / (canvas.height);
        if (drag_point == null) {
            u_center[0] -= (x - lastPos[0]) * scaleX;
            u_center[1] += (y - lastPos[1]) * scaleY;
        }
        else{
            sites[drag_point][0] += (x - lastPos[0]) * scaleX;
            sites[drag_point][1] -= (y - lastPos[1]) * scaleY;
            update_site_buffer(drag_point);
        }
        lastPos = [x, y]
    }
}

function on_mouse_up(x, y) {
    if (mouseDownPos && !panning && drag_point  == null) {
            sites.push([...to_clip_space(x, y)]);
            update_buffer();
            console.log(JSON.stringify(sites));
        }
        panning = false;
        mouseDownPos = null;
        drag_point = null;
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
            break;
        case 'x':       // remove the site under the pointer
            break;
        case 'm':       // switch rendering technique / split view
            break;
    }
}

// ---------------------------------------------------------------------------

function to_clip_space(x, y) {
    return vec2(((x / canvas.width) * 2 - 1) * WORLD_HALF_WIDTH * scale + u_center[0],
            (1 - (y / canvas.height) * 2) * WORLD_HALF_WIDTH * scale + u_center[1]);  // invertido: os pixels crescem para baixo, o espaço de recorte cresce para cima
}

function update_buffer() {
    const offset = (sites.length - 1) * FLOATS_PER_POINT * 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, flatten([sites[sites.length - 1]]));
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
    canvas.addEventListener("mousemove", (event) => on_mouse_move(event.offsetX, event.offsetY));
    window.addEventListener("mouseup", (event) => on_mouse_up(event.offsetX, event.offsetY));
    canvas.addEventListener("wheel", (event) => {
        on_wheel(event.offsetX, event.offsetY, event.deltaY);
        event.preventDefault();     // don't let the page scroll as well
    });
    window.addEventListener("keydown", (event) => on_key(event.key));
}

function setup(shaders) {
    canvas = document.getElementById("gl-canvas");
    gl = setupWebGL(canvas);

    quad_program = buildProgramFromSources(gl, shaders["quad.vert"], shaders["quad.frag"]);
    sites_program = buildProgramFromSources(gl,shaders["shader.vert"],shaders["shader.frag"]);


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
    bg_u_sites_pos = gl.getUniformLocation(quad_program,"u_sites_position");
    bg_u_n_sites_pos = gl.getUniformLocation(quad_program,"u_n_sites");
    bg_u_metric_pos = gl.getUniformLocation(quad_program,"u_metric");
    gl.vertexAttribPointer(bg_a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(bg_a_position);

    sites_vao = gl.createVertexArray();
    gl.bindVertexArray(sites_vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sitesBuffer);
    const s_a_position = gl.getAttribLocation(sites_program, "s_a_position");
    s_u_scale_loc = gl.getUniformLocation(sites_program, "u_scale");
    s_u_center_loc = gl.getUniformLocation(sites_program, "u_center");
    s_u_world_half_width_loc = gl.getUniformLocation(sites_program, "u_world_half_width");
    gl.vertexAttribPointer(s_a_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(s_a_position);
   
    gl.bindVertexArray(null);

    resize();
    window.addEventListener("resize", resize);
    setup_input();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    window.requestAnimationFrame(animate);
}

function animate(timestamp) {
    window.requestAnimationFrame(animate);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(quad_program);
    gl.bindVertexArray(quad_vao);

    //gl.uniform2fv(bg_u_center_loc, u_center);
    //gl.uniform1f(bg_u_world_half_width_loc, WORLD_HALF_WIDTH);
    //gl.uniform1f(bg_u_scale_loc, scale);
    gl.uniform2fv(bg_u_sites_pos,sites);
    gl.uniform1i(bg_u_n_sites_pos,sites.length);
    gl.uniform1i(bg_u_metric_pos,metric);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(sites_program);
    gl.bindVertexArray(sites_vao);
    
    gl.uniform2fv(s_u_center_loc, u_center);
    gl.uniform1f(s_u_world_half_width_loc, WORLD_HALF_WIDTH);
    gl.uniform1f(s_u_scale_loc, scale);
    gl.drawArrays(gl.POINTS,0,sites.length);

    gl.bindVertexArray(null);
}

loadShadersFromURLS(["quad.vert", "quad.frag","shader.frag","shader.vert"]).then(shaders => setup(shaders));
