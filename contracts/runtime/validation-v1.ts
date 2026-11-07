import {canonicalJson} from '../canonical.ts';
export const uuidV1=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export const hashV1=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export function recordV1(v:unknown,keys:readonly string[]):v is Record<string,any>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)return false;
 const d=Object.getOwnPropertyDescriptors(v);return Object.keys(d).sort().join(',')===[...keys].sort().join(',')&&Object.values(d).every(p=>p.enumerable&&'value'in p);
}
export function arrayV1(v:unknown,max:number):v is any[]{if(!Array.isArray(v)||v.length>max||Object.getOwnPropertySymbols(v).length)return false;const d=Object.getOwnPropertyDescriptors(v);return Object.keys(d).length===v.length+1&&Array.from({length:v.length},(_,i)=>d[String(i)]).every(p=>p&&p.enumerable&&'value'in p);}
export interface RuntimeRefV1{id:string;version:number;contentHash:string}
export const refV1=(v:unknown):v is RuntimeRefV1=>recordV1(v,['id','version','contentHash'])&&uuidV1(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hashV1(v.contentHash);
export const isoV1=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const cloneV1=<T>(v:T):T=>JSON.parse(canonicalJson(v));
