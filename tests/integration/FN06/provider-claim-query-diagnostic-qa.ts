/** 조회 QA 전용. 원 SQL/인자/결과·트랜잭션을 바꾸지 않고 알려진 실패 종류만 분리한다. */
import type {Pool} from 'pg';
export async function withClaimOwnerReadDiagnostic<T>(access:{pool:Pool},operation:()=>Promise<T>):Promise<T>{
 const original=access.pool;let denied=false;
 access.pool=new Proxy(original,{get(target,key){
  if(key==='connect')return async()=>{
   const client=await target.connect();return new Proxy(client,{get(db,field){
    if(field==='query')return async(...args:any[])=>{
     try{return await (db.query as Function).apply(db,args);}catch(error){
      const query=typeof args[0]==='string'?args[0]:null;
      if(error&&typeof error==='object'&&'code' in error&&error.code==='42501'&&query&&/FROM anvil\.agent_sessions s\s+JOIN anvil\.commands c\b/.test(query)&&/\bFOR SHARE OF s,c\s*$/.test(query))denied=true;
      throw error;
     }
    };
    const value=Reflect.get(db,field,db);return typeof value==='function'?value.bind(db):value;
   }});
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 try{return await operation();}catch(error){if(denied)throw Error('CLAIM_OWNER_SESSION_LEDGER_LOCK_FORBIDDEN');throw error;}
 finally{access.pool=original;}
}
