import {clamp} from './geo.js';

export const GLOBE_START = {lat:25, lon:105};
// Fraction of the frame's width AND height, used for every selection.
export const SELECTION_RATIO = .05;
export const FINAL_ZOOM = 13;
// Increase these values to slow the animation down (durations are in seconds).
export const LINE_MOVE_SECONDS = 1.3;
export const EXPAND_SECONDS = 1.2;
export const TIMING = {orbit:3.2, acquire:.55, y:LINE_MOVE_SECONDS, x:LINE_MOVE_SECONDS, hold:.3, expand:EXPAND_SECONDS, rest:.4, end:1.8};
export const INTRO = TIMING.orbit + TIMING.acquire;
export const STEP = TIMING.y + TIMING.x + TIMING.hold + TIMING.expand + TIMING.rest;
export const ease = t => {t = clamp(t, 0, 1); return t * t * (3 - 2 * t);};
export const easeOut = t => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const fullRect = (width, height) => ({x:0, y:0, width, height});
export const mixRect = (from, to, t) => Object.fromEntries(Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * t]));

// Match each map's scale to the selected crop, while retaining the same final
// detail. A larger selection needs more stages to cover the zoom range.
export function createSequence(ratio = SELECTION_RATIO) {
  if (!Number.isFinite(ratio) || ratio < .01 || ratio > .5) throw new Error('Selection must be between 1% and 50%.');
  const zoomStep = Math.log2(1 / ratio);
  const count = Math.floor((FINAL_ZOOM - 4) / zoomStep + 1e-10) + 1;
  const zooms = Array.from({length:count}, (_, i) => FINAL_ZOOM - (count - 1 - i) * zoomStep);
  return {ratio, zooms, duration:INTRO + STEP * count + TIMING.end};
}

// Project the next viewport into the preceding one using both target positions.
export function selectionRect(width, height, ratio, from, to = {x:width/2, y:height/2}) {
  const w = width * ratio, h = height * ratio;
  return {x:clamp(from.x - to.x * ratio, 0, width - w), y:clamp(from.y - to.y * ratio, 0, height - h), width:w, height:h};
}

// The same absolute-time state drives live playback and every exported frame.
export function stateAt(time, steps) {
  if (time < INTRO) return {phase:'orbit', progress:ease(time / TIMING.orbit)};
  if (time >= INTRO + STEP * steps) return {phase:'final', image:steps};
  const step = Math.floor((time - INTRO) / STEP);
  let t = time - INTRO - step * STEP;
  for (const phase of ['y', 'x', 'hold', 'expand', 'rest']) {
    if (t < TIMING[phase]) return {phase, step, progress:(['y','x','hold'].includes(phase)?easeOut:ease)(t / TIMING[phase])};
    t -= TIMING[phase];
  }
  return {phase:'rest', step, progress:1};
}

export function borderRect(state, full, selected) {
  const vertical = {...full, y:selected.y, height:selected.height};
  if (state.phase === 'y') return mixRect(full, vertical, state.progress);
  if (state.phase === 'x') return mixRect(vertical, selected, state.progress);
  if (state.phase === 'hold') return selected;
  if (state.phase === 'expand') return mixRect(selected, full, state.progress);
  return full;
}

// Four independent scan lines retain their full frame spans through selection
// and expansion. Only their positions move; no line tails are trimmed away.
export function borderLines(state, full, selected = full) {
  const bounds=borderRect(state,full,selected);
  const span=full;
  return [
    {x1:span.x,y1:bounds.y,x2:span.x+span.width,y2:bounds.y},
    {x1:span.x,y1:bounds.y+bounds.height,x2:span.x+span.width,y2:bounds.y+bounds.height},
    {x1:bounds.x,y1:span.y,x2:bounds.x,y2:span.y+span.height},
    {x1:bounds.x+bounds.width,y1:span.y,x2:bounds.x+bounds.width,y2:span.y+span.height}
  ];
}

// Sample once per sequence, then retain the layout for preview and export.
export function randomViewPositions(width,height,count,ratio,random=Math.random) {
  const start=random()*Math.PI*2, goldenAngle=Math.PI*(3-Math.sqrt(5));
  // Keep even the largest crop inside the frame without breaking registration.
  const spread=Math.min(1, .95*(1-ratio)/(2*(1+ratio)*.3));
  return Array.from({length:count},(_,i)=>{
    if (i === count - 1) return {x:width/2, y:height/2};
    const angle=start+i*goldenAngle+random()*.3;
    return {x:width*(.5+spread*(.22+random()*.08)*Math.cos(angle)),y:height*(.5+spread*(.22+random()*.05)*Math.sin(angle))};
  });
}
