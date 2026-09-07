export const PROVIDERS = Object.freeze(['CEREBRAS','GROQ','MISTRAL','OPENROUTER','UPSTAGE','GEMINI','ANTHROPIC','OPENAI','OLLAMA']);
export const CANONICAL_PROVIDER_IDS = Object.freeze(PROVIDERS.map(value=>value.toLowerCase()));
export const STATES = Object.freeze(['NORMAL','LOADING','EMPTY','ERROR','BLOCKED','QUOTA','CANCEL','RECONNECT','PERMISSION_DENIED']);
export const RUNTIME_SCENARIOS = Object.freeze({
  EMPTY:Object.freeze({message:'실행 전 EMPTY fixture 상태입니다.',nextAction:'읽기 전용 scan을 시작하세요.',badge:'NOT_EXECUTED'}),
  QUOTA:Object.freeze({message:'QUOTA fixture 상태입니다. 실제 Provider quota는 NOT EXECUTED입니다.',nextAction:'checkpoint 확인 후 quota 복구를 기다리세요.',badge:'FIXTURE'}),
  CANCEL:Object.freeze({message:'CANCEL fixture 상태입니다. 실제 Run 취소는 NOT EXECUTED입니다.',nextAction:'보존된 artifact를 확인한 뒤 새 Run 여부를 결정하세요.',badge:'FIXTURE'}),
  RECONNECT:Object.freeze({message:'RECONNECT fixture 상태입니다. 실제 SSE 연결은 NOT EXECUTED입니다.',nextAction:'연결 복구 후 마지막 Event ID부터 재개하세요.',badge:'FIXTURE'}),
});

const evidence = badge => ({badge,countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'});

export const initialState = Object.freeze({
  state: 'EMPTY', projectId: '', fixtureId: '', provider: '', scan: null,
  message: '프로젝트와 fixture를 선택하세요.', nextAction: '등록 정보를 확인한 뒤 읽기 전용 scan을 시작하세요.',
  evidence: Object.freeze({badge:'NOT_EXECUTED', countsAsPass:false, scope:'FIXTURE_BROWSER_RUNTIME_ONLY'})
});

export function reduceWorkbench(state, action) {
  switch (action.type) {
    case 'SELECTION_CHANGED':
      return {...state, projectId:action.projectId, fixtureId:action.fixtureId, state:'EMPTY', provider:'', scan:null, message:'선택한 fixture는 아직 scan하지 않았습니다.', nextAction:'읽기 전용 scan을 시작하세요.', evidence:evidence('NOT_EXECUTED')};
    case 'SCAN_STARTED':
      return {...state, state:'LOADING', provider:'', scan:null, message:'읽기 전용 저장소를 점검하고 있습니다.', evidence:evidence('NOT_EXECUTED')};
    case 'SCAN_RECEIVED': {
      const nextState=action.payload.state || 'NORMAL';
      return {...state, state:nextState, provider:nextState==='NORMAL'?state.provider:'', scan:action.payload.scan, message:action.payload.message, nextAction:action.payload.nextAction, evidence:action.payload.evidence};
    }
    case 'SCAN_FAILED':
      return {...state, state:action.state || 'ERROR', provider:'', scan:null, message:action.message || '요청을 처리하지 못했습니다.', nextAction:action.nextAction || '입력과 권한을 확인한 뒤 다시 시도하세요.', evidence:evidence(action.badge || 'ERROR')};
    case 'PROVIDER_SELECTED':
      if (!PROVIDERS.includes(action.provider)) throw new Error('Unknown provider');
      if (providerPresentation(state, action.provider).disabled) throw new Error('Provider unavailable');
      return {...state, provider:action.provider, evidence:evidence('FIXTURE'), message:`${action.provider} 실행 모드를 fixture로 선택했습니다.`, nextAction:'실제 Provider 연결은 NOT EXECUTED입니다.'};
    case 'RUNTIME_STATE_SELECTED': {
      const scenario=RUNTIME_SCENARIOS[action.state];
      if (!scenario) throw new Error('Unknown runtime state');
      return {...state,state:action.state,provider:'',scan:null,message:scenario.message,nextAction:scenario.nextAction,evidence:evidence(scenario.badge)};
    }
    default: return state;
  }
}

export function providerPresentation(state, provider) {
  if (!PROVIDERS.includes(provider)) throw new Error('Unknown provider');
  const enabled=Boolean(state.scan)&&state.state==='NORMAL';
  return {disabled:!enabled,ariaChecked:String(enabled&&state.provider===provider)};
}

const allowedStatus=new Set(['NOT_CONFIGURED','DEGRADED']);
const allowedCredential=new Set(['MISSING','REGISTERED']);
export function normalizeProviderCatalog(payload){
  const rows=payload?.data;
  if(!Array.isArray(rows)||rows.length!==CANONICAL_PROVIDER_IDS.length) throw new Error('Invalid provider response');
  return rows.map((row,index)=>{
    const id=CANONICAL_PROVIDER_IDS[index];
    const keys=row&&typeof row==='object'?Object.keys(row):[];
    const permitted=['provider_id','display_name','primary','status','credential_status','health_status','latency_ms','last_error','models','moa_eligible'];
    if(!row||keys.some(key=>!permitted.includes(key))||row.provider_id!==id||row.display_name!==PROVIDERS[index]||row.primary!==(id==='upstage')||!allowedStatus.has(row.status)||!allowedCredential.has(row.credential_status)||row.health_status!=='NOT_CHECKED'||row.latency_ms!==null||row.last_error!==null||!Array.isArray(row.models)||typeof row.moa_eligible!=='boolean') throw new Error('Invalid provider response');
    return Object.freeze({id,displayName:row.display_name,primary:row.primary,status:row.status,credentialStatus:row.credential_status,healthStatus:row.health_status,latencyMs:row.latency_ms,lastError:row.last_error,models:Object.freeze([...row.models]),modelsStatus:row.models.length?'AVAILABLE':'NOT AVAILABLE',moaEligible:row.moa_eligible});
  });
}

export function normalizeProviderDetail(payload,expectedId){
  const row=payload?.data;
  if(!row||row.provider_id!==expectedId) throw new Error('Invalid provider response');
  const index=CANONICAL_PROVIDER_IDS.indexOf(expectedId);
  if(index<0) throw new Error('Invalid provider response');
  const canonical=normalizeProviderCatalog({data:CANONICAL_PROVIDER_IDS.map((id,position)=>position===index?row:{provider_id:id,display_name:PROVIDERS[position],primary:id==='upstage',status:'NOT_CONFIGURED',credential_status:'MISSING',health_status:'NOT_CHECKED',latency_ms:null,last_error:null,models:[],moa_eligible:false})});
  return canonical[index];
}

export function mapHttpFailure(status){
  if(status===401||status===403) return {phase:'PERMISSION_DENIED',message:'Provider 상태를 볼 권한이 없습니다.'};
  if(status===409||status===423||status===429) return {phase:'BLOCKED',message:'현재 상태에서는 Provider 정보를 불러올 수 없습니다.'};
  return {phase:'ERROR',message:'Provider 상태를 불러오지 못했습니다.'};
}

export function createProductionState(){return {phase:'LOADING',providers:[],selectedId:'',detail:null,models:null,message:'인증된 Provider 상태를 불러오고 있습니다.',lastEventId:'',streamMessage:'연결하면 저장된 마지막 Event 이후부터 재개합니다.'};}
export function reduceProductionWorkbench(state,action){
  switch(action.type){
    case 'LOAD_STARTED':return {...state,phase:'LOADING',message:'인증된 Provider 상태를 불러오고 있습니다.'};
    case 'PROVIDERS_RECEIVED':return {...state,phase:action.providers.length?'READY':'EMPTY',providers:action.providers,selectedId:action.providers.find(row=>row.primary)?.id||action.providers[0]?.id||'',message:action.providers.length?'API가 반환한 현재 상태입니다.':'표시할 Provider가 없습니다.'};
    case 'LOAD_FAILED':return {...state,phase:action.failure.phase,message:action.failure.message,providers:[],selectedId:'',detail:null,models:null};
    case 'PROVIDER_SELECTED':return {...state,selectedId:action.providerId,detail:null,models:null};
    case 'DETAIL_RECEIVED':return {...state,detail:action.detail,models:action.models};
    case 'STREAM_CONNECTED':return {...state,phase:state.providers.length?'READY':state.phase,lastEventId:action.lastEventId||state.lastEventId,streamMessage:action.eventCount?`${action.eventCount}개 Event를 확인했습니다.`:'새 Event가 없습니다.'};
    case 'STREAM_DISCONNECTED':return {...state,phase:'RECONNECT',streamMessage:'연결이 끊겼습니다. Last Event ID부터 다시 연결할 수 있습니다.'};
    default:return state;
  }
}
