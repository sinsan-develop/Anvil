// 이 문서 화면의 비동기 작성 준비와 설계 의존 진입만 직렬화한다. 실행/서버 권한이 아니다.
export function createDocumentPreparationGate(){
 let owner:symbol|null=null;
 return {acquire():null|(()=>void){if(owner!==null)return null;const token=Symbol();owner=token;return ()=>{if(owner===token)owner=null;};}};
}
export type DocumentPreparationGate=ReturnType<typeof createDocumentPreparationGate>;
