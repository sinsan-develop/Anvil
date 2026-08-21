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
