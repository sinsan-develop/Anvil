# FN08 native retained 조립 source 결과 — 2026-11-14

## 판정
승인된 반환 A안의 내부 조립 source 범위를 수용한다. 전체 FN08·작업계획 및 실제 Windows 실행은 미완료다.

## 변경과 근거
- 기준: 8ddf2a14b0264b6d4ad574cbbbf79aeec892fe07 / codex/av3-d1-runtime-followup, main6c4974c4(PR109).
- WI: docs/work_packages/FN08_NATIVE_RETAINED_FACTORY_SOURCE_IMPLEMENTATION_20261114.md.
- Primary 단일 writer, 제품3·시험3 경로. Main 검수·기록·통합. 새 공개 API·SQL·권한·설정 계약 없음.
- 이전에는 기본 retainedProvider가 null이면 즉시 거절했다. 이후에는 원 context를 검산하는 조립기로 연결하고 보호 입력이 없으면 첫 native primitive 전에 거절한다.
- 원 authority/receipt/permit에서 normal selection을 파생하고 별도 보호 입력의 factory·consume·등록·scope·host/worker image를 대조한다. 과거 PREPARATION_GRANTED 부모를 전용하지 않는다.
- 기존 Job → assignment → startup → 원 process primitive를 연결했다. 원 CWT 객체를 반환하고 Job/Image 소유를 조립기에 보유한다. 정리 UNKNOWN이면 부모 참조를 남긴다.
- build 고정 소스 목록은 21→22개다. 기존 인접 정적 시험의 null 거절 assertion을 새 호출 경로로 연결했고 등록·서명·단발 기준을 유지했다.

## 검증
| 수행 | 결과 | 증거 한계 |
|---|---|---|
| Primary 최초 신규 시험 | 0P/3F exit1, 238.8918ms | source/host 연결 부재 RED |
| Main `node --test tests/unit/FN06/native-preparation-retained-factory.test.ts` | 10P/0F/0SKIP, 244.9388ms, exit0 | C# 정적 8 + 별도 RAM 모형 2, 실제 C# 호출 아님 |
| Main `tests/desktop/desktop-trust-key-host-build.test.cjs` | 16P/0F/0SKIP, 121.5944ms, exit0 | 실제 JS build 입력 생성·합성 PE 검산, compiler 미호출 |
| Main `node --test tests/unit/FN06/native-preparation-ownership-return-native.test.ts` | 3P/0F/0SKIP, 207.235ms, exit0 | 기존 signer/host source 정적 |
| Main root `tsc --noEmit -p tsconfig.base.json --pretty false` | 진단0, exit0 | root 타입 범위 |
| Main `git diff --check` | exit0 | 공백 검사 |

PE 시험은 기존 pe-library 1.0.1을 Node registerHooks로 메모리 resolve했으며 설치·junction·검산 코드 변경은 없다. 정확 호출은 이전 journal 결과서의 resolver와 동일하다. 신규 10+16+3=29개이며 재실행 횟수를 중복 합산하지 않는다. 기존 Desktop174진단은 이번 수정으로 해결했다고 주장하지 않으며 전체 Desktop 재검사는 반복하지 않았다.

## 독립 검수
- d2_scope_audit: 원 context·CWT·정리 소유/UNKNOWN 보존 C0/I0/M0.
- d2_preflight: build closure·32필드 원천·증거 표현 C0/I0/M0.
- 검수 source 지문: B635B3F9E43510A3F15F47B63073EF5C94183EB7E962E0B659B9E65F352BC861.
- Host: E2A6CB743E1D6E9A4447145D2E7E4440BE26C6CB354BF1D38D0A7AF43AFDA987.
- Build: 501A4E7E18FC4255095AEBA9558EA9FFFA95713A30CAF410C462B733A26CE059.

## 미완료·제외·다음
ProtectedSource는 추상·미등록이다. helper 이미지 mapping과 worker 이미지 mapping은 다른 원천이며 설치 보호 root/path/hash와 runId/processGeneration/observerRef 발급 주체를 연결해야 한다. 이 source 조립은 실제 producer 완성이 아니다. Windows journal unsupported도 유지한다.

실제 C# 컴파일/로드, 프로세스/Agent, 사용자 자료 조사, 파일/ACL/키, DB·권한·서비스 실행은 0이다. normal grant/current·실제 정리·재시작을 PASS로 승격하지 않는다. 다음은 기존 채택된 설치 신뢰 계약에서 보호 입력 생산의 권위 원천을 확인하고 미완료 source를 연결한다.

## 복구
해당 source commit을 일반 revert하면 이전 기본 null retained 거절로 돌아간다. 실제 환경 변경이 없어 DB/서비스 복구 작업은 없다. 부분 실패 시험은 RAM 모형에 한정하며 실제 OS 회수 증거가 아니다.

## Primary 최종 반환
6경로 동결·code write 반환·live handle0. RED 이력은 최초3F 외에 원 image 재소유 반례1F와 낡은 인접 assertion1F가 있었고 보완 후 GREEN이다. 정식 FAILURE_REPORT0회. Desktop TS API HEAD 메모리 overlay 비교는 기준174/현재174/신규0이며 전체 Desktop PASS가 아니다.
