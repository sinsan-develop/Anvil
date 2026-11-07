# FN06 native 준비 계약 r2 A 직접 승인 기록

2026-11-02 / Main 어울

## 직접 지시

> native 준비 계약 r2 A안 승인해. 코드·화면·미적용 SQL·합성 검증은 기존 subagent에게 맡겨. 실제 DB·권한·키·서비스·Agent 실행·실자료 조사와 P03 R3 실행은 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.

대상은 `docs/contracts/FN06_NATIVE_PREPARATION_AUTHORITY_CURRENT_CONSUME_CANDIDATE_20261102.md` r2, SHA256 `5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085`의 A안이다. 승인 시점 기존 HEAD는 `598bad9c230d4330a0e1b1029fb3f044994bba10`, branch는 `codex/av3-stage-b`다. tracked clean과 보호 untracked3를 실제 대조했다.

## 적용 범위

새 HUMAN 준비 요청·정확 일회 승인·불변 intent/원 영수증·writer 예약과 분리2표의 source 저장·조회, 새 준비 전용 목적의 current/challenge/한 번 소비·로컬 시도/factory 진입 보호 코드, UI11 요청·과거 조회와 UI08 승인 연결, forward **미적용** SQL·합성 검증을 채택한다. 기존 D1/v1/writer 계약과 보호 자료는 보존한다.

실제 DB/DDL/GRANT·권한·계정·키·CA/TLS·서비스·native/OS/helper/compiler·Agent·실자료/백업 대상 조사·P03 R3 실행은 승인하지 않았다. 실제 공급자는 기본 미등록/부재 시 거절이며 source 포트·합성 성공을 실제 권위 발급/내구 저장/OS 강제/Agent 실행의 완료로 취급하지 않는다.

## 수행·검수

기존 Primary 한 명이 `docs/work_packages/FN06_NATIVE_PREPARATION_AUTHORITY_SOURCE_IMPLEMENTATION_20261102.md`의 정확27경로에서 구현하고 Main은 같은 제품 파일을 수정하지 않는다. 기존 Reviewer의 초안 보정 최종 C0/I0를 보존하고 구현 제출 뒤 코드·명령/결과·직접 영향 검증을 별도로 검수한다. 원 후보 문서는 승인 기록과 분리해 바이트/hash를 유지한다. 미승인으로 기록된 과거 이력은 소급 삭제하지 않는다. 전체 작업계획서는 여전히 미완료다.
