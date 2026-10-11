import test from 'node:test';
import assert from 'node:assert/strict';
import {INTRO,STEP,TIMING,GLOBE_START,SELECTION_RATIO,FINAL_ZOOM,createSequence,easeOut,stateAt,selectionRect,fullRect,borderRect,borderLines,randomViewPositions} from '../dist/sequence.js';
import {projectOnGlobe} from '../dist/geo.js';
import {Scene} from '../dist/scene.js';
const {zooms:ZOOMS,duration:DURATION}=createSequence();
const frameAt=time=>stateAt(time,ZOOMS.length);

test('border closes vertically before narrowing horizontally',()=>{
  const full=fullRect(1920,1080), crop=selectionRect(1920,1080,1/8,{x:960,y:540});
  const y=borderRect(frameAt(INTRO+TIMING.y/2),full,crop);
  assert.equal(y.x,0); assert.equal(y.width,1920); assert.ok(y.height<1080&&y.height>crop.height);
  const x=borderRect(frameAt(INTRO+TIMING.y+TIMING.x/2),full,crop);
  assert.equal(x.y,crop.y); assert.equal(x.height,crop.height); assert.ok(x.width<1920&&x.width>crop.width);
});
test('selected region expands to the full frame without changing aspect ratio',()=>{
  const full=fullRect(1920,1080), crop=selectionRect(1920,1080,1/8,{x:960,y:540});
  assert.deepEqual(borderRect({phase:'hold'},full,crop),crop);
  for(const progress of [0,.2,.5,.9,1]) {
    const r=borderRect({phase:'expand',progress},full,crop);
    assert.ok(Math.abs(r.width/r.height-16/9)<1e-12);
    assert.ok(r.width>=crop.width&&r.width<=1920);
  }
  assert.deepEqual(borderRect({phase:'expand',progress:1},full,crop),full);
});
test('crop registers a target between zoom levels even at a constrained polar centre',()=>{
  const from={x:960,y:24},to={x:960,y:192},ratio=1/8;
  const r=selectionRect(1920,1080,ratio,from,to);
  assert.equal(r.y,0); assert.equal((from.x-r.x)/ratio,to.x); assert.equal((from.y-r.y)/ratio,to.y);
  assert.equal(r.width/r.height,16/9);
});
test('timeline covers each zoom once and holds the final frame for export',()=>{
  for(let i=0;i<ZOOMS.length;i++)assert.equal(frameAt(INTRO+i*STEP+.001).step,i);
  assert.equal(frameAt(0).phase,'orbit'); assert.equal(frameAt(TIMING.orbit+.1).progress,1);
  assert.deepEqual(frameAt(DURATION-.1),{phase:'final',image:ZOOMS.length});
  assert.deepEqual(frameAt(DURATION+100),frameAt(DURATION));
});
test('independent scan lines retain their full span until both axes have closed',()=>{
  const full=fullRect(1920,1080), crop=selectionRect(1920,1080,1/8,{x:1250,y:350});
  const initial=borderLines({phase:'rest'},full),y=borderLines({phase:'y',progress:.7},full,crop),x=borderLines({phase:'x',progress:.5},full,crop);
  assert.deepEqual(y[2],initial[2]);assert.deepEqual(y[3],initial[3]);
  assert.equal(x[0].x1,initial[0].x1);assert.equal(x[0].x2,initial[0].x2);
  assert.equal(x[2].y1,initial[2].y1);assert.equal(x[2].y2,initial[2].y2);
  assert.equal(initial[0].x1,initial[2].x1);assert.equal(initial[2].y1,initial[0].y1);
});
test('scan lines meet every corner when the view reaches the full frame',()=>{
  const full=fullRect(1920,1080),crop=selectionRect(1920,1080,SELECTION_RATIO,{x:1200,y:390});
  for(const state of [{phase:'orbit'},{phase:'expand',progress:1}]){
    const [top,bottom,left,right]=borderLines(state,full,crop);
    assert.deepEqual([top.x1,top.y1],[left.x1,left.y1]);
    assert.deepEqual([top.x2,top.y2],[right.x1,right.y1]);
    assert.deepEqual([bottom.x1,bottom.y1],[left.x2,left.y2]);
    assert.deepEqual([bottom.x2,bottom.y2],[right.x2,right.y2]);
  }
});
test('all four lines remain full length throughout the selection hold and tile expansion',()=>{
  const full=fullRect(1920,1080),crop=selectionRect(1920,1080,SELECTION_RATIO,{x:1200,y:390});
  for(const phase of ['hold','expand'])for(const progress of [0,.1,.5,.9,1]){
    const [top,bottom,left,right]=borderLines({phase,progress},full,crop);
    for(const horizontal of [top,bottom]){assert.equal(horizontal.x1,0);assert.equal(horizontal.x2,1920);}
    for(const vertical of [left,right]){assert.equal(vertical.y1,0);assert.equal(vertical.y2,1080);}
  }
  const [top,bottom,left,right]=borderLines({phase:'hold',progress:1},full,crop);
  assert.equal(top.y1,crop.y);assert.equal(bottom.y1,crop.y+crop.height);
  assert.equal(left.x1,crop.x);assert.equal(right.x1,crop.x+crop.width);
  assert.deepEqual(borderLines({phase:'hold',progress:1},full,crop),borderLines({phase:'expand',progress:0},full,crop));
});
test('line movement starts quickly and continuously slows towards the selected rectangle',()=>{
  const positions=[0,.25,.5,.75,1].map(easeOut),distances=positions.slice(1).map((p,i)=>p-positions[i]);
  assert.equal(positions[0],0);assert.equal(positions.at(-1),1);
  assert.ok(distances.every((d,i)=>i===0||d<distances[i-1]));
  assert.ok(frameAt(INTRO+TIMING.y*.25).progress>.5);
  assert.ok(frameAt(INTRO+TIMING.y+TIMING.x*.25).progress>.5);
});
test('intermediate views vary, the final target is centred, and every crop registers at all supported sizes',()=>{
  const width=1920,height=1080;
  for(const ratio of [.01,.05,.125,.25,.5])for(const sample of [0,.25,.5,.75,.999]){
    const {zooms}=createSequence(ratio),positions=randomViewPositions(width,height,zooms.length,ratio,()=>sample);
    assert.deepEqual(positions.at(-1),{x:width/2,y:height/2});
    for(const p of positions.slice(0,-1))assert.ok(Math.hypot(p.x-width/2,p.y-height/2)>40);
    const targets=[{x:width/2,y:height/2},...positions];
    for(let i=1;i<targets.length;i++){
      const r=selectionRect(width,height,ratio,targets[i-1],targets[i]);
      assert.ok(Math.abs((targets[i-1].x-r.x)/ratio-targets[i].x)<1e-9);
      assert.ok(Math.abs((targets[i-1].y-r.y)/ratio-targets[i].y)<1e-9);
    }
  }
});
test('each ratio matches the map scale, keeps final detail, and sets the entire export timeline',()=>{
  for(const ratio of [.01,.05,.1,.125,.25,.5]){
    const {zooms,duration}=createSequence(ratio);
    assert.ok(zooms[0]>=4-1e-9);assert.equal(zooms.at(-1),FINAL_ZOOM);
    for(let i=1;i<zooms.length;i++)assert.ok(Math.abs(2**(zooms[i-1]-zooms[i])-ratio)<1e-12);
    assert.equal(duration,INTRO+STEP*zooms.length+TIMING.end);
    for(let i=0;i<zooms.length;i++)assert.equal(stateAt(INTRO+i*STEP+.001,zooms.length).step,i);
    assert.deepEqual(stateAt(duration-.01,zooms.length),{phase:'final',image:zooms.length});
  }
  assert.deepEqual(createSequence(.125).zooms,[4,7,10,13]);
  for(const ratio of [NaN,0,.009,.501,1])assert.throws(()=>createSequence(ratio),/1% and 50%/);
});
test('prepared renderer starts over Asia, ends facing the destination, and uses one ratio throughout',()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
  try{
    for(const point of [{lat:51.5,lon:0},{lat:-33.8,lon:151.2},{lat:85,lon:179}]){
      const sequence=createSequence(.25),targets=randomViewPositions(1920,1080,sequence.zooms.length,sequence.ratio,()=>.25);
      const scene=Object.create(Scene.prototype);
      Object.assign(scene,{width:1920,height:1080,canvas:{},globeImage(camera){this.capturedCamera={...camera};}});
      scene.prepare(point,{...GLOBE_START},targets.map(target=>({canvas:{},target})),sequence);
      assert.deepEqual(scene.start,{lat:25,lon:105});assert.deepEqual(scene.end,point);assert.deepEqual(scene.capturedCamera,point);
      assert.equal(scene.duration,sequence.duration);
      const projected=projectOnGlobe(point,scene.end);
      assert.equal(projected.visible,true);assert.ok(Math.hypot(projected.x,projected.y)<1e-12);
      assert.deepEqual(scene.targets.at(-1),{x:960,y:540});
      for(const crop of scene.selections){assert.equal(crop.width,1920*.25);assert.equal(crop.height,1080*.25);}
    }
  }finally{globalThis.document=originalDocument;}
});
