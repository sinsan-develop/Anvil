import {createHmac,timingSafeEqual} from 'node:crypto';
import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
export interface SyntheticCommandCursorKey{readonly transport:'SYNTHETIC_ONLY';readonly key:Buffer}
const purpose='SYNTHETIC_EXECUTION_COMMAND_PAGE',domain='anvil:synthetic-execution-command-cursor:v1:';
const reject=():never=>{throw new AuthFailure('EXECUTION_COMMAND_CURSOR_INVALID',412);};
function scopeOf(v:unknown):Scope{
 if(!recordV1(v,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||v.mode!=='EXECUTION'||![v.projectId,v.connectorId,v.executionId].every(uuidV1)||![v.executionGeneration,v.credentialGeneration].every(x=>Number.isSafeInteger(x)&&x>0)||!refV1(v.grantRef))return reject();return cloneV1(v) as unknown as Scope;
}
function pageOf(v:unknown,now:unknown){
 if(!recordV1(v,['schemaVersion','purpose','scope','afterSequence','limit','issuedAt','expiresAt'])||v.schemaVersion!==1||v.purpose!==purpose||v.limit!==50||!Number.isSafeInteger(v.afterSequence)||v.afterSequence<0||!isoV1(v.issuedAt)||!isoV1(v.expiresAt)||!isoV1(now))return reject();
 const start=Date.parse(v.issuedAt),end=Date.parse(v.expiresAt),at=Date.parse(now);if(start>at||end<=at||end<=start||end-start>900000)return reject();scopeOf(v.scope);return v;
}
/** 합성 polling 위치의 변조/다른 실행 재사용만 막는 codec. cursor 자체는 인증/현재 허가가 아니다.
 * 명시 메모리 시험 key 외 생성·파일·환경 fallback이 없으며 pager의 현재 권한/proof 검사를 대체하지 않는다. */
export class SyntheticExecutionCommandCursor{
 readonly transport='SYNTHETIC_ONLY' as const;#source:SyntheticCommandCursorKey;#key:Buffer;
 constructor(source:SyntheticCommandCursorKey){if(source?.transport!=='SYNTHETIC_ONLY'||!Buffer.isBuffer(source.key)||source.key.length!==32)reject();this.#source=source;this.#key=Buffer.from(source.key);}
 #port(){if(this.#source.transport!=='SYNTHETIC_ONLY')reject();}
 #signature(encoded:string){return createHmac('sha256',this.#key).update(domain).update(encoded).digest();}
 encode(rawScope:unknown,afterSequence:unknown,expiresAt:unknown,now:unknown):string{
  try{this.#port();const scope=scopeOf(rawScope),page=pageOf({schemaVersion:1,purpose,scope,afterSequence,limit:50,issuedAt:now,expiresAt},now),text=canonicalJson(page);if(Buffer.byteLength(text)>3000)return reject();const encoded=Buffer.from(text).toString('base64url');return 'v1.'+encoded+'.'+this.#signature(encoded).toString('base64url');}catch{return reject();}
 }
 decode(token:unknown,rawScope:unknown,now:unknown){
  try{this.#port();const scope=scopeOf(rawScope);if(typeof token!=='string'||token.length>4096)return reject();const match=/^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);if(!match)return reject();const payload=Buffer.from(match[1]!,'base64url'),signature=Buffer.from(match[2]!,'base64url');if(payload.length>3000||payload.toString('base64url')!==match[1]||signature.length!==32||signature.toString('base64url')!==match[2]||!timingSafeEqual(signature,this.#signature(match[1]!)))return reject();
   const text=payload.toString('utf8'),page=pageOf(parseWireJson(text),now);if(canonicalJson(page)!==text||canonicalJson(page.scope)!==canonicalJson(scope))return reject();return{afterSequence:page.afterSequence as number,limit:50 as const,issuedAt:page.issuedAt as string,expiresAt:page.expiresAt as string};
  }catch{return reject();}
 }
}
