'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeOrigin,assertIpc,connectionError}=require('../../apps/desktop/src/policy.cjs');
test('FN18 exact HTTPS origin accepts explicit canonical origin only',()=>{
 assert.equal(normalizeOrigin('https://Example.test:443/'),'https://example.test');
 for(const value of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test/a/..','https://example.test/?a','https://example.test/#x','https://example.test/\n',' https://example.test','https://example.test\\a','https://example.test/%2e%2e/','https://example.test/'+String.fromCharCode(0xd800),null,{},['https://example.test']])assert.throws(()=>normalizeOrigin(value),/SERVER_ORIGIN_INVALID/);
});
test('FN18 IPC requires own main frame exact local URL and closed input',()=>{
 const frame={url:'anvil-local://shell/settings.html'};const owner={mainFrame:frame};
 const event={sender:owner,senderFrame:frame};
 assert.equal(assertIpc(event,owner,'get-state',null),null);
 assert.deepEqual(assertIpc(event,owner,'connect',{serverOrigin:'https://example.test',replaceInvalidConfig:false}),{serverOrigin:'https://example.test',replaceInvalidConfig:false});
 for(const e of [{sender:{mainFrame:frame},senderFrame:frame},{sender:owner,senderFrame:{url:frame.url}},{sender:owner,senderFrame:{url:'null'}},{sender:owner,senderFrame:null}])assert.throws(()=>assertIpc(e,owner,'get-state',null),/IPC_SENDER_DENIED/);
 for(const input of [{serverOrigin:'https://example.test',replaceInvalidConfig:false,extra:1},{serverOrigin:'https://example.test',replaceInvalidConfig:'false'},Object.defineProperty({},'serverOrigin',{get(){throw Error('accessor');},enumerable:true})])assert.throws(()=>assertIpc(event,owner,'connect',input));
 assert.throws(()=>assertIpc(event,owner,'client-quit',{ackUnverifiedRuntime:false}),/IPC_INPUT_INVALID/);
 assert.throws(()=>assertIpc(event,owner,'eval',{}),/IPC_INPUT_INVALID/);
});
test('FN18 load errors distinguish TLS offline and blocked without success',()=>{
 assert.equal(connectionError(-202),'TLS_ERROR');assert.equal(connectionError(-106),'OFFLINE');assert.equal(connectionError(-20),'BLOCKED');assert.equal(connectionError(-2),'LOAD_FAILED');
});
test('FN18 SDK fixed source rejects mirrors credentials query and HTTP without downloading',()=>{
 const {allowedDownload}=require('../../apps/desktop/scripts/prepare-sdk.cjs');
 const {VERSION,BASENAME,ZIP_HASH}=require('../../apps/desktop/scripts/verify-sdk.cjs');
 assert.equal(VERSION,'45.1.0');assert.equal(BASENAME,'electron-v45.1.0-win32-x64.zip');assert.equal(ZIP_HASH,'55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2');
 assert.equal(allowedDownload('https://github.com/electron/electron/releases/download/v45.1.0/'+BASENAME),true);
 assert.equal(allowedDownload('https://release-assets.githubusercontent.com/github-production-release-asset/1/a?sig=synthetic'),true);
 for(const url of ['http://github.com/electron/electron/releases/download/v45.1.0/'+BASENAME,'https://example.test/'+BASENAME,'https://user:pass@github.com/electron/electron/releases/download/v45.1.0/'+BASENAME,'https://github.com/electron/electron/releases/download/v45.1.0/'+BASENAME+'?x=1','https://github.com/electron/electron/releases/download/v45.0.0/'+BASENAME,'https://release-assets.githubusercontent.com/other'])assert.throws(()=>allowedDownload(url),/SDK_DOWNLOAD_ORIGIN_DENIED/);
});
test('FN18 exact local frame URL rejects query fragment and remote frame identity',()=>{
 for(const url of ['anvil-local://shell/settings.html?x=1','anvil-local://shell/settings.html#x','https://example.test','null']){const mainFrame={url};const owner={mainFrame};assert.throws(()=>assertIpc({sender:owner,senderFrame:mainFrame},owner,'get-state',null),/IPC_SENDER_DENIED/);}
});
