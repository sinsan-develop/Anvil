import http from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkedProjection } from './src/api/c29-agent-console-client.js';

const execFileAsync=promisify(execFile);
const webRoot=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(webRoot,'..','..');
const fixtures={
  'FIX-PY-CLEAN':{label:'Python clean',state:'NORMAL'},
  'FIX-PY-DIRTY':{label:'Python dirty',state:'BLOCKED'},
  'FIX-TS-CLEAN':{label:'TypeScript clean',state:'NORMAL'}
};
const project={projectId:'anvil-fixture',name:'Anvil Fixture'};
const securityHeaders={
  'content-security-policy':"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'",
  'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','cache-control':'no-store'
};
const apiUpstream=(process.env.ANVIL_API_UPSTREAM||'').replace(/\/$/,'');
const apiProxyPrefixes=['/api/','/health/','/integrations/','/auth/'];

async function proxyApiRequest(request,response,requestUrl) {
  if (!apiUpstream || !(apiProxyPrefixes.some(prefix=>requestUrl.pathname.startsWith(prefix)) || requestUrl.pathname==='/openapi.json')) return false;
  const target=`${apiUpstream}${requestUrl.pathname}${requestUrl.search}`;
  const headers={...request.headers};
  // Node fetch rewrites Host to the upstream URL; http.request preserves the public Host.
  if (request.headers.host) headers.host=request.headers.host;
  const upstream=await new Promise((resolve,reject)=>{
    const upstreamRequest=http.request(target,{method:request.method,headers},resolve);
    upstreamRequest.on('error',reject);
    if (['GET','HEAD'].includes(request.method)) upstreamRequest.end();
    else request.pipe(upstreamRequest);
  });
  response.writeHead(upstream.statusCode,Object.fromEntries(Object.entries(upstream.headers)));
  for await (const chunk of upstream) response.write(chunk);
  response.end();
  return true;
}
const staticFiles=new Map([
  ['/src/api/c29-agent-console-client.js',['src/api/c29-agent-console-client.js','text/javascript; charset=utf-8']],
  ['/src/app/c29-console-runtime.js',['src/app/c29-console-runtime.js','text/javascript; charset=utf-8']],
  ['/src/styles/c29-console-runtime.css',['src/styles/c29-console-runtime.css','text/css; charset=utf-8']],
  ['/src/styles/c28-console.css',['src/styles/c28-console.css','text/css; charset=utf-8']],
  ['/src/app/workbench.js',['src/app/workbench.js','text/javascript; charset=utf-8']],
  ['/src/api/workbench-client.js',['src/api/workbench-client.js','text/javascript; charset=utf-8']],
  ['/src/features/workbench/workbench-state.js',['src/features/workbench/workbench-state.js','text/javascript; charset=utf-8']],
  ['/src/styles/workbench.css',['src/styles/workbench.css','text/css; charset=utf-8']],
  ['/src/app/app-shell.js',['src/app/app-shell.js','text/javascript; charset=utf-8']],
  ['/src/features/app-shell/app-shell-model.js',['src/features/app-shell/app-shell-model.js','text/javascript; charset=utf-8']],
  ['/src/styles/app-shell.css',['src/styles/app-shell.css','text/css; charset=utf-8']],
  ['/design-flow',['design-flow.html','text/html; charset=utf-8']],
  ['/src/api/design-flow-client.js',['src/api/design-flow-client.js','text/javascript; charset=utf-8']],
  ['/src/app/design-flow.js',['src/app/design-flow.js','text/javascript; charset=utf-8']],
  ['/src/styles/design-flow.css',['src/styles/design-flow.css','text/css; charset=utf-8']]
  ,['/src/app/ui-preview.js',['src/app/ui-preview.js','text/javascript; charset=utf-8']]
  ,['/src/features/ui-preview/ui-preview-model.js',['src/features/ui-preview/ui-preview-model.js','text/javascript; charset=utf-8']]
  ,['/src/styles/ui-preview.css',['src/styles/ui-preview.css','text/css; charset=utf-8']]
]);

function send(response,status,payload,extra={}) {
  const body=typeof payload==='string'?payload:JSON.stringify(payload);
  response.writeHead(status,{...securityHeaders,'content-type':typeof payload==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),...extra}); response.end(body);
}
function safeFailure(response,status,state,message) { send(response,status,{ok:false,state,message,nextAction:'입력과 권한을 확인한 뒤 다시 시도하세요.'}); }
async function jsonBody(request) {
  let raw=''; for await (const chunk of request) { raw+=chunk; if (raw.length>4096) throw new Error('SIZE'); }
  return JSON.parse(raw);
}

async function isExecutable(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function resolvePythonExecutable() {
  if (process.env.ANVIL_PYTHON) return process.env.ANVIL_PYTHON;
  if (process.env.CONDA_PREFIX) {
    return join(process.env.CONDA_PREFIX, process.platform === 'win32' ? 'python.exe' : 'bin/python');
  }
  const localPython=join(repoRoot,'.venv',process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  if (await isExecutable(localPython)) return localPython;
  return 'python';
}

async function scanFixture(fixtureId) {
  const code=`import json,sys,tempfile\nfrom pathlib import Path\nfrom scripts.materialize_fixture_repository import materialize_fixture\nfrom packages.repository_intelligence import ScanRequest,scan_repository\nroot=Path.cwd()\nwith tempfile.TemporaryDirectory(prefix='anvil-a14-') as value:\n repo=materialize_fixture(root,sys.argv[1],Path(value)/'repo')\n result=scan_repository(ScanRequest(repository_path=str(repo),allowed_root=value))\n print(json.dumps(result.to_dict(),ensure_ascii=False))`;
  const python=await resolvePythonExecutable();
  const {stdout}=await execFileAsync(python,['-c',code,fixtureId],{cwd:repoRoot,timeout:20000,windowsHide:true,maxBuffer:2_000_000});
  return JSON.parse(stdout);
}

export async function startWorkbenchServer({host='127.0.0.1',port=4173,uiMode='production',fixtureEnabled=false,agentConsoleUpstream=''}={}) {
  let consoleUpstream=null;
  if (agentConsoleUpstream) {
    try {
      const u=new URL(agentConsoleUpstream);
      if (u.protocol!=='http:' || !['127.0.0.1','localhost'].includes(u.hostname) || !u.port || u.username || u.password || u.pathname!=='/' || u.search || u.hash) throw Error();
      consoleUpstream=u.origin;
    } catch { throw Error('UPSTREAM_INVALID'); }
  }
  const runtimeMode=uiMode==='preview'?'preview':uiMode==='fixture'?'fixture':'production';
  const csrfToken=randomUUID();
  let allowedHost='';
  const server=http.createServer(async (request,response)=>{
    try {
      const requestUrl=new URL(request.url,'http://fixture.invalid');
      if (request.url.startsWith('/api/agent-console') && request.url!==requestUrl.pathname) return safeFailure(response,400,'ERROR','요청 형식이 올바르지 않습니다.');
      if (requestUrl.pathname.startsWith('/api/agent-console')) {
        if (request.headers.host!==allowedHost || (request.headers.origin && request.headers.origin!==`http://${allowedHost}`)) return safeFailure(response,403,'PERMISSION_DENIED','요청 출처를 확인하세요.');
        if (requestUrl.search || request.url!==requestUrl.pathname) return safeFailure(response,400,'ERROR','요청 형식이 올바르지 않습니다.');
        const route=requestUrl.pathname.slice('/api/agent-console/'.length);
        if (request.method==='GET' && route==='config') return send(response,200,{csrfToken});
        if (!(request.method==='GET' && ['team','moa','sns','adapters'].includes(route)) && !(request.method==='POST' && route==='control')) return safeFailure(response,404,'EMPTY','허용된 경로가 아닙니다.');
        let body;
        if (request.method==='POST') {
          if (request.headers.origin!==`http://${allowedHost}` || request.headers['x-csrf-token']!==csrfToken) return safeFailure(response,403,'PERMISSION_DENIED','요청 출처 또는 CSRF 검증에 실패했습니다.');
          try {
            body=await jsonBody(request);
            if (!body || Array.isArray(body) || Object.keys(body).sort().join(',')!=='action,request_id,target_hash' || !['pause','resume','deploy','delete','approve','merge','apply','provider','permission'].includes(body.action) || typeof body.request_id!=='string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(body.request_id) || typeof body.target_hash!=='string' || !/^sha256:[a-f0-9]{64}$/.test(body.target_hash)) throw Error();
          } catch { return safeFailure(response,400,'ERROR','요청 형식이 올바르지 않습니다.'); }
        }
        if (!consoleUpstream) return safeFailure(response,503,'OFFLINE','Console service가 연결되지 않았습니다.');
        try {
          const result=await new Promise((ok,fail)=>{
            const headers={'accept':'application/json','content-type':'application/json'};
            if (request.headers.cookie) headers.cookie=request.headers.cookie;
            if (request.headers.authorization) headers.authorization=request.headers.authorization;
            const upstream=http.request(consoleUpstream+requestUrl.pathname,{method:request.method,headers},async incoming=>{
              try {
                let size=0;const chunks=[];
                for await(const chunk of incoming){size+=chunk.length;if(size>262144){incoming.destroy();throw Error();}chunks.push(chunk);}
                if (!(incoming.headers['content-type']||'').startsWith('application/json')) throw Error();
                const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
                ok({status:incoming.statusCode,value});
              } catch { fail(Error('UPSTREAM_FAILURE')); }
            });
            upstream.setTimeout(3000,()=>upstream.destroy(Error('TIMEOUT')));
            upstream.on('error',fail);upstream.end(body?JSON.stringify(body):undefined);
          });
          if (result.status>=400) return safeFailure(response,result.status===403?403:503,result.status===403?'PERMISSION_DENIED':'OFFLINE','Console 요청이 거부되었거나 연결되지 않았습니다.');
          if (result.status<200 || result.status>=300) throw Error();
          if (request.method==='GET') result.value=checkedProjection(result.value,route);
          else {
            const v=result.value;
            if (!v || v.schema!=='agent-console-control/v1' || v.state!=='REQUESTED_NOT_APPLIED' || v.allowed!==false || v.applied!==false || v.io_count!==0 || v.target_hash!==body.target_hash || v.request_id!==body.request_id) throw Error();
            result.value={schema:v.schema,state:v.state,allowed:false,applied:false,io_count:0,target_hash:v.target_hash,request_id:v.request_id};
          }
          return send(response,result.status,result.value);
        } catch { return safeFailure(response,503,'OFFLINE','Console service 응답을 확인할 수 없습니다.'); }
      }
      if (request.method==='GET' && requestUrl.pathname==='/agent-console') return send(response,200,'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anvil Agent Console</title><link rel="stylesheet" href="/src/styles/c28-console.css"><link rel="stylesheet" href="/src/styles/c29-console-runtime.css"><body><div data-c29-console></div><script type="module" src="/src/app/c29-console-runtime.js"></script></body></html>',{'content-type':'text/html; charset=utf-8'});
      if (await proxyApiRequest(request,response,requestUrl)) return;
      if (request.method==='GET' && requestUrl.pathname==='/healthz') return send(response,200,{ok:true,service:'anvil-web',mode:runtimeMode});
      if (request.method==='GET' && requestUrl.pathname==='/api/design-flow/config') return send(response,200,{ok:true,csrfToken,runtimeBoundary:'LOCAL_VERIFICATION_ONLY'});
      if (request.method==='POST' && requestUrl.pathname==='/api/design-flow/run') {
        const expectedOrigin=`http://${allowedHost}`;
        if (request.headers.host!==allowedHost || request.headers.origin!==expectedOrigin || request.headers['x-csrf-token']!==csrfToken) return safeFailure(response,403,'PERMISSION_DENIED','요청 출처 또는 CSRF 검증에 실패했습니다.');
        let body; try { body=await jsonBody(request); } catch { return safeFailure(response,400,'ERROR','요청 형식이 올바르지 않습니다.'); }
        const python=await resolvePythonExecutable();
        try {
          const {stdout}=await execFileAsync(python,['-m','packages.api.design_runtime',JSON.stringify(body)],{cwd:repoRoot,timeout:10000,windowsHide:true,maxBuffer:500000});
          return send(response,200,JSON.parse(stdout));
        } catch (error) {
          const stdout=error?.stdout; if (stdout) { const payload=JSON.parse(stdout); return send(response,payload.state==='BLOCKED'?409:400,payload); }
          return safeFailure(response,500,'ERROR','Design service를 실행하지 못했습니다.');
        }
      }
      if (request.method==='GET' && requestUrl.pathname==='/api/workbench/config') return send(response,200,{ok:true,project,fixtures:Object.entries(fixtures).map(([fixtureId,value])=>({fixtureId,label:value.label})),csrfToken,runtimeBoundary:'FIXTURE_BROWSER_RUNTIME_ONLY',actualProvider:'NOT_EXECUTED'});
      if (request.method==='POST' && requestUrl.pathname==='/api/workbench/scan') {
        const hostHeader=request.headers.host;
        const expectedOrigin=`http://${allowedHost}`;
        if (!hostHeader || hostHeader!==allowedHost || request.headers.origin!==expectedOrigin || request.headers['x-csrf-token']!==csrfToken) return safeFailure(response,403,'PERMISSION_DENIED','요청 출처 또는 CSRF 검증에 실패했습니다.');
        let body; try { body=await jsonBody(request); } catch { return safeFailure(response,400,'ERROR','요청 형식이 올바르지 않습니다.'); }
        if (body?.projectId!==project.projectId || !Object.hasOwn(fixtures,body?.fixtureId)) return safeFailure(response,403,'PERMISSION_DENIED','허용된 프로젝트 또는 fixture가 아닙니다.');
        if (body.role!=='operator') return safeFailure(response,403,'PERMISSION_DENIED','읽기 전용 scan 권한이 없습니다.');
        const scan=await scanFixture(body.fixtureId);
        const state=fixtures[body.fixtureId].state;
        return send(response,200,{ok:true,state,scan:{status:scan.status,repository:{branch:scan.repository?.branch ?? null,language:scan.repository?.primary_language ?? null,trackedDirtyPaths:scan.repository?.tracked_dirty_paths?.length ?? 0},noWriteIdentical:scan.no_write_proof?.identical===true},evidence:{badge:'FIXTURE',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'},message:state==='BLOCKED'?'dirty fixture가 감지되어 실행을 차단했습니다.':'읽기 전용 fixture scan이 끝났습니다.',nextAction:state==='BLOCKED'?'변경 파일을 검토한 뒤 새 scan을 시작하세요.':'실행 모드를 선택하세요.'});
      }
      if (request.method==='GET' && requestUrl.pathname==='/') {
        const filename=runtimeMode==='preview'?'ui-preview.html':runtimeMode==='fixture'?'fixture-workbench.html':'index.html';
        const body=await readFile(join(webRoot,filename));
        response.writeHead(200,{...securityHeaders,'content-type':'text/html; charset=utf-8','content-length':body.length});
        return response.end(body);
      }
      if (request.method==='GET' && requestUrl.pathname==='/provider-workbench.html') {
        const body=await readFile(join(webRoot,'provider-workbench.html'));
        response.writeHead(200,{...securityHeaders,'content-type':'text/html; charset=utf-8','content-length':body.length});
        return response.end(body);
      }
      if (fixtureEnabled && request.method==='GET' && requestUrl.pathname==='/fixture-workbench') {
        const body=await readFile(join(webRoot,'fixture-workbench.html'));
        response.writeHead(200,{...securityHeaders,'content-type':'text/html; charset=utf-8','content-length':body.length});
        return response.end(body);
      }
      const item=staticFiles.get(requestUrl.pathname);
      if (request.method==='GET' && item) { const body=await readFile(join(webRoot,item[0])); response.writeHead(200,{...securityHeaders,'content-type':item[1],'content-length':body.length}); return response.end(body); }
      safeFailure(response,404,'EMPTY','요청한 화면을 찾을 수 없습니다.');
    } catch { safeFailure(response,500,'ERROR','Workbench 요청을 안전하게 처리하지 못했습니다.'); }
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,host,ok);});
  const address=server.address();
  allowedHost=`${host}:${address.port}`;
  return {origin:`http://${host}:${address.port}`,csrfToken,close:()=>new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()))};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const host=process.env.ANVIL_HOST||'127.0.0.1';
  const port=Number(process.env.ANVIL_PORT||4173);
  const uiMode=process.env.ANVIL_UI_MODE||'production';
  startWorkbenchServer({host,port,uiMode}).then(({origin})=>console.log(`Anvil ${uiMode} Workbench: ${origin}`)).catch(()=>{console.error('Workbench failed to start.');process.exitCode=1;});
}
