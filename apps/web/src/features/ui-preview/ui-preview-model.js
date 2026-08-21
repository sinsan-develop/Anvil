export const DEFAULT_MENU_ID = 'dashboard';

const menu = (id, title, label, icon, description, cards, nextAction) => Object.freeze({
  id,
  title,
  label,
  icon,
  description,
  status: 'UI_PREVIEW',
  cards: Object.freeze(cards.map(card => Object.freeze(card))),
  nextAction,
});

export const MENU_ITEMS = Object.freeze([
  menu('dashboard', 'Dashboard', '전체 현황', '⌂', '시스템과 프로젝트의 상태, 경고, 승인 대기와 다음 행동을 한눈에 확인합니다.', [
    {title: 'System health', value: 'Preview ready', detail: 'API · DB · LLM은 연결되지 않았습니다.'},
    {title: 'Active project', value: 'Anvil', detail: '현재 작업 패키지와 단계가 표시됩니다.'},
    {title: 'Approval queue', value: '2 pending', detail: '사람의 결정이 필요한 항목 위치입니다.'},
    {title: 'Alerts', value: '1 notice', detail: '운영 이상과 조치 경로가 표시됩니다.'},
  ], 'Workbench에서 현재 요청과 결과 보고 위치를 확인하세요.'),
  menu('workbench', 'Workbench', '어울 작업실', '◫', '대화에서 작업 지시, 실행 관찰, 결과 보고와 승인까지 이어지는 중심 작업 공간입니다.', [
    {title: 'Conversation', value: '어울과 대화', detail: '질문, 설계 논의와 결정 요청'},
    {title: 'Current task', value: 'B-04 · TEST_REVIEW', detail: '단계, 담당자와 다음 행동'},
    {title: 'Evidence', value: 'Preview only', detail: '실행 증거와 미실행 경계'},
  ], 'Conversation에서 요청을 시작하거나 Reports에서 결과 보고를 확인하세요.'),
  menu('projects', 'Projects', '프로젝트', '◇', '저장소, 기준선, 정책, 보호 경로와 환경 연결을 관리하는 위치입니다.', [
    {title: 'Repositories', value: '3 registered', detail: 'Git 상태와 기준선'},
    {title: 'Protected paths', value: 'Enabled', detail: '변경 금지 경로와 정책'},
    {title: 'Environments', value: '2 linked', detail: 'Local · WSL · ysna 연결'},
  ], '프로젝트 상세에서 Repository와 환경 연결 위치를 검토하세요.'),
  menu('runs', 'Runs', '실행', '▶', '실행 이력, 실시간 상태, 담당 Agent와 중단·재개 위치를 확인합니다.', [
    {title: 'Running', value: '0', detail: '현재 실행 중인 작업'},
    {title: 'Waiting', value: '1', detail: '승인 또는 입력 대기'},
    {title: 'Completed', value: '24', detail: '완료 결과와 증거'},
  ], '실행 상세에서 로그 대신 구조화 상태와 다음 행동을 확인하세요.'),
  menu('reviews', 'Reviews', '검토·승인', '✓', '계획, 범위 변경, 적용과 배포의 사람 승인 대기열입니다.', [
    {title: 'Plan review', value: '1 pending', detail: '작업계획 승인'},
    {title: 'Change review', value: '0 pending', detail: '범위·위험 변경 승인'},
    {title: 'Release review', value: '1 pending', detail: '적용·배포 결정'},
  ], '승인 전 영향 범위와 검증 증거를 함께 확인하세요.'),
  menu('quality', 'Quality', '품질', '◆', 'Tests, Benchmarks, Prompt와 Model 평가 결과를 비교합니다.', [
    {title: 'Tests', value: 'Not connected', detail: '테스트 결과와 결함'},
    {title: 'Benchmarks', value: 'Not connected', detail: '기준 대비 성능'},
    {title: 'Evaluations', value: 'Not connected', detail: 'Prompt · Model 평가'},
  ], '실제 검증 연결 전에는 결과가 NOT CONNECTED로 유지됩니다.'),
  menu('knowledge', 'Knowledge', '지식', '▤', 'Learning Studio, Sources, Memory, Code Patterns, Rules, Skills와 Retrieval을 관리합니다.', [
    {title: 'Learning Studio', value: 'Preview', detail: '학습 자료와 목적 지정'},
    {title: 'Memory', value: 'Preview', detail: '승인된 장기 기억'},
    {title: 'Skills', value: 'Preview', detail: '검증 절차의 재사용'},
  ], '학습 항목은 사람 승인 후 다음 작업부터 적용됩니다.'),
  menu('agents-automation', 'Agents & Automation', '에이전트·자동화', '⚙', 'Subagents, Hooks, Plugins와 실행 정책을 구분해 관리합니다.', [
    {title: 'Subagents', value: 'Not connected', detail: '역할·lease·상태'},
    {title: 'Hooks', value: 'Not connected', detail: '기계적 검증 Gate'},
    {title: 'Plugins', value: 'Not connected', detail: '승인된 확장 기능'},
  ], '자동화 요소별 권한과 차단 이유를 독립적으로 확인하세요.'),
  menu('environments', 'Environments', '환경', '▦', 'Local, Docker, WSL, SSH와 Cloud 환경의 연결·상태·경계를 확인합니다.', [
    {title: 'Local', value: 'Preview', detail: '개발 프로세스'},
    {title: 'WSL', value: 'Preview', detail: '통합 검증 환경'},
    {title: 'ysna-server', value: 'UI target', detail: '공개 프리뷰 배포 대상'},
  ], '환경별 실제 상태는 연결 후 별도 증거로 표시됩니다.'),
  menu('operations', 'Operations', '운영', '◉', 'Alerts, Audit, Worker, Queue, 비용과 Deployment Monitoring 위치입니다.', [
    {title: 'Alerts', value: 'Not connected', detail: '이상 감지와 조치'},
    {title: 'Queue & Worker', value: 'Not connected', detail: '대기열과 lease'},
    {title: 'Deployment', value: 'UI preview', detail: '배포 상태와 rollback'},
  ], '운영 수치는 실제 API 연결 전까지 NOT CONNECTED입니다.'),
  menu('settings', 'Settings', '설정', '☷', 'LLM Provider, Routing, 전역 Policy, 사용자와 권한을 설정하는 위치입니다.', [
    {title: 'LLM Providers', value: '9 visible', detail: '상태·credential·model'},
    {title: 'Routing', value: 'Not connected', detail: '역할별 실행 경로'},
    {title: 'Policy & Access', value: 'Preview', detail: '전역 정책과 권한'},
  ], 'Secret 값과 내부 endpoint는 브라우저에 표시하지 않습니다.'),
]);

export const WORKBENCH_TABS = Object.freeze([
  {id: 'conversation', label: '대화', title: '어울과 대화', description: '아이디어, 질문과 설계 결정을 자연어로 전달합니다.'},
  {id: 'instructions', label: '작업 지시', title: '작업 지시', description: '작업 범위, 첨부자료, 완료 조건과 담당자를 확인합니다.'},
  {id: 'progress', label: '진행 현황', title: '진행 현황', description: '현재 단계, 담당 Agent, 중단·재개와 다음 행동을 확인합니다.'},
  {id: 'reports', label: '결과 보고', title: '결과 보고', description: '완료, 실패, 중단 보고와 실행 증거를 확인합니다.'},
  {id: 'approvals', label: '승인 요청', title: '승인 요청', description: '기능 범위, 요구사항 또는 중요 위험 변경을 결정합니다.'},
  {id: 'history', label: '작업 기록', title: '작업 기록', description: '대화, 지시, 실행, 결과와 결정의 시간순 기록입니다.'},
].map(item => Object.freeze(item)));

export function getMenuById(id) {
  return MENU_ITEMS.find(item => item.id === id) ?? MENU_ITEMS[0];
}

export function normalizeMenuId(value) {
  const candidate = String(value ?? '').replace(/^#/, '').trim().toLowerCase();
  return MENU_ITEMS.some(item => item.id === candidate) ? candidate : DEFAULT_MENU_ID;
}
