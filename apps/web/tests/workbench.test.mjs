import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDERS,
  RUNTIME_SCENARIOS,
  STATES,
  initialState,
  providerPresentation,
  reduceWorkbench,
} from '../src/features/workbench/workbench-state.js';
import { apiPath, createWorkbenchClient } from '../src/api/workbench-client.js';

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
