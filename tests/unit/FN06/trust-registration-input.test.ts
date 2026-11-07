import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readHostTrustRegistration,readHostTrustConfirmation} from '../../../apps/server/modules/connections/trust-registration-input.ts';

const now=new Date('2026-10-17T00:00:00.000Z'),id='11111111-1111-4111-8111-111111111111';
const input=()=>({kind:'HOST_TRUST_REGISTRATION',hostLabel:'합성 PC',expectedHostFingerprint:'a'.repeat(64),policyRef:{id,version:1,contentHash:'b'.repeat(64)},expiresAt:'2026-10-17T00:10:00.000Z',reason:'상태 조회 전용 등록 시험'});
// 기존 완성형 프로젝트/환경 허가를 trust-only 입력에서 받거나 범위를 숨겨 확대하면 실패한다.
test('trust-only 등록은 별도 discriminant·유한 10분·현재 정책 ref만 받고 모든 grant 필드를 거절한다',()=>{
 const source=input(),result=readHostTrustRegistration(source,now);assert.deepEqual(result,source);source.policyRef.version=2;assert.equal(result.policyRef.version,1);
 for(const patch of [{kind:'CONNECTOR'},{allowedProjectRefs:[]},{environmentRefs:[]},{grants:[]},{credentialScope:'EXECUTION'},{publicKeySpki:'injected'},{expiresAt:'2026-10-17T00:10:00.001Z'},{expiresAt:'2026-10-17T00:00:00.000Z'},{policyRef:{id,version:1,contentHash:'bad'}},{hostLabel:'x\ny'},{reason:'Bearer synthetic-secret-token'},{expectedHostFingerprint:'A'.repeat(64)}])assert.throws(()=>readHostTrustRegistration({...input(),...patch},now));
 assert.throws(()=>readHostTrustRegistration(input(),new Date('invalid')));
});
// 사용자 확인은 exact 지문/범위/대상 비교를 생략하거나 모호한 decision을 허용하면 실패한다.
test('trust-only 사용자 확인은 정확 비교 필드와 명시 APPROVE/REJECT만 허용한다',()=>{
 const value={registrationId:id,observedHostFingerprint:'a'.repeat(64),scopeDigest:'b'.repeat(64),decision:'APPROVE',reason:'직접 공개 지문과 범위를 대조'};
 assert.deepEqual(readHostTrustConfirmation(value),value);assert.equal(readHostTrustConfirmation({...value,decision:'REJECT'}).decision,'REJECT');
 for(const patch of [{decision:true},{decision:'approve'},{registrationId:'not-uuid'},{observedHostFingerprint:'A'.repeat(64)},{scopeDigest:'short'},{version:1},{reason:'password=synthetic-secret-value'}])assert.throws(()=>readHostTrustConfirmation({...value,...patch}));
});
