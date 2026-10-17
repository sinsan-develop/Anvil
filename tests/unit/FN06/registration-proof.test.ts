import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {proofBytes,publicKeyFingerprint,verifyHostProof} from '../../../apps/server/modules/connections/registration-proof.ts';
const publicKeySpki='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgJB1A_FZzq230jy6NItV8_2YWPjEjvb_PcSaYJIgJGGnhJaWWWlhEkpeHr4ahYB1ZpZx9rp6GAqCRak38uxwww';
const payload={protocolVersion:1 as const,installationId:'11111111-1111-4111-8111-111111111111',registrationId:'22222222-2222-4222-8222-222222222222',scopeDigest:'a'.repeat(64),publicKeyFingerprint:'5e448d803b0a8a30970029fea69931bd7de4ca5b6fe984b7ac51dc73b7a4baa1',serverNonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',clientNonce:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',expiresAt:'2026-10-17T00:01:00.000Z'};
const signature='aZhA47aTCmTeqsUuG11Qv9O-wRQnDqHPJBskAelZ_LrUpG3s2z632jdVeYDW7u-Fc2pdIq6c1W7BQ3TmFTiAeQ';
test('고정 SPKI/8필드 canonical·P1363 벡터의 실제 서명을 검증한다',()=>{
 assert.equal(publicKeyFingerprint(publicKeySpki),payload.publicKeyFingerprint);
 assert.equal(proofBytes(payload).toString('utf8'),JSON.stringify({clientNonce:payload.clientNonce,expiresAt:'2026-10-17T00:01:00.000Z',installationId:payload.installationId,protocolVersion:1,publicKeyFingerprint:payload.publicKeyFingerprint,registrationId:payload.registrationId,scopeDigest:'a'.repeat(64),serverNonce:payload.serverNonce}));
 assert.equal(verifyHostProof(publicKeySpki,signature,payload,payload,new Date('2026-10-17T00:00:00.000Z')),true);
});
test('다른 host/nonce·scope/설치·기한·서명 형식/변조는 같은 증명이 아니다',()=>{
 const now=new Date('2026-10-17T00:00:00.000Z');
 for(const changed of [{...payload,serverNonce:payload.clientNonce},{...payload,scopeDigest:'b'.repeat(64)},{...payload,installationId:payload.registrationId},{...payload,extra:true}])assert.throws(()=>verifyHostProof(publicKeySpki,signature,changed,payload,now));
 assert.throws(()=>verifyHostProof(publicKeySpki,signature.slice(1),payload,payload,now));
 const modified=Buffer.from(signature,'base64url');modified[0]=modified[0]!^1;assert.throws(()=>verifyHostProof(publicKeySpki,modified.toString('base64url'),payload,payload,now));
 assert.throws(()=>verifyHostProof(publicKeySpki,signature,payload,payload,new Date(payload.expiresAt)),{message:'HOST_PROOF_EXPIRED'});
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});assert.throws(()=>verifyHostProof(other.publicKey.export({format:'der',type:'spki'}).toString('base64url'),signature,payload,payload,now));
 const derSignature=sign('sha256',proofBytes(payload),{key:other.privateKey,dsaEncoding:'der'});assert.throws(()=>verifyHostProof(publicKeySpki,derSignature.toString('base64url'),payload,payload,now));
});
test('동일 signed payload라도 현재 challenge와 다르면 재사용하지 않는다',()=>{assert.throws(()=>verifyHostProof(publicKeySpki,signature,payload,{...payload,registrationId:payload.installationId},new Date('2026-10-17T00:00:00.000Z')));assert.throws(()=>publicKeyFingerprint(publicKeySpki+'='));});
