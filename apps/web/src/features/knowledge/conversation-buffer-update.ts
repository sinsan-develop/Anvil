import type { ConversationBuffer } from './conversation-api.ts';

/** 화면별 callback이 포착한 작성 ID를 비교한다. 종료·새 작성·확인된 성공을 늦은 응답으로 되돌리지 않는다. */
export function mergeConversationBuffer(projectId: string, expectedBindingId: string | null, current: ConversationBuffer | null, next: ConversationBuffer | null): ConversationBuffer | null {
 if ((current?.bindingId ?? null) !== expectedBindingId) return current;
 if (next === null) return null; // 확인·닫기 가능 여부는 기존 작성 UI가 검사한다.
 if (next.projectId !== projectId || typeof next.bindingId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(next.bindingId)) return current;
 if (!current) return !next.pending && !next.result && !next.failure ? next : current;
 if (current.bindingId !== next.bindingId || current.projectId !== next.projectId || current.ownerUserId !== next.ownerUserId || current.ownerClientId !== next.ownerClientId || current.controlGeneration !== next.controlGeneration) return current;
 if (current.result) return current;
 if (current.pending) {
  if (!next.pending) return next.result ? next : current;
  if (current.pending.upload.commandId !== next.pending.upload.commandId || current.pending.appendId !== next.pending.appendId || current.pending.append && !next.pending.append) return current;
 } else {
  if (next.result) return current;
  if (next.pending && (current.body !== next.body || current.kind !== next.kind || current.conversationId !== next.conversationId || current.headSequence !== next.headSequence || JSON.stringify(current.supersedesInstructionRef) !== JSON.stringify(next.supersedesInstructionRef))) return current;
 }
 return next;
}
