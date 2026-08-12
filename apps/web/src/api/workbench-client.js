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
  return {
    config:()=>fetchImpl(apiPath('/api/workbench/config')).then(read),
    scan:({projectId,fixtureId,role,csrfToken})=>fetchImpl(apiPath('/api/workbench/scan'),{
      method:'POST', credentials:'same-origin',
      headers:{'content-type':'application/json','x-csrf-token':csrfToken},
      body:JSON.stringify({projectId,fixtureId,role})
    }).then(read)
  };
}
