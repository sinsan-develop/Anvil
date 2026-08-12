import test from 'node:test';
import assert from 'node:assert/strict';

import { PROVIDERS, STATES, initialState, reduceWorkbench } from '../src/features/workbench/workbench-state.js';
import { apiPath, createWorkbenchClient } from '../src/api/workbench-client.js';

test('canonical providers and honest A-12 state vocabulary stay fixed', () => {
  assert.deepEqual(PROVIDERS, ['CEREBRAS','GROQ','MISTRAL','OPENROUTER','UPSTAGE','GEMINI','ANTHROPIC','OPENAI','OLLAMA']);
  assert.deepEqual(STATES, ['NORMAL','LOADING','EMPTY','ERROR','BLOCKED','QUOTA','CANCEL','RECONNECT','PERMISSION_DENIED']);
  assert.equal(initialState.evidence.badge, 'NOT_EXECUTED');
  assert.equal(initialState.evidence.countsAsPass, false);
});

test('state reducer keeps fixture evidence non-PASS and rejects unknown provider', () => {
  const selected = reduceWorkbench(initialState, {type:'PROVIDER_SELECTED', provider:'GROQ'});
  assert.equal(selected.provider, 'GROQ');
  assert.equal(selected.evidence.badge, 'FIXTURE');
  assert.throws(() => reduceWorkbench(initialState, {type:'PROVIDER_SELECTED', provider:'UNKNOWN'}), /provider/i);
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
