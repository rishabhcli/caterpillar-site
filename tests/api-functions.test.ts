import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request as rawRequest, type RequestListener, type Server } from 'node:http';
import assistant from '../api/assistant/index';
import status from '../api/assistant/status';
const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) await new Promise<void>(r => s.close(() => r())); });
async function serve(handler: RequestListener) {
  const server=createServer(handler);servers.push(server);
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw new Error('No port');return address.port;
}
/** The deployed functions see a public Host, so tests must send one; fetch() cannot override that header. */
function call(port:number,path:string,{method='GET',headers={},body}:{method?:string;headers?:Record<string,string>;body?:string}={}){
  return new Promise<{status:number;text:string}>((resolve,reject)=>{
    const req=rawRequest({hostname:'127.0.0.1',port,path,method,headers:{host:'concept.example.com',origin:'https://concept.example.com','sec-fetch-site':'same-origin',...headers}},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>{text+=c;});res.on('end',()=>resolve({status:res.statusCode??0,text}));});
    req.on('error',reject);if(body)req.write(body);req.end();
  });
}
describe('vercel functions',()=>{
  it('answers the status route from a public deployment host',async()=>{const port=await serve(status);const res=await call(port,'/api/assistant/status');expect(res.status).toBe(200);expect(JSON.parse(res.text)).toEqual({available:false});});
  it('routes the assistant function to the POST endpoint, not a 404',async()=>{const port=await serve(assistant);expect((await call(port,'/api/assistant',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status).toBe(503);});
  it('rejects non-POST methods on the assistant route',async()=>{const port=await serve(assistant);const res=await call(port,'/api/assistant',{method:'GET'});expect(res.status).toBe(405);});
  it('rejects cross-origin callers',async()=>{const port=await serve(status);expect((await call(port,'/api/assistant/status',{headers:{origin:'https://evil.example','sec-fetch-site':'cross-site'}})).status).toBe(403);});
});
