import { test, expect, type Page } from '@playwright/test';
import { installWorkspaceBundle } from './bundle.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
const pid = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222', planId = '33333333-3333-4333-8333-333333333333', applicationId = '44444444-4444-4444-8444-444444444444', draftId = '55555555-5555-4555-8555-555555555555';
const ref = (id: string) => ({ id, version: 1, contentHash: 'a'.repeat(64) });
const at = '2026-10-17T22:58:36Z';
const graph = { nodes: [{ nodeId: 'N1', name: '구현 정의', purpose: '통제된 개발', kind: 'HUMAN', position: { x: 0, y: 0 }, role: 'USER', inputs: [], outputs: [], taskScope: { included: ['개발'], excluded: ['운영'] }, completionCriteria: ['핵심 동작'], approvalBoundary: ['범위 변경'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['현재 상황'] }], edges: [], entryNodeId: 'N1', terminalNodeIds: ['N1'] };
const methodology = { name: '고정 절차', purpose: 'Anvil이 개발 통제', graph, sourceRef: { ...ref(user), contentHash: contentHash(canonicalJson(graph)) } }, applicationRef = { ...ref(applicationId), contentHash: contentHash(canonicalJson(methodology)) };
const project = { id: pid, name: '임무 프로젝트', purpose: '지식과 통제를 소유', desiredOutcome: '도구 교체 가능', version: 1, createdAt: at, updatedAt: at, currentMethodologyRef: applicationRef, baselineRef: null, sourceMode: 'EMPTY', sourceDeclaration: null, readinessIssues: [], viewerPermissions: ['READ_PROJECT'], participation: 'OWNER', controlState: { actorId: user, clientId: pid, generation: 1, status: 'HELD' } };
const card = { taskCode: 'FN01', type: 'FUNCTION', title: '실제 기능 구현', purpose: '사용자 소유 시스템에서 작업', designRefs: [], screenRefs: [], ownerRole: '단계책임자', inputs: ['합의한 요구'], outputs: ['처리·저장·조회'], included: ['개발'], excluded: ['운영 배포'], allowedFileRefs: ['src/a.ts'], startPrerequisites: [], acceptancePrerequisites: [], steps: ['기능 연결'], testCases: [{ id: 'T1', kind: 'NORMAL', steps: ['처리'], expected: '저장됨', environment: 'WSL' }], acceptanceCriteria: ['핵심 동작'], evidenceRequirements: ['결과'], rollback: '국소복구', recoveryNotes: '기록 인계' };
const planSnapshot = { documentRef: ref(pid), designRef: ref(user), screenReviewRefs: [], tasks: [card], dependencies: [], reason: '승인 계획', issues: [], relationalProjection: 'STORED' };
const planRef = { ...ref(planId), contentHash: contentHash(canonicalJson(planSnapshot)) }, plan = { ref: planRef, status: 'DRAFT', ...planSnapshot, executionEvidence: 'NOT_CONNECTED', observedAt: at };
async function setup(page: Page, lost = false) {
  const unexpected: string[] = [], commands: any[] = [], errors: string[] = []; let stored: any = null, original: any = null;
  await page.route('**/api/v1/**', route => { unexpected.push(route.request().url()); return route.abort(); }); await installWorkspaceBundle(page);
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id: user, displayName: 'QA' }, clientId: pid, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${pid}/conversations?*`,route=>route.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
  await page.route(`**/api/v1/projects/${pid}`, route => route.fulfill({ json: project }));
  await page.route(`**/api/v1/projects/${pid}/methodology-application`, route => route.fulfill({ json: { projectId: pid, applicationRef, snapshot: methodology, executionState: 'NOT_CONNECTED', observedAt: at } }));
  await page.route(`**/api/v1/projects/${pid}/work-plans?*`, route => route.fulfill({ json: { items: [{ ref: planRef, status: 'DRAFT', title: '합의한 계획', documentRef: plan.documentRef, designRef: plan.designRef, issueCount: 0, updatedAt: at, integrity: 'NOT_RECHECKED' }], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${pid}/work-plans/${planId}/versions/1`, route => route.fulfill({ json: plan }));
  await page.route(`**/api/v1/projects/${pid}/assignment-drafts?*`, route => route.fulfill({ json: { items: stored ? [{ ref: stored.ref, status: 'DRAFT', goal: stored.snapshot.definition.goal, taskRef: stored.snapshot.definition.taskRef, issueCount: 1, updatedAt: at, ready: false, executionAuthorized: false }] : [], hasMore: false, nextCursor: null, observedAt: at } }));
  await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${draftId}/versions/1`, route => route.fulfill({ json: { projectId: pid, ...stored, headVersion: 1, sourceCurrentness: 'NOT_RECHECKED', observedAt: at } }));
  await page.route(`**/api/v1/projects/${pid}/commands`, async route => {
    const c = route.request().postDataJSON(); commands.push(c); expect(c.operation).toBe('prepareAssignment');
    if (!original) {
      const snapshot = { definition: c.payload.definition, reason: c.payload.reason, previousRef: c.payload.baseRef, basis: { planRef, applicationRef, designRef: plan.designRef, taskCode: 'FN01', nodeId: 'N1', taskCardHash: contentHash(canonicalJson(card)) }, readinessIssues: [{ code: 'EXECUTION_NOT_CONNECTED', location: 'taskRef' }], status: 'DRAFT', ready: false, executionAuthorized: false, dispatchPerformed: false };
      stored = { ref: { id: draftId, version: 1, contentHash: contentHash(canonicalJson(snapshot)) }, snapshot }; original = { operationId: draftId, commandId: c.commandId, projectId: pid, status: 'APPLIED', targetId: draftId, version: 1, data: { ref: stored.ref, status: 'ASSIGNMENT_DRAFT_STORED', snapshot }, evidenceRefs: [], warnings: [], serverReceivedAt: at };
    }
    if (lost && commands.length === 1) return route.abort(); return route.fulfill({ json: original });
  });
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (new URL(request.url()).origin !== 'https://localhost:3830') unexpected.push(request.url()); });
  await page.goto(`/#/projects/${pid}/workspace`); await page.getByRole('button', { name: '적용 절차 조회', exact: true }).click();
  return { commands, unexpected, errors, get stored() { return stored; } };
}
async function prepare(page: Page) {
  await page.getByRole('button', { name: '계획 목록 조회', exact: true }).click(); await page.getByRole('button', { name: '계획 열기: 합의한 계획', exact: true }).click();
  await page.getByRole('button', { name: '선택 업무로 임무 초안 준비', exact: true }).click();
  await page.getByRole('textbox', { name: '임무 목표', exact: true }).fill('사용 가능한 실제 기능'); await page.getByRole('textbox', { name: '임무 통합 책임', exact: true }).fill('책임자가 검수하고 통합'); await page.getByRole('textbox', { name: '임무 저장 이유', exact: true }).fill('작업 지시를 준비');
}

for(const mode of ['NORMAL','DENIED','HASH'])test('ASSIGNMENT_HISTORY_'+mode,async({page})=>{
 const facts=await setup(page);await prepare(page);await page.getByRole('button',{name:'임무 초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');const old=structuredClone(facts.stored),snapshot={...old.snapshot,definition:{...old.snapshot.definition,goal:'개정된 보관 목표'},reason:'두 번째 보관',previousRef:old.ref},nextRef={id:draftId,version:2,contentHash:contentHash(canonicalJson(snapshot))};
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts?*`,r=>r.fulfill({json:{items:[{ref:nextRef,status:'DRAFT',goal:snapshot.definition.goal,taskRef:snapshot.definition.taskRef,issueCount:1,updatedAt:at,ready:false,executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${draftId}/versions/2`,r=>r.fulfill({json:{projectId:pid,ref:nextRef,snapshot,headVersion:2,sourceCurrentness:'NOT_RECHECKED',observedAt:at}}));
 const open=async()=>{await page.getByRole('button',{name:'임무 초안 목록 조회',exact:true}).click();await page.getByRole('button',{name:'임무 버전 열기: 2',exact:true}).click();};await open();await page.getByRole('button',{name:'현재 버전으로 개정 준비',exact:true}).click();await page.getByRole('textbox',{name:'임무 목표',exact:true}).fill('아직 저장하지 않은 입력');await open();
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${draftId}/versions/1`,r=>mode==='DENIED'?r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}):r.fulfill({json:{projectId:pid,ref:mode==='HASH'?{...old.ref,contentHash:'b'.repeat(64)}:old.ref,snapshot:old.snapshot,headVersion:2,sourceCurrentness:'NOT_RECHECKED',observedAt:at}}));
 await page.getByRole('button',{name:'이전 임무 초안 원문 열기',exact:true}).click();const shown=page.getByRole('region',{name:'저장한 임무 초안',exact:true});
 if(mode==='NORMAL'){await expect(shown).toContainText('고정 버전 1');await expect(shown).toContainText('사용 가능한 실제 기능');await expect(shown).toContainText('실제 배정·Agent 실행 아님');await expect(page.getByRole('button',{name:'이전 임무 초안 원문 열기',exact:true})).toHaveCount(0);}
 else {await expect(page.getByRole('alert')).toContainText(mode==='DENIED'?'PROJECT_OPERATION_DENIED':'RESPONSE_INVALID');await expect(shown).toHaveCount(0);}
 await expect(page.getByRole('textbox',{name:'임무 목표',exact:true})).toHaveValue('아직 저장하지 않은 입력');expect(facts.commands).toHaveLength(1);expect(facts.unexpected).toEqual([]);expect(facts.errors).toEqual([]);
});

for(const mode of ['FILE','ROOT','ALL','LOSS'])test('ASSIGNMENT_SCOPE_REDUCTION_'+mode,async({page})=>{
 const facts=await setup(page),commands:any[]=[];
 const scopes=[{sourceRootRef:ref(planId),mappingRef:null,observationRef:ref(user),baselineRef:ref(applicationId),targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false},{relativePath:'src/b.ts',kind:'FILE',access:'READ',recursive:false}]},{sourceRootRef:ref(user),mappingRef:null,observationRef:ref(planId),baselineRef:ref(applicationId),targets:[{relativePath:'README.md',kind:'FILE',access:'READ',recursive:false}]}];
 const definition={taskRef:{planRef,taskCode:'FN01',applicationRef,nodeId:'N1'},purpose:'작업 범위 최소화',goal:'사용 가능한 기능',baselineRefs:[planRef,applicationRef,plan.designRef],inputs:['설계'],outputs:['구현'],acceptanceCriteria:['핵심 동작'],verificationRequirements:['변경 확인'],included:['개발'],excluded:['운영'],allowedScopes:scopes,environmentRef:null,requiredCapabilities:['파일 작업'],budgetRef:null,ownerRole:'단계책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수·통합'};
 const snapshot={definition,reason:'보관 초안',previousRef:null,basis:{planRef,applicationRef,designRef:plan.designRef,taskCode:'FN01',nodeId:'N1',taskCardHash:contentHash(canonicalJson(card))},readinessIssues:[{code:'SOURCE_SCOPE_UNVERIFIED',location:'allowedScopes'}],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false},reference={id:draftId,version:1,contentHash:contentHash(canonicalJson(snapshot))};
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts?*`,route=>route.fulfill({json:{items:[{ref:reference,status:'DRAFT',goal:definition.goal,taskRef:definition.taskRef,issueCount:1,updatedAt:at,ready:false,executionAuthorized:false}],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${draftId}/versions/1`,route=>route.fulfill({json:{projectId:pid,ref:reference,snapshot,headVersion:1,sourceCurrentness:'NOT_RECHECKED',observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/commands`,route=>{
  const command=route.request().postDataJSON();commands.push(command);expect(command.operation).toBe('prepareAssignment');expect(command.targetId).toBe(draftId);expect(command.expectedVersion).toBe(1);expect(command.payload.baseRef).toEqual(reference);
  if(mode==='LOSS'&&commands.length===1)return route.abort();
  const stored={...snapshot,definition:command.payload.definition,reason:command.payload.reason,previousRef:reference,readinessIssues:[{code:command.payload.definition.allowedScopes.length?'SOURCE_SCOPE_UNVERIFIED':'SOURCE_SCOPE_MISSING',location:'allowedScopes'}]},storedRef={id:draftId,version:2,contentHash:contentHash(canonicalJson(stored))};
  return route.fulfill({json:{operationId:draftId,commandId:command.commandId,projectId:pid,status:'APPLIED',targetId:draftId,version:2,data:{ref:storedRef,status:'ASSIGNMENT_DRAFT_STORED',snapshot:stored},evidenceRefs:[],warnings:[],serverReceivedAt:at}});
 });
 await page.getByRole('button',{name:'임무 초안 목록 조회',exact:true}).click();await page.getByRole('button',{name:'임무 버전 열기: 1',exact:true}).click();await page.getByRole('button',{name:'현재 버전으로 개정 준비',exact:true}).click();
 const editor=page.getByRole('region',{name:'임무 소스 범위 축소',exact:true});await expect(editor.getByRole('button',{name:'소스 범위 1에서 src/a.ts 제외',exact:true})).toBeEnabled();
 if(mode==='FILE'||mode==='LOSS')await editor.getByRole('button',{name:'소스 범위 1에서 src/a.ts 제외',exact:true}).click();
 else {await editor.getByRole('button',{name:'소스 범위 1 전체 제외',exact:true}).click();if(mode==='ALL')await editor.getByRole('button',{name:'소스 범위 1 전체 제외',exact:true}).click();}
 const expected=structuredClone(scopes);if(mode==='FILE'||mode==='LOSS')expected[0]!.targets.splice(0,1);else expected.splice(0,mode==='ALL'?2:1);
 if(mode==='ALL')await expect(editor.getByText('선택 범위 없음 · 범위 미충족이며 전체 접근 허가가 아닙니다.',{exact:true})).toBeVisible();
 expect(commands).toHaveLength(0);await page.getByRole('textbox',{name:'임무 저장 이유',exact:true}).fill('불필요한 범위만 축소');await page.getByRole('button',{name:'임무 초안 저장',exact:true}).click();
 if(mode==='LOSS'){await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(editor.getByRole('button',{name:'소스 범위 1 전체 제외',exact:true})).toBeDisabled();await page.getByRole('button',{name:'같은 임무 명령 결과 확인',exact:true}).click();await expect(page.getByText('임무 초안 저장 확인',{exact:true})).toBeVisible();expect(commands).toHaveLength(2);expect(commands[1]).toEqual(commands[0]);}
 else {await expect(page.getByText('임무 초안 저장 확인',{exact:true})).toBeVisible();expect(commands).toHaveLength(1);}
 expect(commands[0].payload.definition).toEqual({...definition,allowedScopes:expected});await expect(page.getByText((mode==='ALL'?'SOURCE_SCOPE_MISSING':'SOURCE_SCOPE_UNVERIFIED')+' · allowedScopes',{exact:true})).toBeVisible();expect(facts.unexpected).toEqual([]);expect(facts.errors).toEqual([]);
});

for(const mode of ['NORMAL','EXPIRED','HASH','DETAIL_DENIED','PAGE_DENIED'])test('ASSIGNMENT_ENVIRONMENT_'+mode,async({page})=>{
 const facts=await setup(page);await prepare(page);
 const id='77777777-7777-4777-8777-777777777777',codes=['INSTRUCTION_SESSION','STATE_ORIGINAL','RESULT_EVIDENCE','TOOL_APPROVAL','STOP_RECLAIM','PATH_WRITE_CONTROL'],input={kind:'ENVIRONMENT_CANDIDATE',candidate:{label:'WSL 대상 후보'},candidateRef:null,policyRef:ref(user),expiresAt:'2026-10-21T00:00:00.000Z',reason:'실행 전 후보 보관'};
 const candidate={kind:input.kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[{field:'executionHostRef',reason:'NOT_PROVIDED'},{field:'hostTrust',reason:'UNVERIFIED'}]},capabilities:codes.map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:null,environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:['NO_AGENT_MEASUREMENT']}))},candidateRef={id,version:1,contentHash:contentHash(canonicalJson(candidate))},view={ref:candidateRef,candidate,expired:mode==='EXPIRED',createdAt:'2026-10-20T00:00:00.000Z',recordedBy:user,executionAuthorized:false,observedAt:'2026-10-20T00:01:00.000Z'};
 const queries:string[]=[];await page.route('**/api/v1/projects/'+pid+'/connection-candidates?*',r=>{const q=new URL(r.request().url()).searchParams;queries.push(q.toString());if(q.has('cursor'))return r.fulfill({status:403,json:{code:'PROJECT_READ_DENIED'}});return r.fulfill({json:{view:'CANDIDATES_ONLY',items:[{ref:candidateRef,kind:'ENVIRONMENT_CANDIDATE',label:input.candidate.label,readiness:'NOT_READY',expiresAt:input.expiresAt,integrity:'NOT_RECHECKED'}],hasMore:mode==='PAGE_DENIED',nextCursor:mode==='PAGE_DENIED'?'ENV-NEXT':null,observedAt:at}});});
 await page.route('**/api/v1/projects/'+pid+'/connection-candidates/'+id+'/versions/1',r=>mode==='DETAIL_DENIED'?r.fulfill({status:403,json:{code:'PROJECT_READ_DENIED'}}):r.fulfill({json:mode==='HASH'?{...view,ref:{...candidateRef,contentHash:'0'.repeat(64)}}:view}));
 const panel=page.getByLabel('임무 환경 후보 선택',{exact:true});await panel.getByRole('button',{name:'환경 후보 목록 조회',exact:true}).click();await panel.getByRole('button',{name:'환경 원문 대조 후 초안 선택: WSL 대상 후보',exact:true}).click();
 if(['EXPIRED','HASH','DETAIL_DENIED'].includes(mode)){
  await expect(page.getByRole('alert')).toContainText(mode==='EXPIRED'?'ASSIGNMENT_ENVIRONMENT_CANDIDATE_UNAVAILABLE':mode==='HASH'?'RESPONSE_INVALID':'PROJECT_READ_DENIED');await expect(panel).toContainText('초안 환경 참조 없음');await expect(panel.getByLabel('대조한 환경 후보',{exact:true})).toHaveCount(0);
 }else{
  await expect(panel.getByLabel('초안 환경 고정 참조',{exact:true})).toContainText(candidateRef.contentHash);await expect(panel.getByLabel('대조한 환경 후보',{exact:true})).toContainText('NOT_READY');expect(facts.commands).toHaveLength(0);
  if(mode==='PAGE_DENIED'){
   await panel.getByRole('button',{name:'환경 후보 다음 목록',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_READ_DENIED');await expect(panel.getByRole('button',{name:'환경 원문 대조 후 초안 선택: WSL 대상 후보',exact:true})).toHaveCount(0);await expect(panel.getByLabel('대조한 환경 후보',{exact:true})).toHaveCount(0);await expect(panel.getByLabel('초안 환경 고정 참조',{exact:true})).toContainText(candidateRef.contentHash);expect(queries.at(-1)).toBe('limit=50&kind=ENVIRONMENT_CANDIDATE&cursor=ENV-NEXT');
  }else{
   await page.getByRole('button',{name:'임무 초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');expect(facts.commands[0].payload.definition.environmentRef).toEqual(candidateRef);expect(facts.stored.snapshot.ready).toBe(false);expect(facts.stored.snapshot.executionAuthorized).toBe(false);await expect(page.getByLabel('임무 고정 조건',{exact:true})).toContainText(candidateRef.contentHash);
  }
 }
 expect(queries[0]).toBe('limit=50&kind=ENVIRONMENT_CANDIDATE');expect(facts.commands).toHaveLength(mode==='NORMAL'?1:0);expect(facts.unexpected).toEqual([]);expect(facts.errors).toEqual([]);
});

for(const mode of ['NORMAL','REVOKED','HASH','READ_DENIED'])test('ASSIGNMENT_BUDGET_'+mode,async({page})=>{
 const facts=await setup(page);await prepare(page);
 const id='66666666-6666-4666-8666-666666666666',snapshot:any={scope:{kind:'PROJECT',projectId:pid},limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1073741824,maxOfflineMs:300000},reason:'유한 작업 한도',policyBaseVersion:0,state:'APPLIED',previousRef:null,decidedBy:{kind:'HUMAN',userId:user},decidedAt:'2026-10-20T00:00:00.000Z',expiresAt:'2026-10-20T02:00:00.000Z',executionAuthorized:false,dispatchPerformed:false};
 const base={id,version:1,contentHash:contentHash(canonicalJson(snapshot))};if(mode==='REVOKED'){snapshot.previousRef={...base};snapshot.policyBaseVersion=1;snapshot.state='REVOKED';}
 const policyRef={id,version:mode==='REVOKED'?2:1,contentHash:contentHash(canonicalJson(snapshot))},panel=page.getByLabel('임무 예산 정책 선택',{exact:true});
 await page.route('**/api/v1/projects/'+pid+'/limit-policies/'+id+'/versions/*',r=>r.fulfill({json:{projectId:pid,ref:policyRef,snapshot}}));
 await panel.getByLabel('선택 예산 정책 ID',{exact:true}).fill(id);await panel.getByLabel('선택 예산 정책 버전',{exact:true}).fill(String(policyRef.version));await panel.getByLabel('선택 예산 정책 hash',{exact:true}).fill(mode==='HASH'?'0'.repeat(64):policyRef.contentHash);
 await panel.getByRole('button',{name:'임무 예산 고정 버전 조회',exact:true}).click();
 if(mode==='HASH'){await expect(page.getByRole('alert')).toContainText('LIMIT_POLICY_RESPONSE_INVALID');await expect(panel.getByLabel('선택 전 예산 보관본',{exact:true})).toHaveCount(0);await expect(panel).toContainText('초안 예산 참조 없음');}
 else{
  await expect(panel.getByLabel('선택 전 예산 보관본',{exact:true})).toContainText('현재 유효성 미검증');
  if(mode==='REVOKED'){await expect(panel.getByRole('button',{name:'이 보관 예산을 임무 초안에 선택',exact:true})).toBeDisabled();await expect(panel).toContainText('초안 예산 참조 없음');}
  else{
   await panel.getByRole('button',{name:'이 보관 예산을 임무 초안에 선택',exact:true}).click();await expect(panel.getByLabel('초안 예산 고정 참조',{exact:true})).toContainText('BUDGET_UNVERIFIED');expect(facts.commands).toHaveLength(0);
   if(mode==='READ_DENIED'){await page.route('**/api/v1/projects/'+pid+'/limit-policies/'+id+'/versions/*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));await panel.getByRole('button',{name:'임무 예산 고정 버전 조회',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(panel.getByLabel('선택 전 예산 보관본',{exact:true})).toHaveCount(0);await expect(panel.getByLabel('초안 예산 고정 참조',{exact:true})).toContainText(policyRef.contentHash);}
   else{await page.getByRole('button',{name:'임무 초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');expect(facts.commands[0].payload.definition.budgetRef).toEqual(policyRef);expect(facts.stored.snapshot.ready).toBe(false);expect(facts.stored.snapshot.executionAuthorized).toBe(false);await expect(page.getByLabel('임무 고정 조건',{exact:true})).toContainText(policyRef.contentHash);}
  }
 }
 expect(facts.commands).toHaveLength(mode==='NORMAL'?1:0);expect(facts.unexpected).toEqual([]);expect(facts.errors).toEqual([]);
});
test('임무 초안을 계획에서 작성·저장하고 고정 원문 재조회하되 실행으로 표시하지 않는다', async ({ page }) => {
  const facts = await setup(page); await prepare(page); await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인'); await expect(page.getByRole('region', { name: '저장한 임무 초안', exact: true })).toContainText('실제 배정·Agent 실행 아님');
  await page.getByRole('button', { name: '저장 버전 재조회', exact: true }).click(); await expect(page.getByText('저장 버전 재조회 확인', { exact: true })).toBeVisible();
  expect(facts.commands).toHaveLength(1); expect(facts.commands[0].payload.definition.goal).toBe('사용 가능한 실제 기능'); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('임무 응답 유실은 원입력과 같은 명령을 보존하고 새 임무 자동 생성하지 않는다', async ({ page }) => {
  const facts = await setup(page, true); await prepare(page); await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST'); await expect(page.getByRole('textbox', { name: '임무 목표', exact: true })).toHaveValue('사용 가능한 실제 기능'); expect(facts.commands).toHaveLength(1);
  await page.getByRole('button', { name: '같은 임무 명령 결과 확인', exact: true }).click(); await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');
  expect(facts.commands).toHaveLength(2); expect(facts.commands[1]).toEqual(facts.commands[0]); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('이미 저장됐을 수 있는 임무는 재확인 제어권409로 원 명령 거절이 확정되지 않는다', async ({ page }) => {
  const facts = await setup(page, true); await prepare(page); await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.route(`**/api/v1/projects/${pid}`, route => route.fulfill({ json: { ...project, controlState: { ...project.controlState, generation: 2 } } }));
  await page.getByRole('button', { name: '같은 임무 명령 결과 확인', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('CONTROL_GENERATION_CONFLICT');
  await expect(page.getByRole('button', { name: '거절 명령 확인 후 입력 수정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '같은 임무 명령 결과 확인', exact: true })).toBeVisible(); await expect(page.getByRole('textbox', { name: '임무 목표', exact: true })).toHaveValue('사용 가능한 실제 기능');
  expect(facts.commands).toHaveLength(1); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('임무 미저장 입력은 화면 이동 후 같은 주체에게 보존되고 자동 전송되지 않는다', async ({ page }) => {
  const facts = await setup(page); await prepare(page);
  await page.evaluate(value => { location.hash = `/projects/${value}/session`; }, pid); await expect(page.getByRole('heading', { name: '아직 연결되지 않은 화면', exact: true })).toBeVisible();
  await page.evaluate(value => { location.hash = `/projects/${value}/workspace`; }, pid); await expect(page.getByRole('heading', { name: '임무 프로젝트', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '적용 절차 조회', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '임무 목표', exact: true })).toHaveValue('사용 가능한 실제 기능'); expect(facts.commands).toHaveLength(0); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
test('임무 고정 원문 조회 거절은 앞선 저장 원문을 현재 조회처럼 남기지 않는다', async ({ page }) => {
  const facts = await setup(page); await prepare(page); await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click(); await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');
  await page.route(`**/api/v1/projects/${pid}/assignment-drafts/${draftId}/versions/1`, route => route.fulfill({ status: 403, json: { code: 'PROJECT_READ_DENIED' } }));
  await page.getByRole('button', { name: '저장 버전 재조회', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('PROJECT_READ_DENIED');
  await expect(page.getByRole('region', { name: '저장한 임무 초안', exact: true })).toHaveCount(0); expect(facts.commands).toHaveLength(1); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});

test('저장한 임무의 고정 조건 전체를 읽고 미연결 참조를 실행 허가로 표시하지 않는다', async ({ page }) => {
  const facts = await setup(page); await prepare(page);
  await page.getByRole('textbox', { name: '임무 필요 능력 · 한 줄 한 항목', exact: true }).fill('파일 수정\n핵심 검증');
  await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click(); await expect(page.getByRole('status')).toContainText('임무 초안 저장 확인');
  const detail = page.getByRole('region', { name: '임무 고정 조건', exact: true }); await expect(detail).toBeVisible();
  for (const value of ['단계책임자', '합의한 요구', '처리·저장·조회', '핵심 동작', '저장됨', '개발', '운영 배포', '파일 수정', '핵심 검증', '책임자가 검수하고 통합', '작업 지시를 준비']) await expect(detail.getByText(value, { exact: true })).toBeVisible();
  await expect(detail.getByText(`${planId} · v1 · ${planRef.contentHash}`, { exact: true }).first()).toBeVisible();
  await expect(detail.getByText('FN01 · N1', { exact: true })).toBeVisible(); await expect(detail.getByText('미연결 · 미검증', { exact: true })).toHaveCount(3);
  await expect(detail.getByText('등록 범위 없음 · 실행 허가 아님', { exact: true })).toBeVisible(); await expect(detail.locator('textarea,input,button')).toHaveCount(0);
  await page.getByRole('button', { name: '저장 버전 재조회', exact: true }).click(); await expect(page.getByText('저장 버전 재조회 확인', { exact: true })).toBeVisible(); await expect(detail.getByText('핵심 검증', { exact: true })).toBeVisible();
  expect(facts.commands).toHaveLength(1); expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});

for (const kind of ['계획', '임무'] as const) for (const next of [false, true]) test(`${kind} 목록 ${next ? '다음 쪽' : '재조회'} 대기·거절 시 앞선 요약을 치우고 원입력·미확인 명령을 보존한다`, async ({ page }) => {
  const facts = await setup(page, kind === '임무'); await prepare(page);
  if (kind === '임무') { await page.getByRole('button', { name: '임무 초안 저장', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST'); }
  const path = kind === '계획' ? 'work-plans' : 'assignment-drafts', label = kind === '계획' ? '계획 목록 조회' : '임무 초안 목록 조회';
  const item = kind === '계획' ? { ref: planRef, status: 'DRAFT', title: '합의한 계획', documentRef: plan.documentRef, designRef: plan.designRef, issueCount: 0, updatedAt: at, integrity: 'NOT_RECHECKED' } : { ref: facts.stored.ref, status: 'DRAFT', goal: facts.stored.snapshot.definition.goal, taskRef: facts.stored.snapshot.definition.taskRef, issueCount: 1, updatedAt: at, ready: false, executionAuthorized: false };
  const row = page.getByRole('button', { name: kind === '계획' ? '계획 열기: 합의한 계획' : '임무 버전 열기: 1', exact: true });
  await page.route(`**/api/v1/projects/${pid}/${path}?*`, route => route.fulfill({ json: { items: [item], hasMore: true, nextCursor: 'next-page', observedAt: at } }));
  await page.getByRole('button', { name: label, exact: true }).click(); await expect(row).toHaveCount(1);
  let release!: () => void; const responseReady = new Promise<void>(resolve => { release = resolve; }), queries: string[] = [];
  await page.route(`**/api/v1/projects/${pid}/${path}?*`, async route => { queries.push(route.request().url()); await responseReady; return route.fulfill({ status: 403, json: { code: 'PROJECT_READ_DENIED' } }); });
  await page.getByRole('button', { name: next ? `${kind} 다음 목록` : label, exact: true }).click();
  try { await expect(row).toHaveCount(0); } finally { release(); }
  await expect(page.getByRole('alert')).toContainText('PROJECT_READ_DENIED'); await expect(row).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '임무 목표', exact: true })).toHaveValue('사용 가능한 실제 기능');
  expect(queries).toHaveLength(1); expect(new URL(queries[0]!).searchParams.get('cursor')).toBe(next ? 'next-page' : null);
  expect(facts.commands).toHaveLength(kind === '임무' ? 1 : 0);
  if (kind === '임무') await expect(page.getByRole('button', { name: '같은 임무 명령 결과 확인', exact: true })).toBeVisible();
  expect(facts.unexpected).toEqual([]); expect(facts.errors).toEqual([]);
});
