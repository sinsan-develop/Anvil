# Agent Teams·Capability MoA·대화형 설계 변경 상태

- 기록일: 2026-08-22
- 상태: `DESIGN_SUCCESSOR_DRAFT_PENDING_ALIGNMENT`
- 설계 successor: `Anvil_설계서_v2.md` v2.7
- 계획 successor: `Anvil_작업계획서_v1.md` v1.6
- 기준 커밋: `8e9c196`

## 반영 내용

- Agent Teams: Leader/Teammate 직접 대화, 공유 작업목록, dependency, mailbox, peer review, 중단·복구
- Capability MoA: 기능별 LLM Provider/Model routing, fallback, benchmark, provenance
- Conversation-Driven Design: 사용자↔Agent·Agent↔Agent 대화, iteration, DecisionRequest, ApprovalRecord
- 최상위 순서: 설계 → 화면 → 공통 모듈 → API → 메뉴 기능 → 테스트 → 매뉴얼 → 배포 → Plugin
- 신규 successor Package: C-16~C-20
- successor Package 총계: 113개
- 원격 운영: Web Console/PWA 공식 채널, Telegram 보조 adapter, native mobile app 후속 검토

## 현재 경계

- 기존 108개 historical baseline과 Gate/DIR evidence는 재작성하지 않음
- Agent별 대화 UI와 실제 Agent Team/MoA runtime은 아직 `NOT_IMPLEMENTED`
- 통합검증매트릭스·테스트계획서·progress/HANDOFF·approval binding 정합화 전에는 v2.7/v1.6을 구현 기준선으로 사용하지 않음

## 2026-09-18 v2.8/v1.7 정합화 overlay

- `DESIGN-51.1..51.5 ↔ C-22..C-30 ↔ ROLE-CONTRACT/TEAM-MOA/SNS-DAON/UI-TRACE/WSL-E2E` 예약 매핑을 통합검증매트릭스·테스트계획서에 추가했다.
- C-28은 mockup artifact와 신산님 확인 evidence 전까지 READY 금지다.
- build-progress의 historical `plan_version=1.6`, F-02 current state, event sequence는 보존한다. C-22 successor event는 approval binding과 WorkInstruction 발행 후에만 추가한다.
- Kakao 외부 API/auth/quota와 Daon User 실제 API/role/auth는 `OPEN_DECISION`이며 추측 구현하지 않는다.
