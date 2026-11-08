import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readPageWindow, NormalPageCursors } from '../../../apps/server/modules/executions/normal-command-pages.ts';

test('프로젝트 순번 공백은 허용하며 51번째 명령으로 다음 페이지를 판별한다',()=>{
 const entries=Array.from({length:51},(_,i)=>({sequence:String(i*2+3)}));
 assert.deepEqual(readPageWindow([],0),{sequences:[],hasMore:false});
 assert.deepEqual(readPageWindow(entries.slice(0,50),1),{sequences:entries.slice(0,50).map(r=>Number(r.sequence)),hasMore:false});
 assert.equal(readPageWindow(entries,0).hasMore,true);
 for(const rows of [[{sequence:'9007199254740992'}],[{sequence:'1'},{sequence:'1'}],entries.concat(entries[0]!)])
  assert.throws(()=>readPageWindow(rows,0));
});
test('cursor는 실행/credential scope와 만료에 결박한다',()=>{
 const signer=new NormalPageCursors(randomBytes(32)),scope='a'.repeat(64);
 const cursor=signer.encode(scope,19,1000,2000);
 assert.equal(signer.decode(cursor,scope,1500),19);
 for(const [c,s,t] of [[cursor,'b'.repeat(64),1500],[cursor,scope,2000],[cursor+'x',scope,1500]] as const)
  assert.throws(()=>signer.decode(c,s,t));
 assert.throws(()=>new NormalPageCursors(Buffer.alloc(0)));
});
