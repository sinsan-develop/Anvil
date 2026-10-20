import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { buildBuiltinMethodologies } from '../../../apps/server/modules/methodologies/builtins.ts';
import { methodContentReviewCriteria } from '../../../apps/server/modules/methodologies/content-review.ts';
import { validateMethodologyGraph } from '../../../apps/server/modules/methodologies/service.ts';
import { fenceResultQaPool } from '../FN12/result-qa-fence.ts';

// 준비한 시험 코드다. 정식 설정/DB 또는 임의 경로에 fallback하지 않고 실제 격리 실행은 별도다.
test('FN02 새 canonical 후보를 같은 Git의 JS graph/form·경계 숫자와 실제 PG에서 대조한다',{timeout:30000},async t=>{
  const until=Date.parse(process.env.ANVIL_FN02_QA_UNTIL??''),sha=process.env.ANVIL_FN02_QA_SHA??'',host=process.env.ANVIL_FN02_QA_HOST??'',password=process.env.ANVIL_FN02_QA_APP??'';
  if(process.platform!=='linux'||process.getuid?.()!==1000||await realpath(process.cwd())!=='/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01'
    ||!/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)||!/^[0-9a-f]{64}$/.test(password)
    ||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+600000||!/^[0-9a-f]{40}$/.test(sha)
    ||execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha
    ||process.env.ANVIL_DB_CONFIG||process.env.ANVIL_MIGRATOR_CONFIG)throw Error('FN02_EXACT_ISOLATED_QA_REQUIRED');
  const check=()=>assert(!t.signal.aborted&&Date.now()<until,'FN02_QA_EXPIRED');
  const pool=fenceResultQaPool(new Pool({host,port:5432,database:'anvil_v3_fn02_empty_application_qa_01',user:'anvil_v3_app',password,max:1,connectionTimeoutMillis:3000,statement_timeout:3000}),check);
  try{
    const identity=(await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(identity,{db:'anvil_v3_fn02_empty_application_qa_01',role:'anvil_v3_app',rolsuper:false,rolbypassrls:false});
    const source=await readFile(new URL('../../../db/migrations/0031_empty_project_methodology_application.sql.pending',import.meta.url),'utf8');
    const row=(await pool.query("SELECT checksum FROM anvil.schema_migrations WHERE id='0031_empty_project_methodology_application'")).rows;
    assert.deepEqual(row,[{checksum:contentHash(source)}]);
    const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
    const methods=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms);
    const numbers=[0,-0,1,-1,Number.MAX_SAFE_INTEGER,Number.MIN_SAFE_INTEGER,0.1,-0.1,1.25,1.2345678901234567,1.0000000000000002,1e-6,1e-7,-1e-7,1.2345678901234567e-7,Number.MIN_VALUE,2.2250738585072014e-308,0.0000010000000000000002,9007199254740990];
    const values:unknown[]=[null,true,false,'한글·줄\n탭\t따옴표"\\/\b\f\r\u2028😀',...numbers,
      {z:2,a:[{key:'원문',value:0.1}]},...forms.forms.map(f=>f.definition),...methods.map(m=>m.graph)];
    // 호출 세션의 설정이 달라도 같은 결과여야 한다. 로그에 원문/credential을 출력하지 않는다.
    for(const setting of [0,3]){
      await pool.query('SET extra_float_digits='+setting);
      for(const value of values){
        const actual=(await pool.query('SELECT anvil.fn02_canonical($1::jsonb) body,anvil.fn02_hash($1::jsonb) hash',[JSON.stringify(value)])).rows[0];
        assert.equal(actual.body,canonicalJson(value));assert.equal(actual.hash,contentHash(canonicalJson(value)));
      }
    }
    const graphs=methods.map(m=>structuredClone(m.graph)),base=methods[0]!.graph;
    const bad=(mutate:(g:any)=>void)=>{const g=structuredClone(base);mutate(g);assert.equal(validateMethodologyGraph(g,forms.forms.map(f=>f.ref)).validForConfirmation,false);graphs.push(g);};
    bad(g=>g.nodes=[]);bad(g=>g.nodes.push(structuredClone(g.nodes[0])));bad(g=>g.entryNodeId='absent');
    bad(g=>g.terminalNodeIds.push('absent'));bad(g=>g.terminalNodeIds.push(g.terminalNodeIds[0]));
    bad(g=>g.nodes[0].completionCriteria=[]);bad(g=>g.nodes[0].recordRequirements=[]);bad(g=>g.nodes[0].taskScope.included=[]);
    bad(g=>{g.nodes[0].kind='HUMAN';g.nodes[0].role='STAGE_OWNER';});
    bad(g=>{g.nodes[0].kind='AGENT';g.nodes[0].role='COORDINATOR';delete g.nodes[0].requirements;});
    bad(g=>{g.nodes[0].kind='JOIN';delete g.nodes[0].joinRule;});
    bad(g=>g.edges.push({edgeId:'cycle',fromNodeId:g.terminalNodeIds[0],toNodeId:g.entryNodeId,kind:'SEQUENCE',condition:null,reason:''}));
    bad(g=>g.edges.push({edgeId:'conditionless',fromNodeId:g.entryNodeId,toNodeId:g.terminalNodeIds[0],kind:'BRANCH',condition:null,reason:''}));
    bad(g=>g.edges.push({edgeId:'unlimited',fromNodeId:g.terminalNodeIds[0],toNodeId:g.entryNodeId,kind:'REWORK',condition:{fieldRef:{nodeId:g.entryNodeId,field:'REVIEW_OUTCOME'},operator:'EQ',value:'REWORK'},reason:'횟수 없음'}));
    for(const graph of graphs){
      const expected=validateMethodologyGraph(graph,forms.forms.map(f=>f.ref)).validForConfirmation;
      assert.equal((await pool.query('SELECT anvil.fn02_graph_valid($1::jsonb) valid',[JSON.stringify(graph)])).rows[0].valid,expected);
    }
    const items=methodContentReviewCriteria.items.map(item=>({criterionId:item.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 검토'}));
    assert.deepEqual((await pool.query('SELECT anvil.fn02_method_criteria() criteria')).rows[0].criteria,methodContentReviewCriteria);
    for(const [text,expected] of [['v',true],['\u000b',false],['\u00a0',false],['\u000bv\u000b',true]] as const)
      assert.equal((await pool.query('SELECT anvil.fn02_text(to_jsonb($1::text)) valid',[text])).rows[0].valid,expected);
    assert.equal((await pool.query('SELECT anvil.fn02_accepted_items($1::jsonb) valid',[JSON.stringify(items)])).rows[0].valid,true);
    const invalidItems=[[],[...items.slice(0,4),items[0]],items.map((item,i)=>i?item:{...item,outcome:'REWORK'}),items.map((item,i)=>i?item:{...item,criterionId:'FAKE'})];
    for(const invalid of invalidItems)assert.equal((await pool.query('SELECT anvil.fn02_accepted_items($1::jsonb) valid',[JSON.stringify(invalid)])).rows[0].valid,false);
    // 깊이/unsafe integer를 조용히 재해시하지 않는다. statement 실패는 원 transaction 성공과 구분한다.
    await assert.rejects(pool.query("SELECT anvil.fn02_canonical('9007199254740992'::jsonb)"));
    console.log('FN02_CANONICAL_GRAPH_PG_JS_MATCH '+JSON.stringify({cases:values.length,settings:2,graphs:graphs.length,invalidItems:invalidItems.length,officialForms:forms.forms.length,methods:methods.length,actualAgentCalls:0,formalDbChanges:0}));
  }finally{await pool.end();}
});
