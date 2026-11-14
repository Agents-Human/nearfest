// Read-only production library helper. Run with Node's --env-file=.env option.
// The credential stays in the process environment and the Authorization header.
const token=process.env.MCP_ASSETS?.trim().replace(/^Bearer\s+/i,'');
if(!token){console.error('Set MCP_ASSETS in your private .env file. Never use a VITE_ credential.');process.exit(1);}
const [operation,...args]=process.argv.slice(2),endpoint='https://bc.studyjunior.com/api/mcp/primer';
const tool=operation==='search'?'search_assets':operation==='get'?'get_assets':null;
if(!tool){console.error('Usage: node --env-file=.env scripts/studyjunior-assets.mjs search frog | get <UUID> [UUID…]');process.exit(1);}
const arguments_=operation==='search'?{query:args.join(' '),asset_type:'image',limit:12}:{ids:args,asset_type:'image'};
try{
 const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:arguments_}}),signal:AbortSignal.timeout(30000)});
 const text=await response.text();if(!response.ok)throw Error(`Primer returned HTTP ${response.status}. Check this token's library access; Studio Build uses a different token.`);
 const result=JSON.parse(text);if(result.error||result.result?.isError)throw Error('The asset tool rejected the request. Check the query or asset UUID.');
 const payload=result.result?.structuredContent||JSON.parse(result.result.content.find(c=>c.type==='text').text);
 console.log(JSON.stringify(payload,null,2).replaceAll(token,'[REDACTED]'));
}catch(error){console.error(String(error.message).replaceAll(token,'[REDACTED]'));process.exitCode=1;}
