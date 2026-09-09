import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROVIDERS,
  RUNTIME_SCENARIOS,
  STATES,
  initialState,
  providerPresentation,
  reduceWorkbench,
} from '../src/features/workbench/workbench-state.js';
import { apiPath, createWorkbenchClient } from '../src/api/workbench-client.js';
import {
  CANONICAL_PROVIDER_IDS,
  createProductionState,
  mapHttpFailure,
  normalizeProviderCatalog,
  reduceProductionWorkbench,
} from '../src/features/workbench/workbench-state.js';

const workbenchCss = readFileSync(new URL('../src/styles/workbench.css', import.meta.url), 'utf8');

test('workbench layout keeps the 430px mobile viewport free of document overflow', () => {
  assert.doesNotMatch(workbenchCss, /body\{[^}]*min-width:1180px/);
  assert.doesNotMatch(workbenchCss, /overflow-x:hidden/);
  assert.match(workbenchCss, /main\{[^}]*grid-template-columns:180px minmax\(0,1fr\)/);
  assert.match(workbenchCss, /\.workspace\{[^}]*min-width:0/);
  assert.match(workbenchCss, /@media\(max-width:640px\)\{[^}]*main\{[^}]*grid-template-columns:1fr/);
  assert.match(workbenchCss, /@media\(max-width:640px\)[\s\S]*\.grid\{[^}]*grid-template-columns:1fr/);
  assert.match(workbenchCss, /\.detail dd,\.stream dd\{[^}]*min-width:0;[^}]*overflow-wrap:anywhere/);
});

test('canonical providers and honest A-12 state vocabulary stay fixed', () => {
  assert.deepEqual(PROVIDERS, ['CEREBRAS','GROQ','MISTRAL','OPENROUTER','UPSTAGE','GEMINI','ANTHROPIC','OPENAI','OLLAMA']);
  assert.deepEqual(STATES, ['NORMAL','LOADING','EMPTY','ERROR','BLOCKED','QUOTA','CANCEL','RECONNECT','PERMISSION_DENIED']);
  assert.equal(initialState.evidence.badge, 'NOT_EXECUTED');
  assert.equal(initialState.evidence.countsAsPass, false);
});

test('state reducer keeps fixture evidence non-PASS and rejects unknown provider', () => {
  const scanned = {...initialState, state:'NORMAL', scan:{status:'SCANNED_READ_ONLY'}};
  const selected = reduceWorkbench(scanned, {type:'PROVIDER_SELECTED', provider:'GROQ'});
  assert.equal(selected.provider, 'GROQ');
  assert.equal(selected.evidence.badge, 'FIXTURE');
  assert.throws(() => reduceWorkbench(initialState, {type:'PROVIDER_SELECTED', provider:'UNKNOWN'}), /provider/i);
  assert.throws(() => reduceWorkbench(initialState, {type:'PROVIDER_SELECTED', provider:'GROQ'}), /unavailable/i);
});

test('fixture changes and unsafe scan outcomes clear stale scan evidence and provider selection', () => {
  const scanned = reduceWorkbench(initialState, {
    type:'SCAN_RECEIVED',
    payload:{
      state:'NORMAL',
      scan:{status:'SCANNED_READ_ONLY'},
      message:'done',
      nextAction:'select provider',
      evidence:{badge:'FIXTURE',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'},
    },
  });
  const selected = reduceWorkbench(scanned, {type:'PROVIDER_SELECTED', provider:'CEREBRAS'});

  const fixtureChanged = reduceWorkbench(selected, {
    type:'SELECTION_CHANGED', projectId:'anvil-fixture', fixtureId:'FIX-PY-DIRTY',
  });
  assert.equal(fixtureChanged.state, 'EMPTY');
  assert.equal(fixtureChanged.scan, null);
  assert.equal(fixtureChanged.provider, '');
  assert.equal(fixtureChanged.evidence.badge, 'NOT_EXECUTED');

  for (const unsafeState of ['BLOCKED','ERROR','PERMISSION_DENIED']) {
    const failed = unsafeState === 'BLOCKED'
      ? reduceWorkbench(selected, {type:'SCAN_RECEIVED', payload:{state:unsafeState,scan:{status:'SCANNED_READ_ONLY'},message:'blocked',nextAction:'retry',evidence:{badge:'FIXTURE',countsAsPass:false,scope:'FIXTURE_BROWSER_RUNTIME_ONLY'}}})
      : reduceWorkbench(selected, {type:'SCAN_FAILED', state:unsafeState, message:'failed'});
    assert.equal(failed.provider, '', unsafeState);
    assert.equal(providerPresentation(failed, 'CEREBRAS').disabled, true, unsafeState);
    assert.equal(providerPresentation(failed, 'CEREBRAS').ariaChecked, 'false', unsafeState);
  }
});

test('deterministic fixture actions reach empty quota cancel and reconnect without actual PASS', () => {
  assert.deepEqual(Object.keys(RUNTIME_SCENARIOS), ['EMPTY','QUOTA','CANCEL','RECONNECT']);
  for (const runtimeState of Object.keys(RUNTIME_SCENARIOS)) {
    const reached = reduceWorkbench(initialState, {type:'RUNTIME_STATE_SELECTED', state:runtimeState});
    assert.equal(reached.state, runtimeState);
    assert.equal(reached.scan, null);
    assert.equal(reached.provider, '');
    assert.equal(reached.evidence.countsAsPass, false);
    assert.match(reached.evidence.scope, /FIXTURE/);
  }
  assert.throws(
    () => reduceWorkbench(initialState, {type:'RUNTIME_STATE_SELECTED', state:'SUCCEEDED'}),
    /runtime state/i,
  );
});

test('browser client accepts relative same-origin API paths only', async () => {
  assert.equal(apiPath('/api/workbench/config'), '/api/workbench/config');
  for (const bad of ['http://localhost:8301/api','https://internal/api','//internal/api','/other']) {
    assert.throws(() => apiPath(bad), /same-origin/i);
  }
  const calls=[];
  const client=createWorkbenchClient(async (url, options={}) => { calls.push([url,options]); return {ok:true,json:async()=>({ok:true})}; });
  await client.scan({projectId:'anvil-fixture',fixtureId:'FIX-PY-CLEAN',role:'operator',csrfToken:'token'});
  assert.equal(calls[0][0], '/api/workbench/scan');
  assert.equal(calls[0][1].headers['x-csrf-token'], 'token');
});

test('production provider catalog accepts only the canonical nine in API order with UPSTAGE primary', () => {
  const rows=['cerebras','groq','mistral','openrouter','upstage','gemini','anthropic','openai','ollama'].map((provider_id)=>({
    provider_id, display_name:provider_id.toUpperCase(), primary:provider_id==='upstage', status:'NOT_CONFIGURED',
    credential_status:'MISSING', health_status:'NOT_CHECKED', latency_ms:null, last_error:null, models:[], moa_eligible:false,
  }));
  assert.deepEqual(CANONICAL_PROVIDER_IDS, rows.map(({provider_id})=>provider_id));
  const catalog=normalizeProviderCatalog({data:rows});
  assert.equal(catalog.length,9);
  assert.equal(catalog[4].displayName,'UPSTAGE');
  assert.equal(catalog[4].primary,true);
  assert.equal(catalog[0].healthStatus,'NOT_CHECKED');
  assert.equal(catalog[0].modelsStatus,'NOT AVAILABLE');

  for (const broken of [rows.slice(0,8), [...rows].reverse(), rows.map((row,index)=>index===4?{...row,primary:false}:row), rows.map((row,index)=>index===0?{...row,credential_key:'SECRET'}:row)]) {
    assert.throws(()=>normalizeProviderCatalog({data:broken}), /provider response/i);
  }
});

test('production state exposes honest loading ready empty blocked permission and reconnect states', () => {
  const initial=createProductionState();
  assert.equal(initial.phase,'LOADING');
  const empty=reduceProductionWorkbench(initial,{type:'PROVIDERS_RECEIVED',providers:[]});
  assert.equal(empty.phase,'EMPTY');
  const denied=reduceProductionWorkbench(initial,{type:'LOAD_FAILED',failure:mapHttpFailure(403)});
  assert.equal(denied.phase,'PERMISSION_DENIED');
  const blocked=reduceProductionWorkbench(initial,{type:'LOAD_FAILED',failure:mapHttpFailure(409)});
  assert.equal(blocked.phase,'BLOCKED');
  const reconnect=reduceProductionWorkbench(initial,{type:'STREAM_DISCONNECTED'});
  assert.equal(reconnect.phase,'RECONNECT');
  assert.equal(mapHttpFailure(500).phase,'ERROR');
});

test('production client performs credentialed same-origin GET only and resumes SSE with Last-Event-ID', async () => {
  const calls=[];
  const responses=[
    {ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>({data:[]})},
    {ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>({data:{provider_id:'upstage'}})},
    {ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>({data:{provider_id:'upstage',models:[]}})},
    {ok:true,status:200,headers:new Headers({'content-type':'text/event-stream'}),text:async()=>('id: evt-1\nevent: TASK_CONFIRMED\ndata: {}\n\n')},
    {ok:true,status:200,headers:new Headers({'content-type':'text/event-stream'}),text:async()=>('')},
  ];
  const client=createWorkbenchClient(async(url,options={})=>{calls.push([url,options]);return responses.shift();});
  await client.providers(); await client.provider('upstage'); await client.models('upstage');
  const first=await client.runEvents('run-1');
  assert.equal(first.lastEventId,'evt-1');
  await client.runEvents('run-1',first.lastEventId);
  assert.deepEqual(calls.map(([url])=>url),['/api/providers','/api/providers/upstage','/api/providers/upstage/models','/api/runs/run-1/events','/api/runs/run-1/events']);
  for (const [,options] of calls) { assert.equal(options.method??'GET','GET'); assert.equal(options.credentials,'include'); }
  assert.equal(calls[3][1].headers['Last-Event-ID'],undefined);
  assert.equal(calls[4][1].headers['Last-Event-ID'],'evt-1');
  assert.doesNotMatch(JSON.stringify(calls),/localhost|127\.0\.0\.1|ANVIL_|API_KEY|BASE_URL/i);
});
