export type Screen = 'projects' | 'create' | 'methodologies' | 'workspace' | 'session' | 'documents' | 'changes' | 'approvals' | 'transfers' | 'knowledge' | 'connections' | 'control' | 'mobile' | 'settings' | 'not-found';
export interface Route { screen: Screen; projectId: string | null; assignmentRef?:{id:string;version:number;contentHash:string} }
export const screenTitles: Record<Screen, string> = {
  projects: '프로젝트', create: '프로젝트 만들기', methodologies: '방법론', workspace: '프로젝트 작업', session: '단계책임자·실행',
  documents: '문서·설계 추적', changes: '설계 변경', approvals: '승인·중요 문제', transfers: '도구 이전', knowledge: '헌법·지식',
  connections: '도구·환경', control: '작업 권한 인계', mobile: '모바일 작업', settings: '설정·보조 조회', 'not-found': '화면을 찾을 수 없습니다',
};
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/projects';
  if (path === '/projects') return { screen: 'projects', projectId: null };
  if (path === '/projects/new') return { screen: 'create', projectId: null };
  if (path === '/methodologies' || path === '/settings') return { screen: path.slice(1) as Screen, projectId: null };
  const detail=/^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/session\/assignments\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/versions\/([1-9][0-9]{0,15})\/([0-9a-f]{64})$/.exec(path);
  if(detail&&Number.isSafeInteger(Number(detail[3])))return{screen:'session',projectId:detail[1]!,assignmentRef:{id:detail[2]!,version:Number(detail[3]),contentHash:detail[4]!}};
  const match = /^\/projects\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(workspace|session|documents|changes|approvals|transfers|knowledge|connections|control|mobile|methodologies|settings)$/.exec(path);
  if (match) return { screen: match[2] as Screen, projectId: match[1]! };
  return { screen: 'not-found', projectId: null };
}
/** 조회용 고정 초안 선택이다. URL만으로 접근/실행 권한을 만들지 않는다. */
export function sessionDetailHref(projectId:string,ref:{id:string;version:number;contentHash:string}):string{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
 if(!uuid.test(projectId)||!ref||Object.keys(ref).sort().join(',')!=='contentHash,id,version'||!uuid.test(ref.id)||!Number.isSafeInteger(ref.version)||ref.version<1||!/^[0-9a-f]{64}$/.test(ref.contentHash))throw Error('CLIENT_PATH_INVALID');
 return '#/projects/'+projectId+'/session/assignments/'+ref.id+'/versions/'+ref.version+'/'+ref.contentHash;
}
export function routeHref(screen: Screen, projectId: string | null): string {
  if (screen === 'projects') return '#/projects';
  if (screen === 'create') return '#/projects/new';
  return projectId ? `#/projects/${encodeURIComponent(projectId)}/${screen}` : `#/${screen}`;
}
