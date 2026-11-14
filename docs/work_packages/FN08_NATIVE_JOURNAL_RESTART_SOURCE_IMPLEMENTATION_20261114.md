# FN08 보호 journal 재시작 연결 — 구현 지시서

## 기준·담당·범위
- 2026-11-14 신산님 A안 source-only 직접 채택.
- 계약: docs/contracts/FN08_NATIVE_JOURNAL_RESTART_BINDING_CANDIDATE_20261114.md
- SHA256: 6FC307D7C13435563F6E9BD99B2F8BF473E45B6584C16F401A41250169BBAC87
- 기준 HEAD 05e070dd24cc77f774963105678657709646489e, branch codex/av3-d1-journal-binding. PR108 완료 범위 재실행 금지.
- Stage C FN08 / D1. developer_primary 단일 제품 writer; Main 기록·검수·통합. 타인 변경 보존.
- 실제 파일/ACL/키/DB/권한 적용/서비스/helper/C# 컴파일/Agent 실행 제외. Node·TypeScript·RAM 합성 검증만 수행.

## 목적과 구현 경계
기존 보호 root 및 등록 검산으로 원 journal을 생산하고 desktop owner와 실제 Client에 연결한다. 같은 원 tuple의 이전 시도를 재실행하지 않는다. authority/process/grant 복구와 새 실행 허가는 만들지 않는다.

- 고정 native-journal.v1, DPAPI purpose 분리, SID·installationId·검산된 registration fullref·scopeDigest·authority fullref 결박. caller JSON만으로 권위 생산 금지.
- root.Created 단독으로 최초 발급 판정 금지. 원 root 생산자의 검산된 identity와 보호 발급 근거를 생산·보관하는 source 경로를 구현한다. 발급 표식/존재 원장/행의 불완전 조합은 UNKNOWN 보존. 기존 root 호환을 이유로 부재를 최초라고 추정하지 않는다.
- 같은 root의 모든 producer·host·OPEN에 적용되는 create-new 배타/CAS 및 최악 ciphertext 예약. 잠금 DeleteOnClose·stale 탈취 금지. 불명 잠금 보존.
- 첫 존재 표식과 PREPARED 원자 결박, 파일 sync·정확 readback·필요 부모 metadata 정착 전 성공 반환 금지. 정착 미지원은 unsupported/UNKNOWN. identity 검사나 파일 Flush만으로 부모 정착 대체 금지.
- 총 ciphertext 64MiB(임시·이전·잠금 포함), authority 10000, 행 canonical 2MiB 모두 적용. 자동 삭제/축약/상한 확대 없음.
- PREPARED/FACTORY_ATTEMPTED max2 원형·순서·hash 보존. 전용 OPEN/READ/APPEND_SYNC/CLOSE와 비공개 handle·원 기한. 일반 파일/bytes 서명 API 금지.
- 정확 유효 원형과 tuple/envelope의 최대 frame 크기를 시험한다. 기존 64KiB·64frame·host 시간 한도를 유지하며 불필요한 chunk/reopen 프로토콜을 추가하지 않는다.
- 기존 SOURCE_ONLY_MODEL adapter와 구분된 보호 producer를 실제 생성·연결한다. 문자열 label 변경이나 port 주입만으로 완료 판정 금지.
- 사용자 명시 연결/준비에서만 조회, startup I/O 없음. 재시작 같은 tuple factory0; 기록 손상·소실·다른 소유·만료는 거절.

## 정확 제품/시험 허용 17경로
```
apps/connector/native/NativePreparationJournalSource.cs
apps/connector/native/NativePreparationJournalKernel.cs
apps/connector/native/DesktopTrustKeyRootSource.cs
apps/connector/native/DesktopTrustKeyHostSource.cs
apps/connector/runtime/native-preparation-protected-journal.ts
apps/connector/runtime/native-preparation-local-attempt.ts
apps/connector/runtime/native-preparation-client.ts
apps/desktop/src/trust-enrollment-owner.cjs
apps/desktop/scripts/native-proof-runtime-entry.mts
apps/desktop/scripts/native-proof-runtime-build.cjs
apps/desktop/scripts/desktop-trust-key-host-build.cjs
tests/unit/FN06/native-preparation-protected-journal.test.ts
tests/unit/FN06/native-preparation-journal-native.test.ts
tests/unit/FN06/native-preparation-client.test.ts
tests/desktop/native-preparation-return-owner.test.cjs
tests/desktop/native-proof-runtime-build.test.cjs
tests/desktop/desktop-trust-key-host-build.test.cjs
```
서버·SQL·기존 일반 ProtectedStore/file-store는 수정하지 않는다. 추가 경로 필요 시 Main에 이유와 영향 반환. Main 문서 경로는 writer 소유에서 제외한다.

## 순차 구현·검수
1. RED: 보호 공급자가 없는 owner 연결과 새 owner 동일 원 tuple의 재실행 차단 시험. 정확 명령/exit/실패 근거 제출.
2. 보호 namespace 발급 생산자·존재 원장·배타·예약·정착 kernel source 구현. 빈 namespace와 소실을 구분하는 양성/음성 시험.
3. typed adapter 및 host dispatch, owner/runtime Client 실제 source 조립. 기존 모델 경로·등록·기한 보호 유지.
4. GREEN: 정상 첫 기록, 재시작 factory0, 두 producer 경쟁, 다른 tuple/root, 부분쓰기/sync/readback/close 실패, 부모 정착 미지원, 원 기한/한도/UNKNOWN 보존. RAM 합성만 실행.
5. 직접 영향 owner/runtime/build 및 Client 회귀, TypeScript noEmit, git diff --check. C#는 source 정적 대조만; 컴파일/로드 없음.
6. 독립 검수 후 Main 통합. 실제 Windows ACL·부모 내구성·전원손실·Agent 실행 미검증 명시. 계획 전체 완료로 승격 금지.

## 결과 반환
변경 전후 행동·파일·정확 시험 명령/exit/개수·미검증·남은 producer·C#/실제 OS 한계·rollback을 보고한다. product writer는 commit/push/병합하지 않는다. Main은 WORK_STATUS/WORK_CHECK와 결과 보고를 갱신한다.
