import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { newConversation, prepareConversation } from '../../../apps/web/src/features/knowledge/conversation-api.ts';
const file = new URL('../../../apps/web/src/features/knowledge/conversation-buffer-update.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
const pid = '11111111-1111-4111-8111-111111111111', uid = '22222222-2222-4222-8222-222222222222';
const session = { user: { id: uid }, clientId: uid, csrfToken: 'C'.repeat(43) };
async function prepared() { const b: any = newConversation(pid, session, 1); b.body = '사용자 소유 프로젝트'; b.pending = await prepareConversation(b, session); return b; }
const update = (...args: any[]) => { assert.equal(typeof module.mergeConversationBuffer, 'function'); return module.mergeConversationBuffer(...args); };
const result = { conversationId: pid, serverSequence: 1, sourceRef: { kind: 'CONVERSATION', id: uid, contentHash: 'a'.repeat(64) } };
test('같은 작성의 성공 뒤 이전 화면 pending·실패는 상태를 되돌리지 않는다', async () => {
 const old = await prepared(), success = { ...old, pending: null, result, dirty: false, uncertain: false };
 const late = { ...old, failure: { code: 'CONVERSATION_CONTINUATION_PAUSED', status: 0 } };
 assert.equal(update(pid, old.bindingId, success, late), success);
 assert.equal(update(pid, old.bindingId, old, success).result.serverSequence, 1);
});
test('종료된 작업이나 새 작성·다른 주체/프로젝트를 이전 callback이 되살리거나 덮지 않는다', async () => {
 const old = await prepared(), fresh: any = newConversation(pid, session, 1); fresh.body = '새 입력';
 assert.notEqual(old.bindingId, fresh.bindingId);
 assert.equal(update(pid, old.bindingId, null, old), null);
 assert.equal(update(pid, old.bindingId, fresh, old), fresh);
 assert.equal(update(pid, old.bindingId, fresh, null), fresh);
 assert.equal(update(pid, fresh.bindingId, fresh, { ...fresh, projectId: uid }), fresh);
 assert.equal(update(pid, fresh.bindingId, fresh, { ...fresh, ownerClientId: pid }), fresh);
 assert.equal(update(pid, null, null, fresh), fresh);
});
test('append checkpoint는 upload 상태로 후퇴하지 않고 다른 명령/바뀐 입력도 채택하지 않는다', async () => {
 const old = await prepared(), progress = { ...old, pending: { ...old.pending, append: { ...old.pending.upload, commandId: old.pending.appendId } } };
 assert.equal(update(pid, old.bindingId, progress, old), progress);
 const other = { ...old, pending: { ...old.pending, appendId: crypto.randomUUID() } };
 assert.equal(update(pid, old.bindingId, old, other), old);
 const edited = { ...old, pending: null, body: '새로 고친 원문' };
 assert.equal(update(pid, old.bindingId, edited, old), edited);
 assert.equal(update(pid, old.bindingId, old, { ...old, pending: null, result: null }), old);
});
