import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.wasm':'application/wasm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8'};
export function libraryHeaders(origin,html=false){
 const url=new URL(origin),assetOrigins=[url.origin];
 // Dev proxies may rewrite Host to 127.0.0.1 even when the page uses localhost.
 if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
  for(const hostname of ['localhost','127.0.0.1','[::1]']){const alias=new URL(url);alias.hostname=hostname;assetOrigins.push(alias.origin);}
 }
 const assets=[...new Set(assetOrigins)].map(value=>value+'/library/').join(' ');
 return {'content-security-policy':`default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: ${assets}; style-src 'unsafe-inline' ${assets}; img-src data: blob: ${assets}; font-src data: ${assets}; media-src data: blob: ${assets}; connect-src ${assets}; worker-src blob: ${assets}; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self';${html?' sandbox allow-scripts allow-pointer-lock;':''}`,'access-control-allow-origin':'*','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()','cache-control':html?'no-store':'public, max-age=0, must-revalidate'};
}
export async function serveLibrary(req,res,path,appOrigin){
 if(!path.startsWith('/library/'))return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return true;}
 const root=resolve('public/library');let file;
 try{file=resolve(root,decodeURIComponent(path.slice('/library/'.length)));}catch{res.writeHead(400);res.end();return true;}
 if(!file.startsWith(root+sep)||!(await stat(file).catch(()=>null))?.isFile()){res.writeHead(404,{'content-type':'text/plain'});res.end('Game asset not found');return true;}
 // The caller's own origin is used for asset CSP; proxy previews retain the browser host.
 const host=req.headers.host;
 if(!host||!/^[-a-z0-9.:[\]]+(?::\d+)?$/i.test(host)){res.writeHead(400);res.end();return true;}
 const requested=new URL((req.socket.encrypted?'https':'http')+'://'+host);
 const configured=new URL(appOrigin||requested.origin);
 // localhost and 127.0.0.1 are interchangeable dev URLs, but distinct CSP origins.
 const loopback=new Set(['localhost','127.0.0.1','[::1]']);
 if(loopback.has(configured.hostname)&&loopback.has(requested.hostname)&&configured.port===requested.port)configured.hostname=requested.hostname;
 const origin=configured.origin;
 const extension=extname(file).toLowerCase();res.writeHead(200,{'content-type':mime[extension]||'application/octet-stream',...libraryHeaders(origin,extension==='.html')});
 res.end(req.method==='HEAD'?undefined:await readFile(file));return true;
}
