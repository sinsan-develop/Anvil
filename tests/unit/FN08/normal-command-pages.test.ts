import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fitPage, readPageWindow, NormalPageCursors } from '../../../apps/server/modules/executions/normal-command-pages.ts';

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
test('자료 부분 합계·건수·크기 상한에서 명령을 쪼개지 않고 그 앞에서 페이지를 닫는다',()=>{
 const item=(parts:number,pad='')=>({pad,materials:{groups:[{parts:Array.from({length:parts},()=>({}))}]}});
 assert.equal(fitPage([item(150),item(50),item(1)] as any).length,2);
 assert.equal(fitPage([item(150),item(51)] as any).length,1);
 assert.equal(fitPage(Array.from({length:51},()=>item(1)) as any).length,50);
 assert.equal(fitPage([item(1,'a'.repeat(400)),item(1,'b'.repeat(400))] as any,700).length,1);
 assert.throws(()=>fitPage([item(201)] as any));
 assert.throws(()=>fitPage([item(1,'a'.repeat(800))] as any,700));
 assert.deepEqual(fitPage([]),[]);
});
