# FN06 writer 권위 B·저장 한도 A 직접 승인

2026-11-02 / 신산님 직접 지시 / ADOPTED_SOURCE_ONLY

대상1: docs/contracts/FN06_ACTUAL_WRITER_AUTHORITY_DELTA_CANDIDATE.md v3/B안
SHA256 BF19670DAF44B01D2EAA12CB4CB8661AB573A77CF6133A5B3EC4FBAD8885533D.
대상2: docs/contracts/FN06_WRITER_AUTHORITY_STORAGE_LIMIT_DECISION_20261102.md A안
SHA256 A74FF95EEFB4526D38F678DBAFA07344ECFB518DC3C86519AECE201133D72484.

승인 원문:
> writer 권위 B안과 저장 한도 A안 승인해. 코드·미적용 SQL·합성 검증은 기존 subagent에게 맡겨. 실제 DB·권한·키·서비스·Agent 실행·실자료 조사와 P03 R3 실행은 제외하고, 너는 검수·통합하면서 작업계획서 완료까지 계속 진행해.

새 current/history2표·기본 미등록 source/schema·현재 조회/최초 boundary와 같은 유효 등록 아래 lease 생명주기의 코드·미적용 SQL·합성 검증을 채택한다. 원 후보의 미승인 표기는 채택 전 이력으로 남긴다. 기존 D1/합성·환경507B 계약을 변경하거나 actual 권위/실행을 열지 않는다.

A의10000event/전체epoch·lease 포함 원장64MiB·전체event4MiB/기존payload2MiB·project10GiB 합산 모델과 포화 시 fresh mutation 원자 거절을 채택한다. 회수 전용 예약이 없고 새 회수 사실도 포화로 수용되지 못할 수 있다는 한계를 유지하며, 과거 event/head·현재 보호 조회·원replay를 보존하고 다음 writer 허용으로 승격하지 않는다. 저장 포화를 해결했다고 보고하지 않는다.

actual grant/schema 소비 전환·실제 권위 공급자·source 강제 수단·키/credential·head 유실 복구/재등록은 후속 미정이다. 실제 DB/DDL/GRANT/권한·키·서비스·Agent·실자료·OS/IPC/socket/compiler/프로세스·외부 비용·P03 R3 실행은 이번에 하지 않는다.

시작 branch codex/av3-stage-b / HEAD2d595c7813b2981709386aa3c1ce95b3c73593d8 local/private 동일·tracked clean 및 보호 untracked3를 확인했다. 기존 Primary 단일 writer, Main 관리/독립 검수/통합. 상세 exact 필드·전이/파일 배치는 승인 의미를 보존하는 구현 계약으로 WI에 고정한다. 승인 또는 착수는 전체 FN06/FN08/계획 완료가 아니다.
