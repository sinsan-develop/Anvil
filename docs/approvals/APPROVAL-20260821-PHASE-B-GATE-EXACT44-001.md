# APPROVAL-20260821-PHASE-B-GATE-EXACT44-001

- approver: `신산님`
- approval_recorded_at: `2026-08-21`
- approval_mode: `AUTHENTICATED_HUMAN_DIRECTION`
- owner_direction: `Phase B Gate는 dependency-safe exact 44개 검증 ID 집합으로 진행한다.`
- affected_scope: `Phase B Gate selector 정합화 및 Gate 검증만`
- classification: `HUMAN_APPROVED_SEMANTIC_GATE_SCOPE_DECISION`
- baseline_git_commit: `165a9bfff5e085bfec322c748e83464477642f8a`

## 결박된 결정

- direct Gate set은 현재 정의되고 B 이전/B Package가 책임지는 exact 44개다.
- `AV-STAT-021/022/023/024/025/028`은 각각의 후속 책임 Package와 해당 후속 Gate에서 검증한다.
- 정의되지 않은 `AV-STAT-029`는 Phase B Gate에서 검증하지 않으며, 새 요구사항으로 임의 정의하지 않는다.
- 기존 설계서·작업계획서·통합검증매트릭스·테스트계획서의 원문은 수정하지 않는다. 이 결정은 Gate WorkInstruction과 EvidenceManifest에만 적용한다.
- B-01~B-12 accepted 제품·증거와 기존 승인 계보는 변경하지 않는다.

## 승인 후 허용 범위

- Phase B Gate WorkInstruction·Invocation 발행
- Gate 검증용 checker/test/validation/evidence/completion 산출물
- progress/HANDOFF/Event에 Gate 시작·완료 상태 투영
- `developer-primary` 단일 worker/write lease

## 금지 범위

- C-01 시작 또는 Agent/provider kernel 구현
- 메뉴 UI·공개 API·shared DB·WSL/ysna 배포
- 권위 문서 원문 수정
- 기존 accepted evidence·제품 파일 수정
