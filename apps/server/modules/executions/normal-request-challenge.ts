import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {FastifyRequest} from 'fastify';
import {refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {canonicalBase64} from '../connections/registration-proof.ts';

function denied():never{throw new AuthFailure('EXECUTION_CREDENTIAL_DENIED',403);}
/** 호출자의 credential 원문은 TLS 경계에서만 해석한다. 이후 저장소에 전달되는 값은 digest다. */
export function normalRequestBearerDigest(request:FastifyRequest,host:string,proofHeader=false){
 const names=request.raw.rawHeaders.filter((_,i)=>!(i%2)).map(h=>h.toLowerCase());
 if(!('encrypted' in request.raw.socket)||request.raw.socket.encrypted!==true||request.headers.host!==host||
   names.filter(n=>n==='host').length!==1||names.filter(n=>n==='authorization').length!==1||
   names.filter(n=>n==='anvil-execution-auth').length!==(proofHeader?1:0))denied();
 const value=request.headers.authorization,m=typeof value==='string'&&/^Bearer (av3ex1_([A-Za-z0-9_-]{43}))$/.exec(value);
 if(!m)denied();
 try{canonicalBase64(m[2],32);}catch{denied();}
 return createHash('sha256').update(m[1]!).digest('hex');
}
/** SQL은 발급 시의 만료된 nonce를 재사용하지 않고, 원 발급 영수증/소비/예약의 불변 연결만 읽는다. */
export async function requestCredential(db:PoolClient,tokenDigest:string,connector:string,execution:string,request:any){
 const g=request.grantRef;
 const r=(await db.query('SELECT * FROM anvil.normal_request_credential($1,$2,$3,$4,$5,$6,$7)',
  [tokenDigest,connector,execution,g.id,g.version,g.contentHash,request.credentialGeneration])).rows;
 const c=r[0];
 if(r.length!==1||!uuidV1(c.project_id)||!refV1(c.credential_ref)||!(c.expires_at instanceof Date)||!Number.isFinite(c.expires_at.getTime()))
  throw new AuthFailure('NOT_FOUND',404);
 return {project:c.project_id,ref:c.credential_ref,expiresAt:c.expires_at.getTime()};
}
export async function requestChallengeStats(db:PoolClient,keys:readonly unknown[],credentialRef:unknown,at:Date){
 const s=(await db.query(`SELECT count(*) FILTER (WHERE v.version=1)::int AS total,COALESCE(max(v.server_sequence),0)::int+1 AS sequence,
  count(*) FILTER (WHERE v.version=1 AND v.snapshot_json->'credentialRef'=$4::jsonb AND v.snapshot_json#>>'{publicChallenge,purpose}'='EXECUTION_REQUEST'
   AND (v.snapshot_json#>>'{publicChallenge,issuedAt}')::timestamptz>$5::timestamptz-interval '1 minute')::int AS recent,
  count(*) FILTER (WHERE v.version=1 AND v.snapshot_json->'credentialRef'=$4::jsonb AND v.snapshot_json#>>'{publicChallenge,purpose}'='EXECUTION_REQUEST'
   AND (v.snapshot_json#>>'{publicChallenge,expiresAt}')::timestamptz>$5::timestamptz AND NOT EXISTS(SELECT 1 FROM anvil.execution_challenges used
   WHERE used.project_id=v.project_id AND used.id=v.id AND used.version=2))::int AS live
  FROM anvil.execution_challenges v WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3`,[...keys,JSON.stringify(credentialRef),at])).rows[0];
 if(!s||!Number.isSafeInteger(s.live)||s.live<0||s.live>s.total)throw new AuthFailure('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(s.live>=1)throw new AuthFailure('EXECUTION_REQUEST_CHALLENGE_LIVE_LIMIT',429);
 return s;
}
