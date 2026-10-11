import {radians, projectOnGlobe} from './geo.js';
export class Globe {
  constructor(canvas, hud) {
    this.canvas = canvas; this.hud = hud; this.ctx = hud.getContext('2d');
    this.camera = {lat:20, lon:-18}; this.radius = .335; this.target = null; this.lock = false;
    this.gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
    if (!this.gl) throw new Error('This browser needs WebGL enabled to display Earth.');
    const gl = this.gl;
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 uv; void main(){uv=position;gl_Position=vec4(position,0.,1.);}');
    const fragment = shader(gl.FRAGMENT_SHADER, `
      precision highp float; varying vec2 uv; uniform sampler2D earth; uniform vec2 resolution; uniform vec2 camera; uniform float radius;
      const float PI=3.141592653589793;
      void main(){
        vec2 p=uv*resolution/min(resolution.x,resolution.y)/(radius*2.); float rr=dot(p,p);
        if(rr>1.){float a=exp(-(sqrt(rr)-1.)*65.)*.28;gl_FragColor=vec4(.20,.45,.68,a);return;}
        float z=sqrt(1.-rr); float s=sin(camera.x),c=cos(camera.x);
        float yy=p.y*c+z*s; float zz=z*c-p.y*s; float longitude=atan(p.x,zz)+camera.y;
        vec2 tex=vec2(fract(longitude/(2.*PI)+.5),.5-asin(clamp(yy,-1.,1.))/PI);
        vec3 color=texture2D(earth,tex).rgb;
        float light=.58+.42*max(0.,dot(vec3(p,z),normalize(vec3(-.5,.4,1.))));
        color*=light; color=mix(color,vec3(.13,.32,.52),pow(1.-z,3.)*.62);
        gl_FragColor=vec4(color,1.);
      }`);
    this.program = gl.createProgram(); gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program,'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    this.uniforms = Object.fromEntries(['earth','resolution','camera','radius'].map(key=>[key,gl.getUniformLocation(this.program,key)]));
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.resize = ()=>{const box=canvas.getBoundingClientRect();this.width=box.width;this.height=box.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);hud.width=canvas.width;hud.height=canvas.height;gl.viewport(0,0,canvas.width,canvas.height);this.ctx.setTransform(dpr,0,0,dpr,0,0);};
    this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
  }
  async load(url) {
    const image=new Image();image.src=url;await image.decode();
    // Keep the texture below the GPU's maximum size, retaining the global bounds.
    const limit=Math.min(4096,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE));
    let source=image;
    if(image.width>limit){source=document.createElement('canvas');source.width=limit;source.height=limit/2;source.getContext('2d').drawImage(image,0,0,source.width,source.height);}
    this.gl.bindTexture(this.gl.TEXTURE_2D,this.texture);this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGB,this.gl.RGB,this.gl.UNSIGNED_BYTE,source);this.loaded=true;
  }
  draw(time, mapMode=false, mapPoint=null) {
    const gl=this.gl;gl.useProgram(this.program);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    if(this.loaded&&!mapMode){gl.uniform2f(this.uniforms.resolution,this.canvas.width,this.canvas.height);gl.uniform2f(this.uniforms.camera,radians(this.camera.lat),radians(this.camera.lon));gl.uniform1f(this.uniforms.radius,this.radius);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
    const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);
    let position=null;
    if(mapMode&&mapPoint)position=mapPoint;
    else if(this.target){const p=projectOnGlobe(this.target,this.camera);if(p.visible){const r=Math.min(w,h)*this.radius;position={x:w/2+p.x*r,y:h/2-p.y*r};}}
    if(!position)return;
    const {x,y}=position;ctx.save();ctx.translate(x,y);ctx.strokeStyle=this.lock?'#eabd71':'#eabd7170';ctx.lineWidth=1;
    const size=this.lock?25:17;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx*size,sy*(size-8));ctx.lineTo(sx*size,sy*size);ctx.lineTo(sx*(size-8),sy*size);ctx.stroke();});
    ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.stroke();
    if(this.lock){ctx.setLineDash([2,6]);ctx.strokeStyle='#eabd7145';ctx.beginPath();ctx.arc(0,0,43,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font='8px Consolas, monospace';ctx.fillStyle='#eabd71';ctx.fillText('TARGET',size+10,-size+6);}
    ctx.restore();
  }
}
