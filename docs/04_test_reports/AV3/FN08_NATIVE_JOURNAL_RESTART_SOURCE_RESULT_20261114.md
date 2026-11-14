# FN08 보호 journal 연결 source 결과 — 2026-11-14

상태: source 한정 독립 최종 검수 C0/I0/M0, Main 합성 검증 수용. **Windows 정상 내구저장·재시작 및 전체 계획은 미완료**.

## 판정·근거
채택 A안의 source-only 범위에서 owner → typed journal adapter → 실제 Client 조립을 구현했다. RAM 포트로 원 PREPARED/FACTORY_ATTEMPTED 순서 및 재시작 후 추가 factory·consume 0을 확인했다. 기존 모델 adapter는 보존했다.

구체 Windows 공급자는 최초 journal 읽기·쓰기 전에 `NATIVE_JOURNAL_DURABILITY_UNSUPPORTED`로 닫는다. CLOSED flush 오류 후 완전 bytes가 남은 경우와 성공 후 응답 유실은 다음 host에서 구분할 수 없다. 별도 확정 근거 없이 정상 CLOSED를 잠금 회수 권위로 승격하지 않는다. 이는 승인 A안의 지원 불가 조항과 PMO 기술지원 회신을 적용한 것이며, Windows 기능 완료가 아니다. 원 namespace 발급·소실 검산·handle identity·한도 source는 실제 OS에서 검증하지 않았다.

## 기준·변경
- 기준 HEAD: `05e070dd24cc77f774963105678657709646489e`, branch `codex/av3-d1-journal-binding`.
- 계약: `docs/contracts/FN08_NATIVE_JOURNAL_RESTART_BINDING_CANDIDATE_20261114.md`, SHA256 `6FC307D7C13435563F6E9BD99B2F8BF473E45B6584C16F401A41250169BBAC87`.
- WI: `docs/work_packages/FN08_NATIVE_JOURNAL_RESTART_SOURCE_IMPLEMENTATION_20261114.md`.
- 기존 Primary 단일 writer 제품11·시험6. Main은 검수·문서·통합. 서버/API/SQL 변경0.
- 변경 전: owner의 모델 journal 주입 없이는 Client 조립 거절. 변경 후: 원 보호 operation·현재 HUMAN/등록 검산을 거쳐 typed journal 공급자 조립. 실제 Windows 공급자는 보장 부재로 거절한다.
- runtime closure 19개/export12, native compile input 목록21개. 실제 C# 컴파일은 하지 않았다.

## Main 검증
| 명령/범위 | 결과 | 한계 |
|---|---|---|
| `node --test tests/unit/FN06/native-preparation-protected-journal.test.ts tests/unit/FN06/native-preparation-client.test.ts tests/desktop/native-preparation-return-owner.test.cjs tests/desktop/native-proof-runtime-build.test.cjs tests/unit/FN06/native-preparation-journal-native.test.ts` | 51P/0F/0SKIP, 7210.3174ms, exit0 | RAM·메모리 bundle·C# source 정적 검사 |
| PE 시험, 아래 메모리 resolver | 15P/0F/0SKIP, 76.2615ms, exit0 | 합성 PE bytes, 실제 compiler/Windows 실행 없음 |
| root `tsc --noEmit -p tsconfig.base.json --pretty false` | 진단0, exit0 | root 타입 범위 |
| `git diff --check` | exit0 | 변경 공백 검사 |

서로 다른 51+15개 시험이며 집중 재실행 횟수를 중복 합산하지 않는다.
PE 명령은 기존 `pe-library` 1.0.1을 프로세스 메모리에서만 resolve했다. 설치/junction/검산기 변경0.
```js
const {registerHooks}=require('node:module');
registerHooks({resolve(specifier,context,next){
 if(specifier==='pe-library')return {url:'file:///C:/Users/cyhuh/.codex/worktrees/av3-stage-b/Anvil/apps/desktop/node_modules/pe-library/dist/index.js',shortCircuit:true};
 return next(specifier,context);
}});
require('./tests/desktop/desktop-trust-key-host-build.test.cjs');
```

## 실패·보완 이력
- 최초 owner RED 0P/1F: 보호 공급자 부재. 이후 실제 owner/Client RAM 연결 통과.
- native source 연결 정적 RED 0P/3F → 해당3P와 unsupported 추가1P. 실제 native 실행 증거 아님.
- OPEN 공급자 예외에서 opens=2 RED → 호출 진입부터 불명 보존·재OPEN0·늦은host 단일close 보완.
- 최초 영향 묶음25P/1F의 NO_JOURNAL은 이전 host0 기대가 새 typed OPEN과 불일치. OPEN1·append0·factory0·반환POST0·재호출0으로 변경 이유를 명시하고 보호 단언을 유지했다.
- runtime 사전독립 C0/I0/M1: 최대크기 시험이 임의JSON 계산이었던 점을 유효ref/hash·실판독/tuple/envelope로 보완했다.
- native 사전독립 I1: 실제 file handle identity·hardlink 검산 부재를 source에 보완. Windows 실행은 차단 상태이며 실제 효과 미검증.
- 잠금 삭제 후 parent flush 불명 문제는 append-only source로 검토했으나 마지막 CLOSED flush 불명 자체가 해소되지 않아 구체 Windows 공급자 지원 불가 처리.
- Primary 기본 PE 시험14P/1F(exit1)은 의존성 resolver 부재 이력으로 보존. 메모리 resolver15P와 구분.
- Desktop 전체 타입 검사 exit1, 기존174진단. Primary의 TS7 메모리 HEAD overlay 비교 baseline174/current174/신규0은 전체 타입 PASS가 아니다. root 타입만 PASS.
- 시험 ISO 범위/인수타입 교정, tsc -p 누락·TS7 진입점 도구 오류는 제품 정식 FAILURE_REPORT와 구분한다. 정식 FAILURE_REPORT0.

## 독립 검수와 통합 판단
- native/root/host/build 7경로 독립 C0/I0/M0: prior handle identity I1 해소, mutation 전 unsupported 및 기존 등록 호환 확인.
- runtime/owner/build/시험 10경로 독립 C0/I0/M0: late OPEN 재진입 차단, 원 등록·기한, 실제 Client RAM 재시작 factory0, prior 크기시험 M1 해소.
- 두 검수자의 최종 지문과 아래17파일 일치. 실제 환경은 검수 제외.
- Main은 source-only 부분 구현과 보수적 차단을 통합할 수 있다고 판단한다. Desktop 전체174진단은 기준선부터 존재하며 이번 root 타입/직접 영향/차이 검산과 구분한다. 전체 기능 완료·인수·Windows 지원 판정은 하지 않는다.

## 미완료·제외·rollback
실제 Windows 내구저장·정상 재시작 기능은 미완료. 실제 파일/ACL/DPAPI/부모 metadata/전원손실/동시root 생성, C#컴파일·helper·Agent, DB·권한·키·서비스 실행은 제외·미검증이다. 합성 성공으로 승격하지 않는다. 제품에서 기존 코딩 Agent의 실제 작업이 가능해졌다고 주장하지 않는다.

rollback은 이번17경로 delta를 기준HEAD와 대조하여 일반 revert로 회수하는 범위다. 이전 완료 구현·Main 기록·타인 WIP·과거 실패는 보존한다. 이후 작업은 내구저장 지원 조건을 별도 기술 과제로 남기고, 승인 범위 안의 미완료 연결을 계속한다.

## 동결 제품·시험 지문
| 경로 | SHA256 |
|---|---|
| `apps/connector/native/NativePreparationJournalSource.cs` | `00003D8F5BD80F1778D9C58E2487EE859F2C3447379DEE858B1E93AA0337848B` |
| `apps/connector/native/NativePreparationJournalKernel.cs` | `071DC7D41AD69DBD367EB9FF493DBE70B41AF8B28532D38CA171F280D4CBCE8F` |
| `apps/connector/native/DesktopTrustKeyRootSource.cs` | `7B867F2F4020B614E24EF7B59CD5F0F7E05115F4BD616918A48D4A531CEDF897` |
| `apps/connector/native/DesktopTrustKeyHostSource.cs` | `78E0938471D2918284748DD00394E1C97019C0ED1FDBC0D3AEA9658D21916882` |
| `apps/connector/runtime/native-preparation-protected-journal.ts` | `CD128A9B7F61A1180E76427201777B1B7287FF4D52FB5D3F82AFF4FB3168620F` |
| `apps/connector/runtime/native-preparation-local-attempt.ts` | `A6AA2CE3D7168159B4C73E497675CCCB1F2648E4EF15152484A04FF061BDC030` |
| `apps/connector/runtime/native-preparation-client.ts` | `0A35E464A789881F5585A80D86D0F4D11767FDC217CB33CEDE0AD21158EA06E5` |
| `apps/desktop/src/trust-enrollment-owner.cjs` | `EBBCDA2868C47A66A838CF64A1B20D93F2AFD8DE04C229C6D62F16F464007A77` |
| `apps/desktop/scripts/native-proof-runtime-entry.mts` | `15F7AB2A0C08101D470D5F6C6A10B8325AFA549A8B9BD4957E60124F504467C6` |
| `apps/desktop/scripts/native-proof-runtime-build.cjs` | `93181A670B231BA8D7AF902A44CD49B575F27D422FD4D06A0326AB32BF337504` |
| `apps/desktop/scripts/desktop-trust-key-host-build.cjs` | `178B4DDE519991841F488F57AFBCFEA18ED9EB2AE400A840146D0EA006E0A199` |
| `tests/unit/FN06/native-preparation-protected-journal.test.ts` | `FD916759382D5C76410B54B308743771370D60EF428490684AF2F69209A7571C` |
| `tests/unit/FN06/native-preparation-journal-native.test.ts` | `F13F170B774D6F21850212FF09BAEF71938FA0162B80215DA17A4542BDEFC149` |
| `tests/unit/FN06/native-preparation-client.test.ts` | `64636D1D6CCD2A89B221137CC18D889DAEAF480CC41AFBB659B714D8EA156539` |
| `tests/desktop/native-preparation-return-owner.test.cjs` | `AAE3132ACF864CA32784F5FDE326A4F12AB7149AAA7E476D001746E5F5EC738E` |
| `tests/desktop/native-proof-runtime-build.test.cjs` | `9B8D5ED5F31C6CA0F7FE679635BAD430F45CD7D2FF02A69D6F79AB8877A6E630` |
| `tests/desktop/desktop-trust-key-host-build.test.cjs` | `A3F840EFF56FFBC4919FB271295E4CD55F342DE83C8E9553E9ACB89866134A62` |
