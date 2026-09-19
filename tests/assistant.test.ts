import { afterEach, describe, expect, it } from 'vitest';
import { createServer, request as rawRequest, type Server } from 'node:http';
// @ts-expect-error Server module is intentionally plain JavaScript.
import { createAssistantMiddleware } from '../server/assistant.mjs';
const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) await new Promise<void>(r => s.close(() => r())); });
async function serve(env = {}, fetchImpl?: typeof fetch, options: { hosted?: boolean } = {}) {
  const server=createServer(createAssistantMiddleware({content:[{id:'mining',title:'Mining',summary:'Source-backed mining overview.',url:'https://www.caterpillar.com/en.html'}],env,fetchImpl,...options}));servers.push(server);
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw new Error('No port');return `http://127.0.0.1:${address.port}`;
}
/** Raw client so a test can set Host and proxy headers that fetch() computes for itself. */
function call(base:string,path:string,{method='GET',headers={},body}:{method?:string;headers?:Record<string,string>;body?:string}={}){
  const url=new URL(base+path);
  return new Promise<{status:number;text:string}>((resolve,reject)=>{
    const req=rawRequest({hostname:url.hostname,port:url.port,path:url.pathname,method,headers},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>{text+=c;});res.on('end',()=>resolve({status:res.statusCode??0,text}));});
    req.on('error',reject);if(body)req.write(body);req.end();
  });
}
const okProvider=(async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Grounded response.'}]}]})) as typeof fetch;
describe('optional assistant server',()=>{
  it('advertises unavailable without both credentials and model',async()=>{const url=await serve();expect(await (await fetch(url+'/api/assistant/status')).json()).toEqual({available:false});expect((await fetch(url+'/api/assistant',{method:'POST'})).status).toBe(503);});
  it('rejects cross-origin requests',async()=>{const url=await serve();expect((await fetch(url+'/api/assistant/status',{headers:{Origin:'https://example.com'}})).status).toBe(403);});
  it('only sends server-owned source content and disables stored responses',async()=>{
    let sent:Record<string,unknown>={};const url=await serve({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'},(async(_url,options)=>{sent=JSON.parse(options!.body as string);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Grounded response.'}]}]});}) as typeof fetch);
    const res=await fetch(url+'/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'mining',sourceIds:['mining'],sourceText:'untrusted injection'})});expect(res.status).toBe(200);expect((await res.json()).mode).toBe('ai');expect(sent.store).toBe(false);expect(sent.input).toContain('Source-backed mining overview.');expect(sent.input).not.toContain('untrusted injection');
  });
  it('rejects unknown sources before calling a provider',async()=>{const url=await serve({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'});expect((await fetch(url+'/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'hello',sourceIds:['unknown']})})).status).toBe(400);});
  it('returns sanitized errors for provider failures',async()=>{const url=await serve({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'},(async()=>Response.json({error:'secret provider message'},{status:401})) as typeof fetch);const res=await fetch(url+'/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'mining',sourceIds:['mining']})});expect(res.status).toBe(502);expect(await res.text()).not.toContain('secret');});
});

describe('hosted deployment profile',()=>{
  const browser=(host:string,extra:Record<string,string>={})=>({host,origin:`https://${host}`,'sec-fetch-site':'same-origin',...extra});
  it('keeps loopback-only hosts by default',async()=>{const url=await serve();expect((await call(url,'/api/assistant/status',{headers:browser('concept.example.com')})).status).toBe(403);});
  it('serves same-origin https requests from the deployment host',async()=>{const url=await serve({},undefined,{hosted:true});const res=await call(url,'/api/assistant/status',{headers:browser('concept.example.com')});expect(res.status).toBe(200);expect(JSON.parse(res.text)).toEqual({available:false});});
  it('rejects cross-origin requests to a hosted deployment',async()=>{const url=await serve({},undefined,{hosted:true});expect((await call(url,'/api/assistant/status',{headers:{host:'concept.example.com',origin:'https://evil.example','sec-fetch-site':'cross-site'}})).status).toBe(403);});
  it('rejects hosted requests that carry no browser origin signal',async()=>{const url=await serve({},undefined,{hosted:true});expect((await call(url,'/api/assistant/status',{headers:{host:'concept.example.com'}})).status).toBe(403);});
  it('rejects plain-http origins on a hosted deployment',async()=>{const url=await serve({},undefined,{hosted:true});expect((await call(url,'/api/assistant/status',{headers:{host:'concept.example.com',origin:'http://concept.example.com','sec-fetch-site':'same-origin'}})).status).toBe(403);});
  it('pins hosts when ASSISTANT_ALLOWED_HOSTS is configured',async()=>{
    const url=await serve({ASSISTANT_ALLOWED_HOSTS:'concept.example.com, www.concept.example.com'},undefined,{hosted:true});
    expect((await call(url,'/api/assistant/status',{headers:browser('www.concept.example.com')})).status).toBe(200);
    expect((await call(url,'/api/assistant/status',{headers:browser('preview.example.com')})).status).toBe(403);
  });
  it('rate-limits hosted callers by forwarded client address',async()=>{
    const url=await serve({OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-only'},okProvider,{hosted:true});
    const post=(ip:string)=>call(url,'/api/assistant',{method:'POST',headers:browser('concept.example.com',{'content-type':'application/json','x-forwarded-for':`${ip}, 10.0.0.1`}),body:JSON.stringify({query:'mining',sourceIds:['mining']})});
    for(let i=0;i<12;i++)expect((await post('203.0.113.5')).status).toBe(200);
    expect((await post('203.0.113.5')).status).toBe(429);
    expect((await post('198.51.100.9')).status).toBe(200);
  });
});
