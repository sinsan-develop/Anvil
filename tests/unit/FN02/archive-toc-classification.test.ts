import assert from 'node:assert/strict';
import test from 'node:test';
import {assignmentDevelopmentBaselineNames} from '../../../scripts/assignment-draft-development-guard.ts';
const load=()=>import(new URL('../../../scripts/fn02-archive-toc-classification.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function fixture(){
 const entries:string[]=[];let id=1,oid=20000;
 entries.push(`${id++}; 1262 18000 DATABASE - anvil_v3_development anvil_v3_bootstrap`);
 for(const name of assignmentDevelopmentBaselineNames){const [schema,table]=name.split('.');entries.push(`${id++}; 1259 ${oid} TABLE ${schema} ${table} anvil_v3_migrator`);entries.push(`${id++}; 0 ${oid++} TABLE DATA ${schema} ${table} anvil_v3_migrator`);}
 entries.push(`${id++}; 1259 30000 SEQUENCE anvil auth_audit_events_server_sequence_seq anvil_v3_migrator`);
 entries.push(`${id++}; 0 0 SEQUENCE SET anvil auth_audit_events_server_sequence_seq anvil_v3_migrator`);
 entries.push(`${id++}; 1255 40000 FUNCTION anvil check_request(uuid, text) anvil_v3_migrator`);
 const header='; dbname: anvil_v3_development\n; TOC Entries: 1000\n; Format: CUSTOM\n; Dumped from database version: 15.18\n; Dumped by pg_dump version: 15.18\n; Selected TOC Entries:\n';
 return {entries,header,text:header+entries.join('\n')+'\n'};
}
test('표81개와 DATA·sequence 대상의 목록 대조는 실제 보존·실행 권한이 아니다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');
 const output=m.classifyFn02ArchiveToc(fixture().text);
 assert.equal(output.status,'TOC_CLASSIFIED_NOT_VERIFIED');assert.equal(output.matchedTablePairs,81);
 assert.equal(output.missingTables,0);assert.equal(output.missingTableData,0);assert.equal(output.sequenceEntries,2);
 assert.equal(output.fullArchiveCoverageVerified,false);assert.equal(output.archiveBytesVerified,false);assert.equal(output.executionAllowed,false);
 assert.equal(output.logicalObjectIdentityVerified,false);assert.equal(output.unresolvedObjectIdentities,1);
 assert.ok(Object.isFrozen(output));
});

test('identity에 생성되지 않는 OWNED BY 항목을 필수로 요구하거나 조용히 허용하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');
 const native=m.classifyFn02ArchiveToc(fixture().text);assert.equal(native.status,'TOC_CLASSIFIED_NOT_VERIFIED');
 const unexpected=m.classifyFn02ArchiveToc(fixture().text+'999; 0 0 SEQUENCE OWNED BY anvil auth_audit_events_server_sequence_seq anvil_v3_migrator\n');
 assert.equal(unexpected.status,'TOC_REQUIRES_REVIEW');assert.ok(unexpected.issues.some((i:any)=>i.code==='UNEXPECTED_IDENTITY_OWNERSHIP_ENTRY'));
 for(const kind of ['SEQUENCE','SEQUENCE SET']){
  const f=fixture();const output=m.classifyFn02ArchiveToc(f.header+f.entries.filter(line=>!line.includes(` ${kind} anvil `)).join('\n'));
  assert.equal(output.status,'TOC_REQUIRES_REVIEW');assert.ok(output.issues.some((i:any)=>i.code==='SEQUENCE_NOT_LISTED_EXACTLY_ONCE'));
 }
});
test('누락·추가·중복·다른 OID의 TABLE DATA는 준비 완료로 분류하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');
 for(const change of ['missing-table','missing-data','duplicate-table','wrong-data-oid','unexpected-table']){
  const f=fixture();
  if(change==='missing-table')f.entries.splice(1,1);
  if(change==='missing-data')f.entries.splice(2,1);
  if(change==='duplicate-table')f.entries.push('999; 1259 20000 TABLE anvil approval_consumptions anvil_v3_migrator');
  if(change==='wrong-data-oid')f.entries[2]=f.entries[2]!.replace('0 20000 TABLE DATA','0 99999 TABLE DATA');
  if(change==='unexpected-table')f.entries.push('999; 1259 50000 TABLE anvil unexpected_private_table anvil_v3_migrator');
  const output=m.classifyFn02ArchiveToc(f.header+f.entries.join('\n'));
  assert.equal(output.status,'TOC_REQUIRES_REVIEW',change);assert.equal(output.executionAllowed,false);
  assert.equal(JSON.stringify(output).includes('unexpected_private_table'),false);
 }
});
test('미지원·알 수 없는 항목과 모호한 이름은 원문 노출 없이 검토 대상으로 남긴다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');
 for(const line of ['999; 0 0 BLOB - 50000 anvil_v3_bootstrap','999; 0 0 UNKNOWN_SECRET_KIND - SECRET_OWNER','999; 1259 50000 TABLE anvil "private table" owner']){
  const output=m.classifyFn02ArchiveToc(fixture().text+line+'\n');
  assert.equal(output.status,'TOC_REQUIRES_REVIEW');assert.equal(output.executionAllowed,false);
  assert.doesNotMatch(JSON.stringify(output),/SECRET_OWNER|SECRET_KIND|private table/);
 }
});
test('잘못된 header·편집한 선택목록·중복 ID·제어문자·과대 입력은 거절한다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');const f=fixture();
 for(const bad of [f.text.replace('Format: CUSTOM','Format: PLAIN'),f.text.replace('15.18','16.1'),f.text.replace('anvil_v3_development','another_db'),f.text+';999; 0 0 TABLE DATA anvil users owner\n',f.text+'1; 1259 99999 TABLE anvil unexpected owner\n',f.text+'\u0000',f.header+'unstructured secret\n','x'.repeat(2097153)])assert.throws(()=>m.classifyFn02ArchiveToc(bad),/^Error: FN02_TOC_INVALID$/);
});
test('메타자료·다단어 descriptor는 잘라 해석하거나 목록 순서를 복원 명령으로 쓰지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');
 const output=m.classifyFn02ArchiveToc(fixture().text+'999; 0 0 DEFAULT ACL anvil DEFAULT PRIVILEGES FOR TABLES anvil_v3_migrator\n1000; 2606 50000 FK CONSTRAINT anvil child child_parent_fkey anvil_v3_migrator\n');
 assert.equal(output.descriptorCounts['DEFAULT ACL'],1);assert.equal(output.descriptorCounts['FK CONSTRAINT'],1);
 assert.ok(output.familyCounts,'범주별 대조 누락');assert.equal(output.familyCounts.default_privileges,1);assert.equal(output.familyCounts.constraints,1);assert.equal(output.familyCounts.relations,81);
 assert.equal(output.executionAllowed,false);assert.equal('restoreList'in output,false);
 assert.equal(output.unresolvedObjectIdentities,3);
});

test('기본 선택목록에서 DB가 빠지거나 헤더 수보다 적어도 전체목록 확인으로 승격하지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.classifyFn02ArchiveToc,'function');const f=fixture();
 const output=m.classifyFn02ArchiveToc(f.header+f.entries.slice(1).join('\n'));
 assert.equal(output.status,'TOC_REQUIRES_REVIEW');assert.equal(output.selectedListCompletenessVerified,false);
 assert.ok(output.issues.some((i:any)=>i.code==='DATABASE_NOT_LISTED_EXACTLY_ONCE'));
 assert.equal(output.fullArchiveCoverageVerified,false);assert.equal(output.executionAllowed,false);
});
