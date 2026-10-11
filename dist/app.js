import {Globe} from './globe.js';
import {Scene} from './scene.js';
import {parseCoordinates,wrapLongitude} from './geo.js';
import {GLOBE_START,SELECTION_RATIO,createSequence,randomViewPositions} from './sequence.js';
import {videoFormat,encodeVideo} from './video.js';

const $=id=>document.getElementById(id);
const tiles='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let scene,map,mapError,ready=false,busy=false,clip=null,controller,downloadUrl,extentUrl;

function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function size(){return $('resolution').value==='1080'?{width:1920,height:1080}:{width:1280,height:720};}
function setBusy(value){busy=value;for(const id of ['location','resolution','selection-ratio'])$(id).disabled=value;$('go').disabled=value||!ready;$('save').disabled=value||!clip;$('cancel').hidden=!value;$('back').hidden=value||!clip;$('extent').hidden=value||!clip;}
function ensureActive(signal){if(signal.aborted)throw new DOMException('Cancelled','AbortError');}
function pause(ms,signal){return new Promise((resolve,reject)=>{ensureActive(signal);const onAbort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},ms);signal.addEventListener('abort',onAbort,{once:true});});}
function clearDownload(){if(downloadUrl)URL.revokeObjectURL(downloadUrl);if(extentUrl)URL.revokeObjectURL(extentUrl);downloadUrl=null;extentUrl=null;$('download').hidden=true;$('download').removeAttribute('href');$('download-extent').removeAttribute('href');$('save').hidden=false;}
function reset(){clip=null;clearDownload();$('extent').open=false;setBusy(false);message();scene?.idle(GLOBE_START);}
function showExtent(){
  for(const [corner,coordinate] of Object.entries(clip.corners)){
    $(`extent-${corner}-lat`).textContent=coordinate.lat.toFixed(6);
    $(`extent-${corner}-lon`).textContent=coordinate.lon.toFixed(6);
  }
  const data={crs:'EPSG:4326',destination:clip.point,resolution:{width:clip.width,height:clip.height},selectionRatio:clip.sequence.ratio,zoom:clip.zoom,corners:clip.corners};
  extentUrl=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  $('download-extent').href=extentUrl;
  $('download-extent').download=`earth_${clip.point.lat.toFixed(4)}_${clip.point.lon.toFixed(4)}_${clip.width}x${clip.height}_extent.json`;
}

function getMap(point){
  const {width,height}=size();$('map').style.width=`${width}px`;$('map').style.height=`${height}px`;
  mapError=null;
  if(map){map.stop();map.resize();return;}
  if(!window.maplibregl)throw new Error('The map could not load. Refresh this page.');
  // Preserve the requested centre even beside Mercator's polar boundary.
  map=new maplibregl.Map({container:'map',center:[point.lon,point.lat],zoom:4,transformConstrain:(center,zoom)=>({center,zoom}),pixelRatio:1,interactive:false,renderWorldCopies:true,attributionControl:false,canvasContextAttributes:{preserveDrawingBuffer:true},style:{version:8,sources:{satellite:{type:'raster',tiles:[tiles],tileSize:256,minzoom:0,maxzoom:13}},layers:[{id:'background',type:'background',paint:{'background-color':'#09121a'}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-fade-duration':0,'raster-saturation':-.12,'raster-contrast':.08}}]}});
  map.on('error',()=>{mapError=new Error('Satellite imagery is unavailable. Check the connection and try again.');});
}
async function waitForMap(signal){
  for(let i=0;i<400;i++){
    ensureActive(signal);if(mapError)throw mapError;
    if(map.loaded()&&map.areTilesLoaded()){
      // Ask for a fresh render after the final tile upload before copying WebGL.
      await new Promise((resolve,reject)=>{
        const finish=()=>{cleanup();resolve();}, abort=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
        const timer=setTimeout(()=>{cleanup();reject(new Error('The map did not render. Try again.'));},3000);
        function cleanup(){clearTimeout(timer);map.off('render',finish);signal.removeEventListener('abort',abort);}
        map.once('render',finish);signal.addEventListener('abort',abort,{once:true});map.triggerRepaint();
      });
      ensureActive(signal);if(mapError)throw mapError;return;
    }
    await pause(50,signal);
  }
  throw new Error('Satellite imagery is taking too long to load. Try again.');
}
async function captureViews(point,positions,sequence,signal){
  getMap(point);const snapshots=[],{width,height}=size();
  for(const [i,zoom] of sequence.zooms.entries()){
    ensureActive(signal);message(`Loading satellite views… ${i+1} / ${sequence.zooms.length}`);
    const position=positions[i];
    const padding={left:Math.max(0,position.x*2-width),right:Math.max(0,width-position.x*2),top:Math.max(0,position.y*2-height),bottom:Math.max(0,height-position.y*2)};
    map.jumpTo({center:[point.lon,point.lat],zoom,bearing:0,pitch:0,padding});await waitForMap(signal);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(map.getCanvas(),0,0,width,height);
    const target=map.project([point.lon,point.lat]);
    const corners=Object.fromEntries([['nw',0,0],['ne',width,0],['se',width,height],['sw',0,height]].map(([corner,x,y])=>{
      const coordinate=map.unproject([x,y]);return [corner,{lat:coordinate.lat,lon:wrapLongitude(coordinate.lng)}];
    }));
    snapshots.push({canvas,target:{x:target.x,y:target.y},corners});
  }
  return snapshots;
}
function play(signal){return new Promise((resolve,reject)=>{
  const start=performance.now();let frameId;
  const abort=()=>{cancelAnimationFrame(frameId);reject(new DOMException('Cancelled','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  const frame=now=>{
    if(signal.aborted)return;
    const time=Math.min(scene.duration,(now-start)/1000);scene.draw(time);
    if(time<scene.duration)frameId=requestAnimationFrame(frame);else{signal.removeEventListener('abort',abort);resolve();}
  };frameId=requestAnimationFrame(frame);
});}

$('location-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!ready)return;
  let point;try{point=parseCoordinates($('location').value);}catch(error){message(error.message,true);$('location').setAttribute('aria-invalid','true');$('location').focus();return;}
  let sequence;try{sequence=createSequence(Number($('selection-ratio').value)/100);}catch(error){message(error.message,true);$('selection-ratio').setAttribute('aria-invalid','true');$('selection-ratio').focus();return;}
  $('selection-ratio').removeAttribute('aria-invalid');
  reset();$('location').removeAttribute('aria-invalid');controller=new AbortController();const {signal}=controller;setBusy(true);
  const start={...GLOBE_START};
  try{
    const {width,height}=size(), positions=randomViewPositions(width,height,sequence.zooms.length,sequence.ratio);
    const snapshots=await captureViews(point,positions,sequence,signal);ensureActive(signal);scene.prepare(point,start,snapshots,sequence);
    clip={point,start,width,height,sequence,zoom:sequence.zooms.at(-1),corners:snapshots.at(-1).corners};showExtent();
    message();if(reducedMotion.matches)scene.draw(scene.duration);else await play(signal);
    ensureActive(signal);setBusy(false);
  }catch(error){reset();if(error.name!=='AbortError')message(error.message||'The sequence could not finish. Try again.',true);}
});
$('save').addEventListener('click',async()=>{
  if(busy||!clip)return;
  controller=new AbortController();const {signal}=controller;setBusy(true);message('Preparing video…');
  try{
    const {width,height}=size(),format=await videoFormat(width,height);ensureActive(signal);
    const blob=await encodeVideo(scene,format,signal,progress=>message(`Saving ${format.extension.toUpperCase()} video… ${Math.round(progress*100)}%`));
    ensureActive(signal);downloadUrl=URL.createObjectURL(blob);
    const link=$('download');link.href=downloadUrl;link.download=`earth_${clip.point.lat.toFixed(4)}_${clip.point.lon.toFixed(4)}_${width}x${height}.${format.extension}`;
    link.textContent=`Download ${format.extension.toUpperCase()}`;link.hidden=false;$('save').hidden=true;link.click();
    message(`${width} × ${height} · 30 fps · ${(Math.ceil(scene.duration*30)/30).toFixed(1)} seconds · ${format.extension.toUpperCase()}`);
  }catch(error){if(error.name==='AbortError')message('Video saving cancelled.');else message(error.message||'The video could not be saved. Try again.',true);scene.draw(scene.duration);}
  finally{setBusy(false);}
});
$('cancel').addEventListener('click',()=>controller?.abort());
$('back').addEventListener('click',reset);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&busy)controller?.abort();});
$('location').addEventListener('input',()=>{$('location').removeAttribute('aria-invalid');message();});
$('selection-ratio').addEventListener('input',()=>{$('selection-ratio').removeAttribute('aria-invalid');});
$('selection-ratio').addEventListener('change',reset);
$('resolution').addEventListener('change',()=>{reset();const {width,height}=size();scene.resize(width,height);$('output').setAttribute('aria-label',`Earth sequence, ${width} by ${height}`);map?.remove();map=null;});
window.addEventListener('pagehide',()=>{controller?.abort();if(downloadUrl)URL.revokeObjectURL(downloadUrl);if(extentUrl)URL.revokeObjectURL(extentUrl);});

function idleFrame(){if(scene&&!busy&&!clip)scene.idle(GLOBE_START);requestAnimationFrame(idleFrame);}
async function initialize(){
  try{
    $('selection-ratio').value=SELECTION_RATIO*100;
    const {width,height}=size(),globe=new Globe(document.createElement('canvas'),{width,height,pixelRatio:1});
    scene=new Scene($('output'),globe);scene.resize(width,height);requestAnimationFrame(idleFrame);
    await globe.load('./assets/blue-marble.jpg');ready=true;setBusy(false);message();
    const params=new URLSearchParams(location.search);if(params.has('lat')&&params.has('lon')){const point=parseCoordinates(`${params.get('lat')},${params.get('lon')}`);$('location').value=`${point.lat}, ${point.lon}`;}
  }catch(error){message(error.message||'Earth imagery could not load. Refresh to try again.',true);}
}
initialize();
