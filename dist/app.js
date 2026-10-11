import {Globe} from './globe.js';
import {parseCoordinates,shortestLongitude,wrapLongitude,tileCoordinates} from './geo.js';

const $=id=>document.getElementById(id);
const tiles='https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const loadedTiles=new Map();
let globe,map,ready=false,busy=false,mapMode=false,controller,previousTime=0,selected={lat:51.5074,lon:-.1278};

function message(text='',error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function setBusy(value){busy=value;$('go').disabled=value||!ready;$('location').disabled=value;$('cancel').hidden=!value;}
function flash(){if(reducedMotion.matches)return;$('flash').classList.remove('fire');void $('flash').offsetWidth;$('flash').classList.add('fire');}
function abortError(){return new DOMException('Cancelled','AbortError');}
function ensureActive(signal){if(signal.aborted)throw abortError();}
function pause(ms,signal){return new Promise((resolve,reject)=>{ensureActive(signal);const onAbort=()=>{clearTimeout(timer);reject(abortError());};const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve();},ms);signal.addEventListener('abort',onAbort,{once:true});});}
function animate(duration,signal,update){return new Promise((resolve,reject)=>{const start=performance.now();const frame=now=>{if(signal.aborted){reject(abortError());return;}const t=Math.min(1,(now-start)/duration);update(t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2);if(t<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});}

function loadTile(z,x,y,signal){
  const url=tiles.replace('{z}',z).replace('{x}',x).replace('{y}',y);if(loadedTiles.has(url))return loadedTiles.get(url);
  const promise=new Promise((resolve,reject)=>{
    ensureActive(signal);const image=new Image();const timeout=setTimeout(()=>finish(new Error('Satellite imagery is taking too long to load. Try again.')),16000);
    const onAbort=()=>{image.src='';finish(abortError());};
    function finish(error){clearTimeout(timeout);signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;if(error){loadedTiles.delete(url);reject(error);}else resolve(image);}
    image.onload=()=>finish();image.onerror=()=>finish(new Error('Satellite imagery is unavailable. Try again in a moment.'));signal.addEventListener('abort',onAbort,{once:true});image.src=url;
  });loadedTiles.set(url,promise);return promise;
}
async function preload(point,signal){
  // Preload only the centre and four neighbouring tiles at the zoom stages.
  for(const z of [4,7,10,13]){ensureActive(signal);const {x,y}=tileCoordinates(point.lat,point.lon,z),n=2**z;await loadTile(z,x,y,signal);await Promise.allSettled([[-1,0],[1,0],[0,-1],[0,1]].filter(([,dy])=>y+dy>=0&&y+dy<n).map(([dx,dy])=>loadTile(z,(x+dx+n)%n,y+dy,signal)));}
}
function interaction(enabled){if(!map)return;['dragPan','scrollZoom','doubleClickZoom','boxZoom','keyboard','touchZoomRotate'].forEach(key=>map[key][enabled?'enable':'disable']());map.dragRotate.disable();map.touchZoomRotate.disableRotation();}
function getMap(point){
  if(map){map.stop();map.jumpTo({center:[point.lon,point.lat],zoom:4,bearing:0,pitch:0});return;}
  if(!window.maplibregl)throw new Error('The map could not load. Refresh this page.');
  map=new maplibregl.Map({container:'map',center:[point.lon,point.lat],zoom:4,minZoom:1,maxZoom:14,renderWorldCopies:false,attributionControl:{compact:true},style:{version:8,sources:{satellite:{type:'raster',tiles:[tiles],tileSize:256,minzoom:0,maxzoom:13,attribution:'© <a href="https://cloudless.eox.at/">Sentinel-2 cloudless</a> by <a href="https://maps.eox.at/">EOX</a> · Contains modified Copernicus Sentinel data (2024) · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#09121a'}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-fade-duration':250,'raster-saturation':-.12,'raster-contrast':.08}}]}});
  map.addControl(new maplibregl.ScaleControl({maxWidth:95,unit:'metric'}),'bottom-left');
  map.on('error',()=>{if(mapMode&&!busy)message('The imagery connection was interrupted.');});interaction(false);
}
async function waitForMap(signal){for(let i=0;i<120;i++){ensureActive(signal);if(map.loaded()&&map.areTilesLoaded())return;await pause(100,signal);}throw new Error('Satellite imagery did not finish loading. Try again.');}
async function zoomTo(zoom,signal){flash();const start=map.getZoom();await animate(3500,signal,e=>map.jumpTo({center:[selected.lon,selected.lat],zoom:start+(zoom-start)*e}));await waitForMap(signal);}
function showMap(){mapMode=true;$('map').classList.add('visible');$('map').setAttribute('aria-hidden','false');$('globe').style.opacity='0';$('globe').setAttribute('aria-hidden','true');$('satellite-credit').hidden=false;}
function backToGlobe(){
  if(busy)controller?.abort();map?.stop();mapMode=false;interaction(false);$('map').classList.remove('visible');$('map').setAttribute('aria-hidden','true');$('globe').style.opacity='1';$('globe').removeAttribute('aria-hidden');$('satellite-credit').hidden=true;$('back').hidden=true;
  if(globe){globe.radius=.335;globe.lock=false;globe.target=null;}setBusy(false);message();
}
$('cancel').addEventListener('click',backToGlobe);$('back').addEventListener('click',backToGlobe);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&busy)backToGlobe();});
$('location').addEventListener('input',()=>{message();$('location').removeAttribute('aria-invalid');});
$('location-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!ready)return;
  let point;try{point=parseCoordinates($('location').value);}catch(error){message(error.message,true);$('location').setAttribute('aria-invalid','true');$('location').focus();return;}
  backToGlobe();selected=point;$('location').removeAttribute('aria-invalid');globe.target=point;controller=new AbortController();const {signal}=controller;setBusy(true);
  try{
    getMap(point);const loading=preload(point,signal);loading.catch(()=>{});
    if(!reducedMotion.matches){const start={...globe.camera},delta=shortestLongitude(start.lon,point.lon);await animate(3800,signal,e=>{globe.camera={lat:start.lat+(point.lat-start.lat)*e,lon:wrapLongitude(start.lon+delta*e)};});globe.lock=true;await pause(1000,signal);}else{globe.camera={lat:point.lat,lon:point.lon};globe.lock=true;}
    message('Loading satellite imagery…');await loading;await waitForMap(signal);ensureActive(signal);message();
    if(!reducedMotion.matches)await animate(2500,signal,e=>{globe.radius=.335+e*.95;});
    flash();showMap();await pause(reducedMotion.matches?10:600,signal);
    if(reducedMotion.matches){map.jumpTo({center:[point.lon,point.lat],zoom:13});await waitForMap(signal);}else{for(const zoom of [7,10,13]){await zoomTo(zoom,signal);await pause(450,signal);}}
    ensureActive(signal);setBusy(false);interaction(true);$('back').hidden=false;
  }catch(error){if(error.name==='AbortError')return;backToGlobe();message(error.message||'The sequence could not finish. Try again.',true);}
});

function frame(time){const delta=previousTime?Math.min(100,time-previousTime):0;previousTime=time;if(globe){if(!busy&&!mapMode&&!reducedMotion.matches)globe.camera.lon=wrapLongitude(globe.camera.lon+delta*.002);globe.draw(time,mapMode,mapMode&&map?map.project([selected.lon,selected.lat]):null);}requestAnimationFrame(frame);}
async function initialize(){
  try{globe=new Globe($('globe'),$('hud'));requestAnimationFrame(frame);await globe.load('./assets/blue-marble.jpg');ready=true;$('go').disabled=false;message();const params=new URLSearchParams(location.search);if(params.has('lat')&&params.has('lon')){selected=parseCoordinates(`${params.get('lat')},${params.get('lon')}`);$('location').value=`${selected.lat}, ${selected.lon}`;}}
  catch(error){message(error.message||'Earth imagery could not load. Refresh to try again.',true);}
}
initialize();
