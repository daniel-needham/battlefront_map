import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('dist');
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs':'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.mp4':'video/mp4', '.webm':'video/webm' };
http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
    if (!(await stat(file)).isFile()) throw new Error('Not found');
    const data=await readFile(file);
    const headers={ 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges':'bytes' };
    if(request.headers.range){
      const range=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      const start=range?.[1]?Number(range[1]):Math.max(0,data.length-Number(range?.[2]));
      const end=range?.[1]?Math.min(data.length-1,range[2]?Number(range[2]):data.length-1):data.length-1;
      if(!range||!Number.isFinite(start)||start>end||start>=data.length){response.writeHead(416,{'Content-Range':`bytes */${data.length}`});return response.end();}
      response.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});
      return response.end(data.subarray(start,end+1));
    }
    response.writeHead(200,{...headers,'Content-Length':data.length});response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
