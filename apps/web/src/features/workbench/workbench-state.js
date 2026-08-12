export const PROVIDERS = Object.freeze(['CEREBRAS','GROQ','MISTRAL','OPENROUTER','UPSTAGE','GEMINI','ANTHROPIC','OPENAI','OLLAMA']);
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
