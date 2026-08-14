let token='';
export async function configure(){const response=await fetch('/api/design-flow/config');const body=await response.json();token=body.csrfToken;return body;}
export async function runDesignFlow(payload){const response=await fetch('/api/design-flow/run',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':token},body:JSON.stringify(payload)});return {status:response.status,body:await response.json()};}
