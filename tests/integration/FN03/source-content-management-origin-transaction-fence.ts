/** 격리 감독이 이미 공급한 Pool만 감싼다. 연결 설정/승인/권한을 발급하지 않는다.
 * 원 pg 호출을 기다린 결과만 기록한다. 시간 초과 취소·서버 종결 자체는 감독/pg timeout의 책임이다.
 * 현재성 상실 후에는 같은 원 client의 ROLLBACK/release 수거만 허용한다. */
type Terminal='COMMIT'|'ROLLBACK'|'UNKNOWN';
type Release='RELEASED'|'UNKNOWN';
const rejected=()=>Error('FN03_MANAGEMENT_TRANSACTION_UNKNOWN');
export function createManagementOriginTransactionFence<T extends object>(rawPool:T,assertCurrent:()=>void){
 const originalConnect=Reflect.get(rawPool,'connect');
 if(typeof originalConnect!=='function'||typeof assertCurrent!=='function')throw rejected();
 const terminals:Terminal[]=[],released:Release[]=[],activeClients=new WeakSet<object>();
 let failed=false;
 const current=()=>{try{if(failed||Reflect.get(rawPool,'connect')!==originalConnect)throw rejected();assertCurrent();}catch{failed=true;throw rejected();}};
 const connect=async()=>{
  current();let raw:object;
  try{raw=await Reflect.apply(originalConnect,rawPool,[]);}catch(error){failed=true;throw error;}
  if(!raw||typeof raw!=='object'||activeClients.has(raw)){failed=true;throw rejected();}
  const originalQuery=Reflect.get(raw,'query'),originalRelease=Reflect.get(raw,'release');
  if(typeof originalQuery!=='function'||typeof originalRelease!=='function'){failed=true;throw rejected();}
  activeClients.add(raw);
  let dead=false,busy=false,begun=false,ended=false,uncertain=false,rollbackAttempted=false,index:number|undefined;
  const unknown=()=>{failed=true;uncertain=true;if(index===undefined){index=terminals.length;terminals.push('UNKNOWN');}else terminals[index]='UNKNOWN';};
  const release=(...args:unknown[])=>{
   if(dead)throw rejected();
   if(busy){unknown();throw rejected();}
   dead=true;activeClients.delete(raw);
   if(begun&&!ended)unknown();
   try{Reflect.apply(originalRelease,raw,args);released.push('RELEASED');}catch(error){failed=true;released.push('UNKNOWN');throw error;}
  };
  try{current();}catch{failed=true;release();throw rejected();}
  const owned=()=>{if(dead||Reflect.get(raw,'query')!==originalQuery||Reflect.get(raw,'release')!==originalRelease)throw rejected();};
  const query=async(...args:unknown[])=>{
   const sql=args[0],operation=typeof sql==='string'?/^(BEGIN|COMMIT|ROLLBACK)$/.exec(sql)?.[1]:undefined;
   const rollback=operation==='ROLLBACK';
   try{
    if(dead)throw rejected();
    if(busy)throw rejected();
    // 기존 Access의 Promise/string query만 수거한다. callback/임의 query 객체는 수거 증거가 아니다.
    if(typeof sql!=='string'||args.length>2||(args[1]!==undefined&&!Array.isArray(args[1])))throw rejected();
    if(!rollback){owned();current();if(ended||uncertain)throw rejected();}
    if(operation==='BEGIN'&&begun)throw rejected();
    if(operation==='COMMIT'&&!begun)throw rejected();
    if(rollback&&ended&&!uncertain)throw rejected();
    if(rollback&&rollbackAttempted)throw rejected();
   }catch{if(!dead)unknown();throw rejected();}
   busy=true;
   if(rollback)rollbackAttempted=true;
   try{
    const result=await Reflect.apply(originalQuery,raw,args);
    if(operation){
     const tag=result&&typeof result==='object'?Object.getOwnPropertyDescriptor(result,'command'):undefined;
     if(!tag||!('value'in tag)||tag.value!==operation){unknown();throw rejected();}
    }
    if(!rollback){owned();current();}
    if(operation==='BEGIN')begun=true;
    if(operation==='COMMIT'||rollback){
     ended=true;
     if(!uncertain){if(index!==undefined){unknown();throw rejected();}index=terminals.length;terminals.push(operation as 'COMMIT'|'ROLLBACK');}
    }
    return result;
   }catch(error){
    if(operation)unknown();
    else try{owned();current();}catch{unknown();}
    throw error;
   }finally{busy=false;}
  };
  return new Proxy(raw,{get(target,key){if(key==='query')return query;if(key==='release')return release;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 };
 const query=async(...args:unknown[])=>{const client=await connect();try{return await Reflect.apply(Reflect.get(client,'query'),client,args);}finally{Reflect.apply(Reflect.get(client,'release'),client,[]);}};
 const pool=new Proxy(rawPool,{get(target,key){if(key==='connect')return connect;if(key==='query')return query;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 return Object.freeze({pool,settlements:():readonly Terminal[]=>Object.freeze([...terminals]),releases:():readonly Release[]=>Object.freeze([...released])});
}
