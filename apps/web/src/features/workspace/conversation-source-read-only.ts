import {createElement as h} from 'react';
import type {ConversationView} from '../knowledge/conversation-api.ts';
/** 기존 readConversationMessage의 정확 대화/출처·본문 hash 검사 후 표시한다. */
export function ConversationSourceReadOnly({source}:{source:ConversationView}){
 const previous=source.message.supersedesInstructionRef;
 return h('section',{'aria-label':'선택한 사용자 원문'},h('h5',null,source.message.kind==='USER_INSTRUCTION'?'사용자 지시 원문':'사용자 발언 원문'),
  h('p',null,`서버 순번 ${source.serverSequence} · 보관됨(STORED) · ${source.recordedAt}`),
  h('p',{className:'meta'},`대화 ${source.conversationId} · 작성자 ${source.authorRef.userId}`),
  h('p',{className:'meta'},`출처 ${source.sourceRef.id} · ${source.sourceRef.contentHash}`),
  h('pre',{'aria-label':'사용자 발언 원문'},source.body),
  h('p',null,previous?`정정 대상 ${previous.id} · ${previous.contentHash}`:'이 원문에 기록된 정정 대상 없음'),
  h('p',{className:'meta'},'현재 유효한 지시 선별·임무 맥락 편입은 미판정. Agent 전달·수신·이해 확인이 아닙니다.'));
}
