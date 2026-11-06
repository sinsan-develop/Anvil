# FN07 보호 process profile 선택 소스 검수 결과
- 일자: 2026-11-06
- 판정: 소스·합성 검증 범위 인수. 실제 실행 지원과 전체 계획 완료는 아님.
- 담당: 기존 Primary 구현, Main 관리·직접 검증, 기존 읽기 담당자 독립 검토.
- 시작 HEAD: 96fdb7fb3faf03d243c7f51cf60c9d5f452eeb85
- WI: docs/work_packages/FN07_PROCESS_PROFILE_SELECTOR_SOURCE_IMPLEMENTATION_20261106.md
- WI SHA256: 96DDDB842D3ACF497B727B69D4FA1A0F7BAD7D17D2F1D8AC2E1A28CEAD46C9FB

## 구현과 근거
실제 ProjectConnectionDefinitions/ProjectEnvironments/ProjectEnvironmentResources를 같은 access로 내부 구성하고 원 권한·저장 원문·감사·현재성을 소비한다. 명시 fullref3와 원9키를 유지하고 직접 root와 보호 snapshot/identity 관계를 원 helper로 확인한다. 전후 재조회·원 actor/query/하위 함수 정체성·최단 기한·취소를 검사한다. program/template은 선언 원문이며 실행 인자나 환경변수로 해석하지 않는다.

반환은 논리 refs와 선언 데이터·미검증 issues의 고정 후보다. 관측 실제 경로·비밀값·원 DB 오류는 반환하지 않는다. actualExecutionVerified/executionAuthorized/executionEligible/dispatchPerformed/workAccepted는 false, ownership은 UNVERIFIED다.

## 변경 파일
| 경로 | bytes | SHA256 |
|---|---:|---|
| apps/server/modules/connections/claude-process-profile-selector.ts |12427|B7E4DBA10BCF44F95CC5B086DAEFD3F1AD2D3ADCA6F3139CC2E41BEADA05C6EF|
| tests/unit/FN07/claude-process-profile-selector.test.ts |22048|65C53A5259C1CE316ACD447A5866FE3ED53DEA0DD871F37B2B587D5F8554B900|
| tests/unit/FN06/connection-definitions.test.ts |24705|DA9152571B258F44898E41E487E85C6D8B16D34E05129B8912E13BB6FD6A8B6C|

기존 시험1은 repository fixture에 installationId:id(90) 한 필드만 추가했다. 실제 guard·인증·SQL·기대값은 변경하지 않았다. 신규2 외 제품 수정0이다. 결과/WORK_STATUS/구현 통제 문서를 함께 보존한다.

## 실제 오류와 보완
- 구조적 모듈 부재 RED9d0e14는 준비 단계로 분리한다.
- 독립 C0/I1/M0: 실제 currentHost 교체로 등록 회수·정책 변경 검사를 생략할 수 있었다. 실제 RED fe0f91 뒤 history/host/currentHost/currentMetadata/currentSource/등록 read의 최소6 정체성을 고정했다. GREEN01f0f0과 최종 독립 C0/I0/M0로 해소했다.
- Main7dd6a0: 직접5파일69개 중68PASS/1FAIL/skip0/6234.5034ms/exit1. 기존 익명401 시험은 신규 selector 진입 전 buildApp에서 필수 installationId 없는 fixture 때문에 실패했다. 원3파일 HEAD 동일·selector import0을 Main a1bc10과 담당자6ed895가 대조했다. 기존 guard를 낮추지 않고 합성 초기화 필드만 보완했다.
- Primary의 앱 네트워크 권한 철회 턴 실패는 제품 실패와 구분한다. 동일 담당자 재개 읽기5f72a3/6ed895는 성공했고 설정 변경·우회·담당 교체0이다.
- Main의 한국어 외 subagent 단문1은 폐기·한국어 지시로 교체했다. 제품 효과0이며 실제 검증 결과로 세지 않는다.

## Main 직접 검증
최종5파일 명령:

```text
node --test --test-reporter=dot tests/unit/FN07/claude-process-profile-selector.test.ts tests/unit/FN06/connection-definitions.test.ts tests/unit/FN06/environment-versions.test.ts tests/unit/FN06/environment-resources.test.ts tests/unit/FN08/source-read-snapshots.test.ts
npm run typecheck
git diff --check
```

5c9855→세션53198→a19a3a: 같은69개 전체 통과를 dot 출력으로 확인, 최종 exit0. typecheck/diff0. 이전 실패 실행은 그대로 보존하고 최종 결과로 소급하지 않는다. Primary 신규16 및 이전 인접42는 별도 제출이며 Main69에 중복 합산하지 않는다. bootstrap110 등 불변 완료 검사는 반복하지 않았다.

독립 최종 검토는 신규2의 C0/I0/M0와 지문 불변을 확인했다. 추가 fixture1도 독립 C0/I0/M0다. installationId 필드 문자열을 제거하면 시작 bytes/hash와 정확히 같고, 기존401·AUTH_REQUIRED·익명 SQL0 단언은 보존됐다. 독립 시험 재실행은 하지 않았다.

## 미검증과 다음 작업
이번 시험은 실제 보호 클래스와 메모리 SQL/snapshot 모델의 소스 검증이다. 실제 PG·서명·OS 관측·SDK process·실제 사용자 원문 조회/전송·도구 결정·SESSION claim·서버/화면/사용자 인수는 NOT_RUN이다. 실제 DB/권한/키/서비스/Agent 실행0, push/PR/main/배포0이다.

후속 실제 driver의 실행파일/argv/env·현재성 공급, 원 SDK hook·도구 결정/허가·세션 claim 및 전체 계획 검증은 남는다. 별도 SDK 원문 재조회 질문은 답변 전 실행하지 않는다. 일부 승인 경계로 나머지 구현을 전체 대기로 바꾸지 않는다.

기존 관련 없는 보호3과 원 reader를 보존한다. rollback은 이번 소유 파일만 정상 revert하며 실제 환경 복구 대상은 없다.
