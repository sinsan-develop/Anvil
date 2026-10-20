# FN03 연결 해제 일회 승인 연결 실행계획

## 근거·범위

2026-10-21 신산님 Main 대화의 직접 “계속하자”(turn 01a15b93-8075-7dd1-9300-8107d710404a, message 01a15b93-82a6-7091-a59f-916212725fa9)를 직전 한정 제안에 적용한다. PMO가 원대화와 해석 충돌 부재를 확인했다. 기준 ab493ee5, 기존 FN03 §15.4/FN11 §10.1에 detachDocumentSource 한 연산만 확장한다. 이전 거절/질문·공유B/r2를 해제하지 않는다.

실제 DB/SQL 적용·실제 정책 부여·서비스·계정/Secret·Agent/비용은 제외한다. 새 SQL은 미적용 forward 파일이며 가짜DB/transport/in-process 검증과 실제 PG/사용자 기능을 구분한다. 기존 SQL·원문/파일·이력은 수정/삭제하지 않는다.

## 정확한 계약

- 기존 requestApproval/decideApproval/commands/approvals endpoint와 ApprovalDetails/ApprovalRef envelope를 그대로 사용한다. 새 지원 연산만 detachDocumentSource다.
- 승인 대상 targetRef는 sourceLinkRef의 id/version1/contentHash 전체다. expectedVersion1·candidateCommandId·payloadHash({sourceLinkRef,reason})·project/user/client/controlGeneration·현재 policyRef·기한을 결박한다. 임의 다른 target/ref/hash·다른 project·만료·거절/수정·현정책/세대 변경은 재사용하지 않는다.
- 요청 생성은 현재 OWNER·단독 제어·별도 requestApproval AUTO 및 detach REQUIRE_APPROVAL(유효 DENY 우선), 현재 ACTIVE v1 링크/원문 귀속을 검사한다. 범위/판단 자유문장으로 권위를 만들지 않는다. 요청 자체에는 원문/비밀/파일 바이트를 넣지 않는다.
- 결정은 기존 지정 HUMAN/현재 client/세대·기한·정확 요청/범위/version의 일회 판단을 그대로 사용한다. 결정만으로 분리하지 않는다.
- 승인 결박은 원래 미전송 분리 command를 보존하고 approvalRef만 추가한다. commandId·target·payload·세대는 바꾸지 않는다. 전송 여부/결과가 불명확한 AUTO 명령에 사후 승인을 붙여 동일 ID의 다른 요청으로 만들지 않는다.
- 전송 시 기존 정책/제어·정확 링크를 다시 잠그고 유효 APPROVE·범위/대상·현재 정책·기한을 대조한다. 소비·command/receipt·audit·DETACHED event/head가 같은 transaction으로 모두 저장되거나 모두 실패한다. DB 예외를 성공으로 숨기지 않는다.
- 같은 최종 command replay는 기존 receipt만 회수하고 소비/event/audit를 재생성하지 않는다. 다른 command·다른 payload·다른 scope·같은 approval의 중복 소비는 거절한다. 새 승인으로 기존 DENY/상위 금지를 해제하지 않는다.
- 미승인 AUTO는 기존 승인참조 null 동작 유지, REQUIRE_APPROVAL 없을 때 approvalRef 임의 첨부는 거절한다. 새 LINKED/본문관측·MATCH/파일 변경은 열지 않는다.
- UI06 준비→UI08 위험5종/복구/한계·기한 입력→요청·결정→정확 원명령 결박→UI06 별도전송→receipt/별도 목록 재조회다. 다른 프로젝트/사용자의 준비는 숨겨 보존하고 유실은 같은 명령 재확인만 한다.

## 실행 단위·완료조건

1. 서버/저장 소비: approvals/project-approvals.ts·approval-input.ts, access/project-command.ts, documents/project-source-links.ts와 새로운 0033_document_source_detach_approval.sql. 현 target 잠금·정확 scope와 command/ref·한번소비/replay·양방향 event/head/receipt/consumption 보호를 연결한다. 기존 migration checksum은 유지한다. fakeDB/실제 함수의 정상·중요 음성·원래 AUTO/DENY를 검수하고 SQL 실제 컴파일/COMMIT/경합은 미실행으로 기록한다.
2. 화면 소비: design-trace/source-detach-api.ts·SourceDetachEditor.tsx, decisions/api.ts·ApprovalsPage.tsx, App.tsx의 기존 scope buffer. 새 후보 유형을 기존 입력과 분리하고 바인딩/미확인/늦은응답·exact receipt·별도재조회를 검수한다. 실제 Agent/서비스 사용 가능 판정은 하지 않는다.
3. 한정 독립 검토·타입/빌드·직접 회귀·가짜 API DOM, 등록된 일회 QA만 회수/잔여0, 소유 파일만 commit/private exact SHA. 전체 Stage/실제 사용자 여정 완료로 승격하지 않는다.

## 현재 상태

서버·미적용 forward SQL·화면 소비를 구현하고 직접 단위/가짜 API DOM·type/build·한정 독립 발견을 보완했다. 최신 검수·잔여 판정은 WORK_STATUS를 따른다. 실제 DB 적용/COMMIT·권한·서비스·사용자 기능 인수는 미실행이며 전체 FN03/FN11은 부분이다. 원문/파일/과거 SQL은 보존한다.
