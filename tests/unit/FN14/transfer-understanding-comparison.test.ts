import assert from 'node:assert/strict';
import test from 'node:test';
import {understandingCodes} from '../../../apps/server/modules/executions/execution-understanding.ts';
import {compareTransferUnderstanding} from '../../../apps/server/modules/transfers/transfer-understanding-comparison.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number) => ({id: id(n), version: 1, contentHash: n.toString(16).padStart(64, '0')});

function fixture() {
  const scope = {
    projectId: id(1),
    transferRef: ref(2),
    targetConnectionRef: {...ref(3), version: 2},
    newSessionRef: ref(4),
    sessionGeneration: 3,
    deliveryAttemptRef: ref(5),
    responseRef: ref(6),
  };
  const criteria = understandingCodes.map((code, index) => ({
    code, sourceRefs: [ref(10 + index)], responsePartRefs: [ref(20 + index)],
  }));
  const items = criteria.map(item => ({...item, judgement: 'MATCH', reason: '보호 응답과 같은 근거를 대조함'}));
  return {scope, items, observation: structuredClone({scope, criteria})};
}

function compare(scope: unknown, items: unknown, observation: unknown) {
  return compareTransferUnderstanding(scope, items, () => observation);
}

test('보호 전달·응답의 6개 근거와 사람이 선택한 판정을 나란히 내고 검토 제안까지만 반환한다', () => {
  const {scope, items, observation} = fixture();
  const result = compare(scope, items.toReversed(), observation);
  assert.equal(result.status, 'REVIEW_PROPOSAL');
  assert.equal(result.observation, 'VERIFIED');
  assert.deepEqual(result.items.map(item => item.code), understandingCodes);
  assert.deepEqual(result.items[0], {
    code: items[0]!.code, sourceRefs: items[0]!.sourceRefs, responsePartRefs: items[0]!.responsePartRefs,
    judgement: 'MATCH', reason: items[0]!.reason, evidence: 'VERIFIED',
  });
  assert.equal(result.ready, false);
  assert.equal(result.transferConfirmed, false);
  assert.equal(result.resumeAuthorized, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.dispatchPerformed, false);
  observation.criteria[0]!.sourceRefs[0]!.version++;
  assert.deepEqual(result.items[0]!.sourceRefs, items[0]!.sourceRefs);
});

test('보호 출처가 없거나 객체가 다른 프로젝트·인계본·연결·세션·세대·전달·응답이면 원 판정만으로 제안을 만들지 않는다', () => {
  const {scope, items, observation} = fixture();
  for (const other of [
    null,
    {...scope, projectId: id(99)},
    {...scope, transferRef: {...scope.transferRef, contentHash: ref(99).contentHash}},
    {...scope, targetConnectionRef: {...scope.targetConnectionRef, version: 1}},
    {...scope, newSessionRef: ref(99)},
    {...scope, sessionGeneration: 2},
    {...scope, deliveryAttemptRef: ref(99)},
    {...scope, responseRef: {...scope.responseRef, contentHash: ref(99).contentHash}},
  ]) {
    const result = compare(scope, items, other && {...observation, scope: other});
    assert.equal(result.status, 'NEEDS_REWORK');
    assert.equal(result.observation, 'UNVERIFIED');
    assert(result.items.every(item => item.evidence === 'UNVERIFIED' && item.sourceRefs.length === 0 && item.responsePartRefs.length === 0));
    assert.equal(result.ready, false);
  }
});

test('보호 조회에 한 번 전달하는 범위는 정확하고 닫혀 있으며 잘못된 범위에는 조회하지 않는다', () => {
  const {scope, items, observation} = fixture();
  let reads = 0;
  const read = (expected: Readonly<typeof scope>) => {
    reads++;
    assert.deepEqual(expected, scope);
    assert(Object.isFrozen(expected) && Object.isFrozen(expected.transferRef));
    return observation;
  };
  assert.equal(compareTransferUnderstanding({...scope, sessionGeneration: 0}, items, read).observation, 'UNVERIFIED');
  assert.equal(compareTransferUnderstanding({...scope, verified: true}, items, read).observation, 'UNVERIFIED');
  assert.equal(reads, 0);
  assert.equal(compareTransferUnderstanding(scope, items, read).status, 'REVIEW_PROPOSAL');
  assert.equal(reads, 1);
});

test('같은 보호 관측이라도 현재 위치 누락, 사람의 결정 이유 불일치, 요청에서 덜어 낸 증거는 보완한다', () => {
  const {scope, items, observation} = fixture();
  observation.criteria[3]!.sourceRefs = [];
  items[2]!.judgement = 'MISMATCH';
  items[4]!.responsePartRefs = [];
  const result = compare(scope, items, observation);
  assert.equal(result.observation, 'VERIFIED');
  assert.equal(result.status, 'NEEDS_REWORK');
  assert.equal(result.items[2]!.evidence, 'VERIFIED');
  assert.equal(result.items[2]!.judgement, 'MISMATCH');
  assert.equal(result.items[3]!.evidence, 'INSUFFICIENT');
  assert.equal(result.items[3]!.judgement, 'MATCH');
  assert.equal(result.items[4]!.evidence, 'MISMATCH');
});

test('경계 기준의 최신 지시는 기존 원 대화 ID와 version 없는 MessageRef를 그대로 묶어 대조한다', () => {
  const {scope, items, observation} = fixture();
  const source = {
    kind: 'USER_INSTRUCTION',
    conversationId: id(60),
    ref: {kind: 'CONVERSATION', id: id(61), contentHash: ref(61).contentHash},
  };
  const observed = {...observation, criteria: observation.criteria.map((item, index) => index === 1 ? {...item, sourceRefs: [source]} : item)};
  const reviewed = items.map((item, index) => index === 1 ? {...item, sourceRefs: [source]} : item);
  const result = compare(scope, reviewed, observed);
  assert.equal(result.status, 'REVIEW_PROPOSAL');
  assert.deepEqual(result.items[1]!.sourceRefs, [source]);
  for (const wrongSource of [{...source, conversationId: id(62)}, {...source, ref: {...source.ref, version: 1}}]) {
    const wrong = reviewed.map((item, index) => index === 1 ? {...item, sourceRefs: [wrongSource]} : item);
    assert.equal(compare(scope, wrong, observed).status, 'NEEDS_REWORK');
  }
});

test('6개 중 중복·누락 또는 중복·교차 근거는 같은 원 응답이 있어도 제안으로 바꾸지 않는다', () => {
  const {scope, items, observation} = fixture();
  for (const bad of [items.slice(0, 5), [...items.slice(0, 5), items[0]], [
    {...items[0], sourceRefs: [items[0]!.sourceRefs[0], items[0]!.sourceRefs[0]]},
    ...items.slice(1),
  ]]) assert.equal(compare(scope, bad, observation).status, 'NEEDS_REWORK');
  const mismatched = items.map((item, index) => index ? item : {...item, responsePartRefs: items[1]!.responsePartRefs});
  assert.equal(compare(scope, mismatched, observation).items[0]!.evidence, 'MISMATCH');
  observation.criteria[5]!.responsePartRefs = observation.criteria[0]!.responsePartRefs;
  assert.equal(compare(scope, items, observation).observation, 'UNVERIFIED');
});
