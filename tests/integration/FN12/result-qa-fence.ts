/** 이 시험의 새 query 시작만 막는다. 이미 전송한 원격 query의 취소/rollback 증명은 아니다. */
export function fenceResultQaPool<T extends object>(pool:T,check:()=>void):T{
 const rollback=(query:unknown)=>typeof query==='string'&&/^\s*ROLLBACK\s*;?\s*$/i.test(query);
 const connect=async():Promise<any>=>{
  check();const method:any=Reflect.get(pool,'connect'),client:any=await Reflect.apply(method,pool,[]);
  try{check();}catch(error){client.release();throw error;}
  return new Proxy(client,{get(target,key){if(key==='query')return async(...args:unknown[])=>{if(!rollback(args[0]))check();return Reflect.apply(target.query,target,args);};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
 };
 return new Proxy(pool,{get(target,key){if(key==='connect')return connect;if(key==='query')return async(...args:unknown[])=>{const client=await connect();try{return await client.query(...args);}finally{client.release();}};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}
