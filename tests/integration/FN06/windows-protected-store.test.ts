import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,copyFile,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {WindowsProtectedStore} from '../../../apps/connector/security/secret-store.ts';
import {verifyHostProof,publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';

test('Windows 실제 CurrentUser DPAPI·CNG/Node 상호서명은 private/token stdout 없이 실패를 차단한다',async()=>{
 if(process.platform!=='win32'||!process.env.ANVIL_FN06_HELPER||!process.env.ANVIL_FN06_QA_ROOT)throw Error('WINDOWS_APPROVED_QA_REQUIRED_NOT_SKIP');
 const root=process.env.ANVIL_FN06_QA_ROOT,executablePath=process.env.ANVIL_FN06_HELPER,protectedRoot=join(root,'protected'),expectedExecutableHash=createHash('sha256').update(await readFile(executablePath)).digest('hex');
 const store=new WindowsProtectedStore({executablePath,protectedRoot,expectedExecutableHash}),keyId=randomUUID(),credentialId=randomUUID(),wrongId=randomUUID(),owned:string[]=[];
 try{
  const key=await store.createHostKey(keyId);owned.push(join(protectedRoot,keyId+'.key'));
  assert.equal(key.keyId,keyId);assert.equal(key.fingerprint,publicKeyFingerprint(key.publicKeySpki));
  const payload={protocolVersion:1 as const,installationId:randomUUID(),registrationId:randomUUID(),scopeDigest:'a'.repeat(64),publicKeyFingerprint:key.fingerprint,serverNonce:randomBytes(32).toString('base64url'),clientNonce:randomBytes(32).toString('base64url'),expiresAt:new Date(Date.now()+120000).toISOString()};
  const signed=await store.signHostProof(keyId,payload);assert.equal(verifyHostProof(key.publicKeySpki,signed.signature,payload,payload,new Date()),true);assert.deepEqual((await store.publicHostKey(keyId)),key);
  const fixed={protocolVersion:1 as const,installationId:'11111111-1111-4111-8111-111111111111',registrationId:'22222222-2222-4222-8222-222222222222',scopeDigest:'a'.repeat(64),publicKeyFingerprint:'5e448d803b0a8a30970029fea69931bd7de4ca5b6fe984b7ac51dc73b7a4baa1',serverNonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',clientNonce:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',expiresAt:'2026-10-17T00:01:00.000Z'};
  assert.equal(await store.verifyPublicProof('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEgJB1A_FZzq230jy6NItV8_2YWPjEjvb_PcSaYJIgJGGnhJaWWWlhEkpeHr4ahYB1ZpZx9rp6GAqCRak38uxwww','aZhA47aTCmTeqsUuG11Qv9O-wRQnDqHPJBskAelZ_LrUpG3s2z632jdVeYDW7u-Fc2pdIq6c1W7BQ3TmFTiAeQ',fixed),true);
  assert.equal(await store.verifyPublicProof(key.publicKeySpki,signed.signature,{...payload,scopeDigest:'b'.repeat(64)}),false);
  const token='av3ct1_'+randomBytes(32).toString('base64url'),digest=createHash('sha256').update(token).digest('hex');
  const stored=await store.storeCredential(credentialId,token);owned.push(join(protectedRoot,credentialId+'.credential'));assert.equal(stored.credentialId,credentialId);assert.equal(stored.digest,digest);assert.equal(await store.credentialMatches(credentialId,digest),true);assert.equal((await readFile(join(protectedRoot,credentialId+'.credential'))).includes(Buffer.from(token)),false);
  await assert.rejects(store.createHostKey(keyId),{message:'PROTECTED_STORE_FAILED'});
  await copyFile(join(protectedRoot,keyId+'.key'),join(protectedRoot,wrongId+'.key'));owned.push(join(protectedRoot,wrongId+'.key'));await assert.rejects(store.publicHostKey(wrongId),{message:'PROTECTED_STORE_FAILED'});
  const path=join(protectedRoot,credentialId+'.credential'),bytes=await readFile(path);bytes[bytes.length-1]=bytes[bytes.length-1]!^1;await writeFile(path,bytes);await assert.rejects(store.credentialMatches(credentialId,digest),{message:'PROTECTED_STORE_FAILED'});
  const changedBinary=new WindowsProtectedStore({executablePath,protectedRoot,expectedExecutableHash:'0'.repeat(64)});await assert.rejects(changedBinary.publicHostKey(keyId),{message:'PROTECTED_HELPER_IDENTITY_INVALID'});
 }finally{for(const path of owned)await unlink(path).catch((e:any)=>{if(e.code!=='ENOENT')throw e;});assert.deepEqual(await readdir(protectedRoot),[]);}
});
