export function apiPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/api/') || value.startsWith('//') || value.includes('://')) {
    throw new Error('Only same-origin /api paths are allowed');
  }
  return value;
}

async function read(response) {
  const body=await response.json().catch(()=>({message:'안전한 응답을 읽지 못했습니다.'}));
  if (!response.ok) { const error=new Error(body.message || '요청을 처리하지 못했습니다.'); error.status=response.status; error.state=body.state; throw error; }
  return body;
}

export function createWorkbenchClient(fetchImpl=globalThis.fetch) {
  const get=(path,headers={})=>fetchImpl(apiPath(path),{method:'GET',credentials:'include',headers:{accept:'application/json',...headers}}).then(read);
  return {
    config:()=>fetchImpl(apiPath('/api/workbench/config')).then(read),
    scan:({projectId,fixtureId,role,csrfToken})=>fetchImpl(apiPath('/api/workbench/scan'),{
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json','x-csrf-token':csrfToken},
      body:JSON.stringify({projectId,fixtureId,role})
    }).then(read),
    providers:()=>get('/api/providers'),
    provider:(providerId)=>get(`/api/providers/${encodeURIComponent(providerId)}`),
    models:(providerId)=>get(`/api/providers/${encodeURIComponent(providerId)}/models`),
    runEvents:async(runId,lastEventId='')=>{
      const headers={accept:'text/event-stream'};
      if(lastEventId) headers['Last-Event-ID']=lastEventId;
      const response=await fetchImpl(apiPath(`/api/runs/${encodeURIComponent(runId)}/events`),{method:'GET',credentials:'include',headers});
      if(!response.ok){const error=new Error('Event stream을 불러오지 못했습니다.');error.status=response.status;throw error;}
      if(!(response.headers.get('content-type')||'').startsWith('text/event-stream')) throw new Error('Event stream 응답 형식이 올바르지 않습니다.');
      const body=await response.text();
      const ids=[...body.matchAll(/^id:\s*(.+)$/gm)].map(match=>match[1].trim()).filter(Boolean);
      return {body,lastEventId:ids.at(-1)||lastEventId||'',eventCount:ids.length};
    }
  };
}
