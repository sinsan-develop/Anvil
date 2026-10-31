# 프로젝트 저장량·지속예약 A안 직접 승인 — 2026-10-31

신산님 직접 지시:
> 저장량·지속예약 A안 승인해. 새 예약 원장 2표와 관련 코드·미적용 SQL·합성 검증 구현을 기존 subagent에게 맡겨. 실제 DB·권한·키·파일 조사·서비스·Agent 실행과 기존 프로젝트 차단 해제는 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.

- 채택 대상: docs/contracts/PROJECT_STORAGE_QUOTA_RESERVATION_SOURCE_CANDIDATE_20261031.md.
- SHA256: 9110DEA86C1616B224F5BB4DA6E1099B7BD9915A0DC67D044CDBC06827EE12E2.
- 동결 후보의 DRAFT/NOT_ADOPTED는 승인 전 이력이다. 이번 직접 승인으로 A의 source 계약·새 원장2표·관련 코드·미적용 forward SQL·합성 검증 구현을 채택한다. 원후보 bytes는 수정하지 않는다.
- Main이 정확 열/guard·allowlist·기존 namespace/coverage와 오류 호환 조건을 작업지시서에 고정한다. 기존 단일 Primary가 구현하고 Main이 검수·통합한다. 기존 담당과 branch를 유지한다.
- 실제 DB/SQL 적용·GRANT/정책/권한·키·현재 파일/사용량 조사·실서비스/Agent·기존 프로젝트의 저장 차단 해제는 제외한다. 기존 자료의 사용량을 0/READY로 자동 승격하거나 UNKNOWN을 시간으로 해제하지 않는다.
- 실제 FS/DB/권한·현재 프로젝트의 통합 quota 및 실제 저장 성공은 합성 검증과 구분한다. 전체 WORK_PLAN 완료를 뜻하지 않는다.
