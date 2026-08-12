export const PROVIDERS = Object.freeze(['CEREBRAS','GROQ','MISTRAL','OPENROUTER','UPSTAGE','GEMINI','ANTHROPIC','OPENAI','OLLAMA']);
export const STATES = Object.freeze(['NORMAL','LOADING','EMPTY','ERROR','BLOCKED','QUOTA','CANCEL','RECONNECT','PERMISSION_DENIED']);

export const initialState = Object.freeze({
  state: 'EMPTY', projectId: '', fixtureId: '', provider: '', scan: null,
  message: '프로젝트와 fixture를 선택하세요.', nextAction: '등록 정보를 확인한 뒤 읽기 전용 scan을 시작하세요.',
  evidence: Object.freeze({badge:'NOT_EXECUTED', countsAsPass:false, scope:'FIXTURE_BROWSER_RUNTIME_ONLY'})
});

export function reduceWorkbench(state, action) {
  switch (action.type) {
    case 'SELECTION_CHANGED':
      return {...state, projectId:action.projectId, fixtureId:action.fixtureId, state:'NORMAL'};
    case 'SCAN_STARTED':
      return {...state, state:'LOADING', message:'읽기 전용 저장소를 점검하고 있습니다.', evidence:{badge:'NOT_EXECUTED',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'}};
    case 'SCAN_RECEIVED':
      return {...state, state:action.payload.state || 'NORMAL', scan:action.payload.scan, message:action.payload.message, nextAction:action.payload.nextAction, evidence:action.payload.evidence};
    case 'SCAN_FAILED':
      return {...state, state:action.state || 'ERROR', message:action.message || '요청을 처리하지 못했습니다.', nextAction:action.nextAction || '입력과 권한을 확인한 뒤 다시 시도하세요.', evidence:{badge:action.badge || 'ERROR',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'}};
    case 'PROVIDER_SELECTED':
      if (!PROVIDERS.includes(action.provider)) throw new Error('Unknown provider');
      return {...state, provider:action.provider, evidence:{badge:'FIXTURE',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'}, message:`${action.provider} 실행 모드를 fixture로 선택했습니다.`, nextAction:'실제 Provider 연결은 NOT EXECUTED입니다.'};
    default: return state;
  }
}
