import {shortestLongitude, wrapLongitude, projectOnGlobe, clamp} from './geo.js';
import {stateAt, selectionRect, fullRect, borderRect, borderLines} from './sequence.js';

export class Scene {
  constructor(canvas, globe) {this.canvas=canvas; this.ctx=canvas.getContext('2d', {alpha:false}); this.globe=globe; this.resize(canvas.width,canvas.height);}
  resize(width,height) {
    this.canvas.width=width; this.canvas.height=height; this.width=width; this.height=height;
    this.full=fullRect(width,height);
    this.background=document.createElement('canvas'); this.background.width=width; this.background.height=height;
    const ctx=this.background.getContext('2d'), gradient=ctx.createRadialGradient(width/2,height*.44,0,width/2,height*.44,width*.6);
    gradient.addColorStop(0,'#111e2a'); gradient.addColorStop(1,'#070b10'); ctx.fillStyle=gradient; ctx.fillRect(0,0,width,height);
    this.globe.setSize(width,height);
  }
  globeImage(camera) {
    const {ctx,globe}=this;
    ctx.drawImage(this.background,0,0);
    globe.camera=camera; globe.radius=.335; globe.draw();
    ctx.drawImage(globe.canvas,0,0);
  }
  idle(camera) {this.globeImage(camera); this.credits(false); this.canvas.dataset.phase='idle';}
  prepare(point,start,snapshots,sequence) {
    this.point=point; this.start=start; this.end={...point}; this.duration=sequence.duration; this.images=[null,...snapshots.map(s=>s.canvas)];
    const p=projectOnGlobe(point,this.end), radius=Math.min(this.width,this.height)*.335;
    this.targets=[{x:this.width/2+p.x*radius,y:this.height/2-p.y*radius},...snapshots.map(s=>s.target)];
    this.globeImage(this.end);
    this.images[0]=document.createElement('canvas'); this.images[0].width=this.width; this.images[0].height=this.height;
    this.images[0].getContext('2d').drawImage(this.canvas,0,0);
    this.selections=snapshots.map((_,i)=>selectionRect(this.width,this.height,sequence.ratio,this.targets[i],this.targets[i+1]));
  }
  border(state,selected) {
    const ctx=this.ctx, line=Math.max(1.5,this.height/360), inset=line/2;
    ctx.save(); ctx.strokeStyle='#57c1ff'; ctx.lineWidth=line; ctx.shadowColor='#3aaaff'; ctx.shadowBlur=this.height*.008;
    ctx.beginPath();
    for(const edge of borderLines(state,this.full,selected)) {
      ctx.moveTo(clamp(edge.x1,inset,this.width-inset),clamp(edge.y1,inset,this.height-inset));
      ctx.lineTo(clamp(edge.x2,inset,this.width-inset),clamp(edge.y2,inset,this.height-inset));
    }
    ctx.stroke(); ctx.restore();
  }
  credits(satellite) {
    const ctx=this.ctx, size=Math.round(this.height*.019), left=this.height*.021, bottom=this.height*.021;
    ctx.save(); ctx.font=`${size}px "Segoe UI", Arial, sans-serif`; ctx.textBaseline='bottom';
    const fade=ctx.createLinearGradient(0,this.height-size*4,0,this.height); fade.addColorStop(0,'#070b1000'); fade.addColorStop(1,'#070b10c9');
    ctx.fillStyle=fade; ctx.fillRect(0,this.height-size*4,this.width,size*4); ctx.fillStyle='#b9c4ce';
    if(satellite) {
      ctx.fillText('NASA Earth Observatory · Sentinel-2 cloudless 2024 by EOX',left,this.height-bottom-size*1.5);
      ctx.fillText('Contains modified Copernicus Sentinel data (2024) · CC BY-NC-SA 4.0',left,this.height-bottom);
    } else ctx.fillText('NASA Earth Observatory · Reto Stöckli / Robert Simmon',left,this.height-bottom);
    ctx.restore();
  }
  draw(time) {
    const state=stateAt(time,this.selections.length), {ctx}=this;
    this.canvas.dataset.phase=state.phase; this.canvas.dataset.step=state.step??'';
    if(state.phase==='orbit') {
      const p=state.progress, camera={lat:this.start.lat+(this.end.lat-this.start.lat)*p,lon:wrapLongitude(this.start.lon+shortestLongitude(this.start.lon,this.end.lon)*p)};
      this.globeImage(camera); this.credits(false); this.border(state); return;
    }
    if(state.phase==='final'||state.phase==='rest') {
      const index=state.phase==='final'?state.image:state.step+1;
      ctx.drawImage(this.images[index],0,0); this.credits(true); this.border(state); return;
    }
    const index=state.step, selected=this.selections[index], rect=borderRect(state,this.full,selected);
    ctx.drawImage(this.images[index],0,0);
    if(state.phase==='expand') {
      // Enlarge the exact selected crop. The incoming image is registered to
      // that crop, then replaces it with higher-resolution satellite detail.
      ctx.drawImage(this.images[index],selected.x,selected.y,selected.width,selected.height,rect.x,rect.y,rect.width,rect.height);
      ctx.save(); ctx.globalAlpha=Math.min(1,state.progress*2); ctx.drawImage(this.images[index+1],rect.x,rect.y,rect.width,rect.height); ctx.restore();
    }
    this.credits(index>0||state.phase==='expand'); this.border(state,selected);
  }
}
