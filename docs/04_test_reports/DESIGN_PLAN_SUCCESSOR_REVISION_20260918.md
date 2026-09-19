# 설계·개발 작업계획 successor 개정 완료보고

## 판정

`DOCUMENT_SUCCESSOR_ACCEPTED / C0 / I0 / M1` — 제품 코드는 변경하지 않고 설계서 v2.8 및 작업계획서 v1.7 successor를 append-only로 추가했다. 1차 독립 검토의 I1(traceability)/I2(mockup evidence) 지적을 반영해 통합검증매트릭스·테스트계획서·progress status·HANDOFF에 예약 매핑과 C-28 READY 조건을 추가했고, 독립 read-only 재검토에서 C0/I0을 확인했다. M1은 의도된 후속 조건이다.

## 기준선과 보호 범위

- 저장소: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- HEAD: `98e218264bf54db04a1bd35a67273b713805a649`
- 기존 modified/untracked progress·report·work-order·package·test 자료는 모두 보존했다. reset/clean/stash/delete/bulk-stage를 수행하지 않았다.
- 변경 문서: `Anvil_설계서_v2.md`, `Anvil_작업계획서_v1.md`, `docs/WORK_STATUS.md`, 본 보고서
- 제품 경로(`apps/`, `packages/`, `migrations/`, 제품 테스트)는 이번 문서 작업에서 수정하지 않았다. 기존 보호 대상 `tests/tooling/test_project_progress.py`의 선행 dirty 상태는 그대로다.

## 반영 내용

1. 설계서 v2.8: 개발 오케스트레이션 제품 정체성, Planning/Code/Review/Test/Deploy 다섯 역할의 입출력·허용/금지·handoff·오류·완료증거·승인경계, Main Agent와 단일 Code writer 경계.
2. Agent Team과 Agent MoA를 분리하고 Provider/Model Capability Routing과의 연결·provenance·quorum/conflict·timeout/cost·partial failure·최종 owner를 명시.
3. transport-neutral SNS Gateway/`SNSMessageEnvelope`, Telegram 보존, Kakao 외부계약 OPEN_DECISION, Daon User identity/role/session/command/result 및 고위험 Web Console 재확인.
4. Team/MoA/SNS/Daon User 화면·메뉴와 요구사항→계획→구현→검토→테스트→배포준비 trace, mockup·사용자 확인 선행.
5. 작업계획서 v1.7: 기존 C-16~C-21·F-01/F-02 historical 보존·매핑과 successor C-22~C-30(역할, Team, MoA/routing, SNS/Daon, Telegram, Kakao, 화면, common→API→menu, local→WSL E2E) 및 각 패키지의 prerequisite/artifact/path/RED-GREEN/evidence/completion/unverified/rollback 요구.
6. Oracle 설치·배포·운영·release는 개발 계획 밖의 별도 운영계획으로 명시.

## 검증

- 문서 successor 계약 검사: `PASS docs successor contract; packages=C-22,C-23,C-24,C-25,C-26,C-27,C-28,C-29,C-30`
- `git diff --check`: PASS
- traceability overlay: `DESIGN-51.x ↔ C-22..C-30 ↔ ROLE-CONTRACT/TEAM-MOA/SNS-DAON/UI-TRACE/WSL-E2E` 연결 문서 4종에 반영
- 제품 테스트/DB/WSL/Provider/SNS 외부 호출/브라우저/Oracle: `NOT_EXECUTED` (문서 범위 밖)

## 미결정·다음 조건

- Kakao 공식 API·채널 유형·서명/토큰·식별자·quota·운영 계정은 외부 확인 전 구현하지 않는다.
- Daon User의 실제 API/role/auth 계약과 matrix/test-plan/progress/HANDOFF/approval binding successor 정합화가 남아 있다.
- 다음 구현은 신산님 문서·mockup 확인, successor 정합화, C-22 WorkInstruction hash, 단일 Code Agent write lease가 모두 충족된 뒤 시작한다.

독립 검토: `ACCEPT / C0 / I0 / M1`. 실제 AV ID/build-progress event는 C-22 WorkInstruction·approval binding 시 발행하며, C-28 mockup/user-confirm evidence와 Kakao/Daon User 계약은 후속 조건이다.

## Rollback

문서 successor만 이전 commit으로 되돌릴 수 있으며, historical Event/Gate/Acceptance와 사용자 dirty/untracked 자료는 복원·삭제하지 않는다.
