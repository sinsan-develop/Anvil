import {types} from 'node:util';

/** 내부 parser 단계의 같은 호출 순서를 동기/비동기로 소비한다. 실행 권위나 기본 OS 포트가 아니다. */
export type SubnetSteps<T>=Generator<()=>unknown,T,unknown>;
export function runSubnetSteps<T>(steps:SubnetSteps<T>,failure:T):T{
 try{let next=steps.next();while(!next.done)next=steps.next(next.value());return next.value;}
 catch{steps.return(failure);return failure;}
}
export async function runSubnetStepsAsync<T>(steps:SubnetSteps<T>,failure:T):Promise<T>{
 try{
  let next=steps.next();
  while(!next.done){
   const value=next.value();let settled=value;
   // 임의 thenable/getter를 await하지 않는다. 비동기 포트는 원 native Promise만 반환한다.
   if(types.isPromise(value)){
    if(types.isProxy(value)||Object.getPrototypeOf(value)!==Promise.prototype||Object.hasOwn(value,'constructor')||Object.hasOwn(value,'then'))throw null;
    settled=await value;
   }
   next=steps.next(settled);
  }
  return next.value;
 }catch{steps.return(failure);return failure;}
}
