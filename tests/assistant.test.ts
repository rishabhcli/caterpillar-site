import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
// @ts-expect-error Server module is intentionally plain JavaScript.
import { createAssistantMiddleware } from '../server/assistant.mjs';
const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) await new Promise<void>(r => s.close(() => r())); });
async function serve(env = {}, fetchImpl?: typeof fetch) {
  const server=createServer(createAssistantMiddleware({content:[{id:'mining',title:'Mining',summary:'Source-backed mining overview.',url:'https://www.caterpillar.com/en.html'}],env,fetchImpl}));servers.push(server);
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw new Error('No port');return `http://127.0.0.1:${address.port}`;
}
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
