import {Output,BufferTarget,Mp4OutputFormat,WebMOutputFormat,CanvasSource,Quality,canEncodeVideo} from './vendor/mediabunny.mjs';

export const FPS=30;
export async function videoFormat(width,height) {
  const quality=new Quality({bitrate:width===1920?12_000_000:6_000_000});
  for(const codec of ['avc','vp9','vp8']) {
    if(await canEncodeVideo(codec,{width,height,frameRate:FPS,quality})) {
      const mp4=codec==='avc';
      return {codec,quality,extension:mp4?'mp4':'webm',mime:mp4?'video/mp4':'video/webm'};
    }
  }
  throw new Error('Video export is unavailable in this browser. Open the local page in Chrome or Edge.');
}
export async function encodeVideo(scene,format,signal,onProgress) {
  const output=new Output({format:format.extension==='mp4'?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat(),target:new BufferTarget()});
  const source=new CanvasSource(scene.canvas,{codec:format.codec,quality:format.quality,keyFrameInterval:2});
  output.addVideoTrack(source,{frameRate:FPS});
  const frames=Math.ceil(scene.duration*FPS);
  try {
    await output.start();
    for(let i=0;i<frames;i++) {
      if(signal.aborted) throw new DOMException('Cancelled','AbortError');
      scene.draw(i/FPS); await source.add(i/FPS,1/FPS);
      if(i%10===0) {onProgress(i/frames); await new Promise(resolve=>setTimeout(resolve,0));}
    }
    if(signal.aborted) throw new DOMException('Cancelled','AbortError');
    onProgress(1); await output.finalize();
    return new Blob([output.target.buffer],{type:format.mime});
  } catch(error) {await output.cancel().catch(()=>{}); throw error;}
  finally {scene.draw(scene.duration);}
}
