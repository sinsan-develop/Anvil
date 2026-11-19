'use strict';

// 순수 구문 판독: 고정 parser의 로드/지문과 실제 조회 감독은 호출자의 별도 책임이다.
// 허용 문자열도 SDK 의미/어휘 결박이 아닌 구문 관측이다. 실행·recipe 발행은 하지 않는다.
const { createHash } = require('node:crypto');
const { types } = require('node:util');
const CAP = Object.freeze({ sourceBytes: 2 * 1024 * 1024, nodes: 200000, depth: 256, facts: 512, outputBytes: 65536 });
const ROLES = new Set(['QUERY', 'OPTIONS', 'TRANSPORT', 'TM', 'SS', 'oye', 'be']);
const OPTIONS = new Set(['prompt', 'options', 'model', 'sessionId', 'cwd', 'env', 'executable', 'executableArgs', 'pathToClaudeCodeExecutable', 'spawnClaudeCodeProcess', 'canUseTool', 'abortController', 'maxTurns', 'maxBudgetUsd', 'resume', 'continue', 'sessionStore', 'extraArgs', 'enableFileCheckpointing', 'debug', 'debugFile']);
const ENV = new Set(['CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING', 'CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH', 'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH', 'CLAUDE_CODE_QUESTION_PREVIEW_FORMAT', 'CLAUDE_CONFIG_DIR', 'CLAUDE_SECURESTORAGE_CONFIG_DIR', 'TRACEPARENT', 'TRACESTATE', 'NODE_OPTIONS', 'DEBUG', 'DEBUG_CLAUDE_AGENT_SDK']);
const TOKENS = new Set(['--model', '--session-id', '--input-format', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-prompt-tool', 'stdio', '--max-turns', '--max-budget-usd', '--resume', '--continue']);
const VALUES = new Set(['sdk-ts', '0.3.224']);
const OPERATORS = new Set(['=', '+=', '||=', '&&=', '??=', '===', '!==', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '??', '!', 'typeof', 'void', 'delete']);
const flag = value => typeof value === 'string' && /^--[a-z][a-z0-9-]{0,79}$/.test(value);
const SKIP = new Set(['loc', 'range', 'extra', 'tokens', 'errors', 'comments', 'leadingComments', 'trailingComments', 'innerComments']);
const COMPLETE = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression', 'ClassMethod', 'ObjectMethod']);
const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const failure = code => ({ status: 'UNKNOWN', code, interpretation: 'UNCONFIRMED', recipeEligible: false });
class Rejection extends Error { constructor(code) { super(); this.code = code; } }
const reject = code => { throw new Rejection(code); };

function inspectFixedImageSource(input) {
  try { return inspect(input); } catch (error) { return failure(error instanceof Rejection ? error.code : 'INPUT_OR_AST_UNKNOWN'); }
}

function inspect({ bytes, expected, parser, signal, limits = {} }) {
  function check() {
    if (signal !== undefined) {
      if (types.isProxy(signal)) reject('INPUT_INVALID');
      try { if (aborted.call(signal)) reject('CANCELLED'); } catch (error) { if (error instanceof Rejection) throw error; reject('INPUT_INVALID'); }
    }
  }
  check();
  const caps = { ...CAP };
  for (const [name, value] of Object.entries(limits)) {
    if (!(name in CAP) || !Number.isSafeInteger(value) || value < 1 || value > CAP[name]) reject('LIMIT_INVALID');
    caps[name] = value;
  }
  if (!Buffer.isBuffer(bytes) || types.isProxy(bytes) || bytes.length > caps.sourceBytes || !expected || !/^[0-9a-f]{64}$/.test(expected.sha256) || bytes.length !== expected.byteLength) reject('SOURCE_BINDING');
  // 원 입력은 변경하지 않고 parser 호출 중 변경에도 결박을 유지하는 복사본만 읽는다.
  const owned = Buffer.from(bytes);
  try {
    if (owned.length !== expected.byteLength || hash(owned) !== expected.sha256) reject('SOURCE_BINDING');
    check();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(owned); } catch { reject('SOURCE_ENCODING'); }
    if (!Array.isArray(expected.units) || expected.units.length === 0 || expected.units.length > ROLES.size) reject('RANGE_INVALID');
    const roles = new Set(); let previous = -1;
    const units = expected.units.map(unit => {
      const bounds = unit?.anchor ?? unit;
      if (!unit || !ROLES.has(unit.role) || roles.has(unit.role) || (unit.anchor && (unit.role !== 'TRANSPORT' || unit.lo !== undefined || unit.hi !== undefined)) || !Number.isSafeInteger(bounds.lo) || !Number.isSafeInteger(bounds.hi) || bounds.lo < 0 || bounds.hi <= bounds.lo || bounds.hi > owned.length || bounds.lo < previous) reject('RANGE_INVALID');
      roles.add(unit.role); previous = bounds.hi;
      return unit.anchor ? { role: unit.role, anchor: { lo: bounds.lo, hi: bounds.hi } } : { role: unit.role, lo: unit.lo, hi: unit.hi };
    });
    if (!parser || typeof parser.parse !== 'function') reject('PARSER_ABI');
    let ast;
    try { ast = parser.parse(text, { filepath: 'sdk.mjs' }); } catch { check(); reject('PARSE_UNKNOWN'); }
    check();
    if (types.isPromise(ast)) reject('PARSER_ABI');
    const root = ast?.type === 'File' ? ast.program : ast;
    if (!root || root.type !== 'Program' || !Array.isArray(root.body)) reject('AST_INVALID');
    // Babel 위치는 UTF16이다. 서로게이트 중간을 거절하고 UTF8 반열림 구간으로 변환한다.
    const offsets = new Int32Array(text.length + 1); offsets.fill(-1);
    let byte = 0;
    for (let at = 0; at < text.length;) {
      offsets[at] = byte; const cp = text.codePointAt(at); const width = cp > 65535 ? 2 : 1;
      byte += Buffer.byteLength(text.slice(at, at + width)); at += width;
    }
    offsets[text.length] = byte;
    function location(node) {
      if (!Number.isSafeInteger(node.start) || !Number.isSafeInteger(node.end) || node.start < 0 || node.end <= node.start || node.end > text.length || offsets[node.start] < 0 || offsets[node.end] < 0) reject('AST_INVALID');
      const lo = offsets[node.start], hi = offsets[node.end];
      return { lo, hi, sha256: hash(owned.subarray(lo, hi)) };
    }
    let count = 0;
    function walk(node, visit, depth = 0, conditions = [], parent = null) {
      if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
      check(); if (++count > caps.nodes || depth > caps.depth) reject('AST_LIMIT');
      location(node); visit(node, conditions, parent);
      for (const [key, value] of Object.entries(node)) {
        if (SKIP.has(key)) continue;
        let next = conditions;
        if ((node.type === 'IfStatement' || node.type === 'ConditionalExpression') && (key === 'consequent' || key === 'alternate')) next = [...conditions, condition(node.test, key === 'consequent' ? 'THEN' : 'ELSE')];
        if (node.type === 'LogicalExpression' && key === 'right') next = [...conditions, condition(node.left, node.operator === '&&' ? 'TRUTHY' : node.operator === '||' ? 'FALSY' : 'NULLISH')];
        if (['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(node.type) && key === 'body') next = [...conditions, { ...location(node), kind: 'LOOP_UNCONFIRMED', arm: 'BODY', operator: null }];
        if (node.type === 'SwitchCase' && key === 'consequent') next = [...conditions, { ...location(node), kind: 'SWITCH_UNCONFIRMED', arm: 'CASE', operator: null }];
        if (node.type === 'TryStatement' && ['block', 'handler', 'finalizer'].includes(key)) next = [...conditions, { ...location(node), kind: 'EXCEPTION_FLOW_UNCONFIRMED', arm: key === 'block' ? 'TRY' : key === 'handler' ? 'CATCH' : 'FINALLY', operator: null }];
        if (Array.isArray(value)) { for (const child of value) walk(child, visit, depth + 1, next, node); }
        else if (value && typeof value === 'object') walk(value, visit, depth + 1, next, node);
      }
    }
    function condition(node, arm) {
      const kind = ({ BinaryExpression: 'COMPARISON', LogicalExpression: 'LOGICAL', UnaryExpression: 'UNARY', MemberExpression: 'MEMBER', Identifier: 'IDENTIFIER', CallExpression: 'CALL' })[node.type] || 'UNSUPPORTED';
      return { ...location(node), kind, arm, operator: OPERATORS.has(node.operator) ? node.operator : null };
    }
    const selected = new Map();
    walk(root, node => {
      if (!COMPLETE.has(node.type)) return;
      const loc = location(node);
      for (const unit of units) if (unit.anchor ? node.type === 'ClassMethod' && !node.computed && node.key?.type === 'Identifier' && node.key.name === 'initialize' && loc.lo <= unit.anchor.lo && loc.hi >= unit.anchor.hi : loc.lo === unit.lo && loc.hi === unit.hi) {
        if (selected.has(unit.role)) reject('RANGE_AMBIGUOUS');
        selected.set(unit.role, node);
      }
    });
    if (selected.size !== units.length) reject('INCOMPLETE_NODE');
    for (const unit of units) {
      const loc = location(selected.get(unit.role));
      unit.lo = loc.lo; unit.hi = loc.hi;
    }
    for (let i = 1; i < units.length; i++) if (units[i].lo < units[i - 1].hi) reject('RANGE_INVALID');
    const facts = [], unconfirmed = [];
    function add(list, item) { if (facts.length + unconfirmed.length >= caps.facts) reject('FACT_LIMIT'); list.push(item); }
    const issue = (code, node, role) => add(unconfirmed, { code, role, ...location(node) });
    function memberKey(node) {
      if (node?.type !== 'MemberExpression' && node?.type !== 'OptionalMemberExpression') return null;
      if (!node.computed && node.property.type === 'Identifier') return node.property.name;
      if (node.computed && node.property.type === 'StringLiteral') return node.property.value;
      return null;
    }
    function atom(node, allowToken = false) {
      if (!node) return { kind: 'UNKNOWN' };
      if (allowToken && node.type === 'StringLiteral' && (TOKENS.has(node.value) || flag(node.value))) return { kind: 'TOKEN', token: node.value, ...location(node) };
      const option = memberKey(node);
      if (OPTIONS.has(option)) return { kind: 'OPTION_MEMBER', option, ...location(node) };
      if (ENV.has(option)) return { kind: 'ENV_MEMBER', key: option, ...location(node) };
      return { kind: 'UNCONFIRMED', ...location(node) };
    }
    for (const unit of units) {
      const selectedNode = selected.get(unit.role);
      const emit = (node, conditions, item) => add(facts, { ...item, role: unit.role, ...location(node), conditions });
      walk(selectedNode, (node, conditions, parent) => {
        if (COMPLETE.has(node.type) && node !== selectedNode) issue('NESTED_SCOPE', node, unit.role);
        const inArgs = parent?.type === 'ArrayExpression' || (parent?.type === 'CallExpression' && memberKey(parent.callee) === 'push' && parent.arguments.includes(node));
        if (node.type === 'StringLiteral' && inArgs && (TOKENS.has(node.value) || flag(node.value))) emit(node, conditions, { kind: 'ARGV_TOKEN', token: node.value });
        else if (node.type === 'StringLiteral' && !VALUES.has(node.value) && !ENV.has(node.value) && !OPTIONS.has(node.value)) issue('UNRECOGNIZED_LITERAL', node, unit.role);
        if (node.type === 'ObjectProperty' && parent?.type === 'ObjectPattern') {
          const option = !node.computed && node.key.type === 'Identifier' ? node.key.name : node.key.type === 'StringLiteral' ? node.key.value : null;
          if (OPTIONS.has(option)) emit(node, conditions, { kind: 'OPTION_BINDING', option, binding: location(node.value.type === 'AssignmentPattern' ? node.value.left : node.value), defaultValue: node.value.type === 'AssignmentPattern' ? location(node.value.right) : null });
          else issue('UNRECOGNIZED_BINDING', node, unit.role);
        }
        if (node.type === 'ArrayExpression') emit(node, conditions, { kind: 'ARGV_ARRAY_CANDIDATE', elements: node.elements.map(value => atom(value, true)) });
        if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression' || node.type === 'NewExpression') {
          issue('CALL_BINDING', node, unit.role);
          if (memberKey(node.callee) === 'push') emit(node, conditions, { kind: 'ARGV_PUSH_CANDIDATE', receiver: location(node.callee.object), elements: node.arguments.map(value => atom(value, true)) });
        }
        const key = memberKey(node);
        if (OPTIONS.has(key)) emit(node, conditions, { kind: 'OPTION_READ', option: key, receiver: location(node.object) });
        if (ENV.has(key)) emit(node, conditions, { kind: 'ENV_MEMBER', key, receiver: location(node.object) });
        if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && node.computed && node.property.type !== 'StringLiteral') issue('COMPUTED_MEMBER', node, unit.role);
        if (node.type === 'AssignmentExpression') {
          const target = memberKey(node.left);
          if (ENV.has(target)) {
            const value = node.right.type === 'StringLiteral' && VALUES.has(node.right.value) ? node.right.value : null;
            emit(node, conditions, { kind: 'ENV_WRITE', key: target, value, operator: OPERATORS.has(node.operator) ? node.operator : null, receiver: location(node.left.object), source: atom(node.right) });
          }
          issue('MUTATION', node, unit.role);
        }
        if (node.type === 'UpdateExpression' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') issue('MUTATION', node, unit.role);
        if (node.type === 'SpreadElement') issue('SPREAD_SOURCE', node, unit.role);
        if (node.type === 'UnaryExpression' && node.operator === 'delete') {
          const target = memberKey(node.argument);
          if (ENV.has(target)) emit(node, conditions, { kind: 'ENV_DELETE', key: target, receiver: location(node.argument.object) });
          else issue('DELETE_TARGET', node, unit.role);
        }
      });
    }
    check();
    const result = { status: 'EXTRACTED', coverage: 'SELECTED_NODE_SYNTAX_ONLY', interpretation: 'UNCONFIRMED', bindingIdentity: 'UNCONFIRMED', recipeEligible: false, source: { sha256: hash(owned), byteLength: owned.length }, units, facts, unconfirmed };
    if (Buffer.byteLength(JSON.stringify(result)) > caps.outputBytes) reject('OUTPUT_LIMIT');
    check(); return result;
  } finally { owned.fill(0); }
}

module.exports = Object.freeze({ inspectFixedImageSource });
