'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const parser = require('prettier/plugins/babel').parsers.babel;
const { inspectFixedImageSource } = require('../../../scripts/fn07-fixed-image-argv-env-inspection.cjs');

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = '/* 한글😀 */ function make(options){const args=["--model"];args.push(options.model);if(options.sessionId){env.CLAUDE_CODE_ENTRYPOINT="sdk-ts";}delete env.NODE_OPTIONS;return hook({args,env});}';
function input(text = source) {
  const bytes = Buffer.from(text);
  return { bytes, expected: { sha256: sha(bytes), byteLength: bytes.length, units: [{ role: 'TRANSPORT', lo: Buffer.byteLength(text.slice(0, text.indexOf('function'))), hi: bytes.length }] } };
}
function read(text = source, overrides = {}) { return inspectFixedImageSource({ ...input(text), parser, ...overrides }); }

test('완전한 원 AST만 읽고 위치/허용 구문을 추출하되 해석·recipe 권위를 발행하지 않는다', () => {
  const result = read();
  assert.equal(result.status, 'EXTRACTED');
  assert.equal(result.interpretation, 'UNCONFIRMED');
  assert.equal(result.recipeEligible, false);
  assert.ok(result.facts.some(x => x.kind === 'ARGV_TOKEN' && x.token === '--model'));
  assert.ok(result.facts.some(x => x.kind === 'OPTION_READ' && x.option === 'model'));
  assert.ok(result.facts.some(x => x.kind === 'ENV_WRITE' && x.key === 'CLAUDE_CODE_ENTRYPOINT' && x.value === 'sdk-ts' && x.conditions.length === 1));
  assert.ok(result.facts.some(x => x.kind === 'ENV_DELETE' && x.key === 'NODE_OPTIONS'));
  assert.ok(result.unconfirmed.some(x => x.code === 'CALL_BINDING'));
  assert.equal(result.units[0].lo, Buffer.byteLength('/* 한글😀 */ '));
  assert.ok(!JSON.stringify(result).includes('function make'));
});

test('지문/길이/취소는 parser 호출 전 거절하고 원 예외를 반환하지 않는다', () => {
  let calls = 0;
  const port = { parse() { calls++; throw new Error('secret/path'); } };
  const original = input();
  assert.equal(read(source, { parser: port, expected: { ...original.expected, sha256: '0'.repeat(64) } }).code, 'SOURCE_BINDING');
  assert.equal(read(source, { parser: port, expected: { ...original.expected, byteLength: 1 } }).code, 'SOURCE_BINDING');
  const abort = new AbortController(); abort.abort();
  assert.equal(read(source, { parser: port, signal: abort.signal }).code, 'CANCELLED');
  assert.equal(calls, 0);
  const failure = read(source, { parser: port });
  assert.equal(failure.code, 'PARSE_UNKNOWN');
  assert.ok(!JSON.stringify(failure).includes('secret'));
});

test('중간 절단·비연속 조각·누락·중복 노드는 완전한 선언으로 승격하지 않는다', () => {
  const { expected } = input();
  for (const units of [[], [{ role: 'TRANSPORT', lo: expected.units[0].lo + 1, hi: expected.byteLength }], [expected.units[0], expected.units[0]], [{ ...expected.units[0], hi: expected.byteLength - 1 }]]) {
    assert.equal(read(source, { expected: { ...expected, units } }).status, 'UNKNOWN');
  }
});

test('가림·변경·계산키·알 수 없는 호출은 위치만 남기고 자동 해석하지 않는다', () => {
  const text = 'function make(options){let args=[];function inner(options){return options.model;}args=unknown(options);env[options.secret]="private-value";return hook(args);}';
  const result = read(text);
  assert.equal(result.recipeEligible, false);
  for (const code of ['NESTED_SCOPE', 'MUTATION', 'COMPUTED_MEMBER', 'CALL_BINDING']) assert.ok(result.unconfirmed.some(x => x.code === code), code);
  const serialized = JSON.stringify(result);
  for (const hidden of ['private-value', 'unknown', 'inner', 'secret']) assert.ok(!serialized.includes(hidden));
});

test('실행 문법은 실행하지 않고 raw 문자열·알 수 없는 환경키/argv는 출력하지 않는다', () => {
  const text = 'function make(options){globalThis.__fn07Executed=true;const args=["/private/file","--model"];env.SECRET_TOKEN="never-output";return hook(args);}';
  const result = read(text);
  assert.equal(globalThis.__fn07Executed, undefined);
  assert.ok(result.unconfirmed.some(x => x.code === 'UNRECOGNIZED_LITERAL'));
  for (const value of ['/private/file', 'SECRET_TOKEN', 'never-output']) assert.ok(!JSON.stringify(result).includes(value));
});

test('전체 출력/노드 상한은 부분 결과 없이 UNKNOWN이고 SDK 원문은 보관하지 않는다', () => {
  assert.equal(read(source, { limits: { outputBytes: 256 } }).code, 'OUTPUT_LIMIT');
  assert.equal(read(source, { limits: { nodes: 4 } }).code, 'AST_LIMIT');
  const bad = Buffer.from([0xff]);
  assert.equal(read(source, { bytes: bad, expected: { sha256: sha(bad), byteLength: 1, units: [{ role: 'TRANSPORT', lo: 0, hi: 1 }] } }).code, 'SOURCE_ENCODING');
});

test('parser 뒤 취소·Promise·잘못된 AST는 조용한 UNKNOWN이며 AST 원문은 반환하지 않는다', () => {
  const abort = new AbortController();
  assert.equal(read(source, { signal: abort.signal, parser: { parse(text, options) { const ast = parser.parse(text, options); abort.abort(); return ast; } } }).code, 'CANCELLED');
  assert.equal(read(source, { parser: { parse() { return Promise.resolve({}); } } }).code, 'PARSER_ABI');
  assert.equal(read(source, { parser: { parse() { return {}; } } }).code, 'AST_INVALID');
});

test('배열/push 순서·옵션 별칭·환경 rename과 DEBUG/추적 분기 종류를 구문으로 보존한다', () => {
  const text = 'function make(options){const {model:m,sessionId:s}=options;const args=["--model",m];args.push("--session-id",s);if(env.DEBUG_CLAUDE_AGENT_SDK){env.DEBUG=env.DEBUG_CLAUDE_AGENT_SDK;}else{delete env.DEBUG;}if(typeof env.TRACEPARENT==="string"){delete env.TRACESTATE;}return hook({args,env});}';
  const result = read(text);
  const array = result.facts.find(x => x.kind === 'ARGV_ARRAY_CANDIDATE');
  const push = result.facts.find(x => x.kind === 'ARGV_PUSH_CANDIDATE');
  assert.equal(array.elements[0].token, '--model');
  assert.equal(push.elements[0].token, '--session-id');
  assert.ok(array.lo < push.lo);
  const bindings = result.facts.filter(x => x.kind === 'OPTION_BINDING');
  assert.deepEqual(bindings.map(x => x.option), ['model', 'sessionId']);
  assert.equal(array.elements[1].sha256, bindings[0].binding.sha256);
  const rename = result.facts.find(x => x.kind === 'ENV_WRITE');
  assert.equal(rename.source.kind, 'ENV_MEMBER');
  assert.equal(rename.source.key, 'DEBUG_CLAUDE_AGENT_SDK');
  assert.equal(rename.operator, '=');
  assert.equal(rename.conditions[0].kind, 'MEMBER');
  assert.equal(rename.conditions[0].arm, 'THEN');
  const deletion = result.facts.find(x => x.kind === 'ENV_DELETE' && x.key === 'DEBUG');
  assert.equal(deletion.conditions[0].arm, 'ELSE');
  const trace = result.facts.find(x => x.kind === 'ENV_DELETE' && x.key === 'TRACESTATE');
  assert.equal(trace.conditions[0].operator, '===');
  assert.equal(result.bindingIdentity, 'UNCONFIRMED');
});

test('새 고정 플래그는 배열/push literal에서만 공개하며 실제 확인된 환경키만 구별한다', () => {
  const text = 'function make(options){const unrelated="--not-an-argument";const args=["--new-fixed-flag","private-value"];args.push("--another-flag");env.CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH="1";env.CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH="1";env.CLAUDE_SECURESTORAGE_CONFIG_DIR=options.cwd;return hook(args);}';
  const result = read(text);
  const output = JSON.stringify(result);
  assert.ok(output.includes('--new-fixed-flag') && output.includes('--another-flag'));
  assert.ok(!output.includes('--not-an-argument') && !output.includes('private-value'));
  assert.deepEqual(result.facts.filter(x => x.kind === 'ENV_WRITE').map(x => x.key), ['CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH', 'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH', 'CLAUDE_SECURESTORAGE_CONFIG_DIR']);
});

test('공개 anchor를 포함하는 단 하나의 initialize 전체 AST 경계만 확장 반환한다', () => {
  const text = 'class Transport { initialize(){const args=["--model"];return hook(args);} other(){} }';
  const bytes = Buffer.from(text), lo = text.indexOf('const args'), hi = text.indexOf('return hook') + 'return hook(args);'.length;
  const expected = { sha256: sha(bytes), byteLength: bytes.length, units: [{ role: 'TRANSPORT', anchor: { lo, hi } }] };
  const result = inspectFixedImageSource({ bytes, expected, parser });
  assert.equal(result.status, 'EXTRACTED');
  assert.equal(result.units[0].lo, text.indexOf('initialize'));
  assert.equal(result.units[0].hi, text.indexOf(' other()'));
  assert.deepEqual(result.units[0].anchor, { lo, hi });
  assert.equal(result.bindingIdentity, 'UNCONFIRMED');
  assert.equal(inspectFixedImageSource({ bytes, parser, expected: { ...expected, units: [{ role: 'TRANSPORT', anchor: { lo: 0, hi: bytes.length } }] } }).code, 'INCOMPLETE_NODE');
  const nested = 'class Outer{initialize(){class Inner{initialize(){return hook();}}}}';
  const nestedBytes = Buffer.from(nested), anchor = { lo: nested.indexOf('return hook'), hi: nested.indexOf('return hook') + 'return hook();'.length };
  assert.equal(inspectFixedImageSource({ bytes: nestedBytes, parser, expected: { sha256: sha(nestedBytes), byteLength: nestedBytes.length, units: [{ role: 'TRANSPORT', anchor }] } }).code, 'RANGE_AMBIGUOUS');
});

test('독립 복사본의 지문을 검산하고 parser 중 원 backing 변경이 결과를 바꾸지 않는다', () => {
  const original = input();
  const digest = original.expected.sha256;
  const result = inspectFixedImageSource({ ...original, parser: { parse(text, options) { original.bytes.fill(0); return parser.parse(text, options); } } });
  assert.equal(result.status, 'EXTRACTED');
  assert.equal(result.source.sha256, digest);
  assert.equal(result.units[0].hi, Buffer.byteLength(source));
});

test('루프/예외 경로는 무조건 인수로 해석하지 않고 env의 임의 flag 값도 숨긴다', () => {
  const result = read('function make(options){while(options.model){args.push("--model");}try{env.DEBUG="--private-value";}catch(e){delete env.DEBUG;}return hook(args);}');
  assert.equal(result.facts.find(x => x.kind === 'ARGV_PUSH_CANDIDATE').conditions[0].kind, 'LOOP_UNCONFIRMED');
  assert.equal(result.facts.find(x => x.kind === 'ENV_DELETE').conditions[0].arm, 'CATCH');
  assert.ok(!JSON.stringify(result).includes('--private-value'));
});
