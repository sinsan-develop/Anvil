# F-19A 최소 등록·정확 pair grant 제품 계약 승인 기록

- approval_id: `APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001`
- source: 현재 Anvil 대화에서 PMO의 별도 제품 계약 승인 경계와 Main의 상세 권고안 직후 신산님의 직접 응답 `승인해` (2026-10-07, Asia/Seoul)
- approved_subject: `docs/architecture/f19a/F19A_MINIMAL_PAIR_AUTH_CONTRACT.md`의 여섯 route, 추가형 0020 schema, 정확 pair grant, 기존 고정 GET/ACK 권한 강화, WSL-server 격리 QA 최초 관리자·전환·복구 계약
- approved_subject_sha256: `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`
- implementation_plan: `docs/work_orders/F-19A_MINIMAL_PAIR_AUTH_IMPLEMENTATION_PLAN.md` (`DE9BC55DF430552235578BE330A502B7B180F25496E34B8BC61C2B86FDF154B5`)
- parent_documents: 설계서 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, 작업계획서 `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, 매트릭스 `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, 테스트계획서 `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`
- scope: 기존 `codex/f18-wsl-ops` 단일 branch에서 F-19A를 별도 Package로 구현·로컬 검증·동일 SHA WSL-server 검증·독립 판정한다. 새 제품 코드·공개 API·인가·0020 migration은 확정된 WorkInstruction과 유효한 dual lease의 정확 경로에서만 수정한다.
- security_boundary: 최초 관리자 부여는 승인된 격리 QA seed만 사용하고 기존 actor/role·Secret은 변경하지 않는다. 등록만으로 grant를 만들지 않는다. 철회 후 과거 앱 SHA로 단순 rollback하지 않는다.
- excluded: `ysna-server`·Production, 공유/지속 DB 전체 restore, 무차별 actor cutover, U-01 제품 write·수락, F-20/U01 전체 수락, Release GO, `main` 직접 개발·신규 branch, force push·history rewrite.

이 파일은 신산님의 대화 지시를 정본 계약에 결박하기 위한 Main 기록이다. 서명이나 F-19A 구현·검증·수락 완료를 주장하지 않는다. 승인 범위를 넓히는 계약 변경은 별도 판정한다.
