/** IX01 시험 내부의 종료 소유권. 실제 프로세스/화면 재시작 증거가 아니다. */
export interface JourneyOwnedResource {name:string;close:()=>Promise<unknown>}
export function registerJourneyClose(owned:JourneyOwnedResource[],name:string,close:()=>Promise<unknown>):()=>Promise<unknown>{
 let promise:Promise<unknown>|undefined;
 const closeOnce=()=>promise??=Promise.resolve().then(close);
 owned.push({name,close:closeOnce});return closeOnce;
}
export async function closeJourneyContext(current:{closeApp:()=>Promise<unknown>;closePool:()=>Promise<unknown>},fresh:()=>void):Promise<void>{
 fresh();await current.closeApp();fresh();await current.closePool();fresh();
}
