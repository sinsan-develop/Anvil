# FN06 native 준비 현재 source 구현·검수 결과

## 판정

승인된 source 단위 검수 완료. 실제 보호 mapping 생산자·실제 DB/OS·Agent 실행과 전체 FN06/FN08·작업계획서 완료는 아니다.

- 코드: 59b5b4d9c6ce3fc7d512caa7d753f16877064b5d, codex/av3-stage-b. 부모 문서 checkpoint558963c073739295f174cc449e61c83acf3fb58a. 정확5/291추가26삭제.
- WI: docs/work_packages/FN06_NATIVE_PREPARATION_CURRENT_SOURCE_IMPLEMENTATION_20261102.md r3, SHA256 5005DFC45201823A941DDE6F80DFCB326505E150DF321B28F4B06CE3B17D15ED. r2 부모 BAA73A1FEE6A188FC9EE2737DBA57A5F59839AF2C79643B416049DBE288963A4. 원 source 승인9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567의 내부 보완이다.
- 담당: 기존 Primary → 정식 동일 실패3 후 Main 인수 → Main의 동일 stale-anchor 반례3 후 국소수정 중단·독립 재설계 → r3 기존 Primary 단독 구현 → Main 검증/통합·기존 Reviewer 정적 C0/I0. 동시 code writer0.

## 변경과 효과

같은 authenticated Tx에서 현재 session/OWNER/control/정책·writer head/event/원 command·receipt·audit·역사 승인과 등록 원행/키지문/basis를 실제 SELECT로 복원하는 어댑터다. 원 options/prepare/RESERVED host current를 연결하고 기존 공개 등록 조회 권한·STATUS_ONLY 의미·일회 승인 재소비 금지를 보존한다. mapping/crypto 명시 공급자가 없으면 거절하며 caller 주장이나 catalogue만으로 지원을 만들지 않는다.

Tx 종료 시 원 source lease를 폐기한다. 최초10초·외부 최소기한을 늘리지 않고 private {at,mono}로 후행 DB관측과 실제 경과를 함께 보존한다. 실제 auth.at/공개 observedAt은 바꾸지 않는다. mapping/profile/factory/scope 교체·getter·만료·늦은 정착은 추가 query/저장 전에 거절한다. 원 prepare의 최종 current는 발급 deadline 아래로 짧아지거나 기존 current보다 길어지면 같은 합성 Tx를 rollback한다.

## 정확5 지문

| 파일 | SHA256 |
|---|---|
| apps/server/modules/executions/native-preparation-current-source.ts | A57080C52B113D8245272A53296768A2F364D62DD0271923D6E17D1CD86951BE |
| tests/unit/FN06/native-preparation-current-source.test.ts | FF2C75AF5694B9758EC75E3D046AA9B82C6A6FE225C07DBA2C894D756303B043 |
| apps/server/modules/executions/project-writer-authority.ts | 1CF36DF39D8B1A59725A0A9E4B8EA69248110FBB712BD04C4723FE96A869F569 |
| apps/server/modules/connections/project-registration-reads.ts | 4D4F049124970FAEE4DC89DBD4F7A8F84EE53742581D60D3B89412528F516636 |
| apps/server/modules/executions/project-native-preparations.ts | 3FA16AB290DCAD99AFC4D478F3688D4540B0AF4658CC8B4F75F7E76E2D22B0B5 |

## 검증

Main의 동결 후 새 실행:

```powershell
node --test --test-reporter=spec tests/unit/FN06/native-preparation-current-source.test.ts tests/unit/FN06/native-preparation-routes.test.ts tests/unit/FN06/project-writer-authority-routes.test.ts tests/unit/FN06/project-writer-authority-state.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

- 집중4파일: 7c9fb4/session25431 → 6dc424 exit0, 74 PASS/FAIL0/SKIP0, 21831.6754ms.
- root type74546b exit0. 정확5 hash/index 비어 있음·diff01fbf5 exit0. commit 직전 staged hash=원 bytes 및 정확5 대조/diff0(d52f7b).
- Primary 제출의 별도74 PASS/18919.84ms·type1d16df·diff902f09와 Main 결과는 합산하지 않는다.
- 독립 Reviewer는 시작/끝5 SHA 일치·C0/I0, 원 I1 해소·추가 Critical/Important0을 확인했다. Reviewer 시험/실환경 실행0이다.

## 실패·미검증 보존

Primary 최초 시간 상한 검산 실패3과 Main의 stale-anchor 반례 ab74c3/330d73/598ac6를 WORK_STATUS에 보존했다. 각 동일3회에서 그 방식의 추가수정을 중단·예외보고하고 원인 재검토 후 r3로 전환했다. 이전68/70/71 PASS는 이전 코드 이력이며 최종 결과와 합산하지 않는다. r3 fixture mode 분류 오류1은 source 진입 전 head 만료 준비오류였고 분류만 수정했으며 기대값 완화0이다. Main의 경로 추정 읽기 오류도 제품 실패와 분리 기록했다.

새 SQL/실제 DB·권한·키·서비스·compiler/C#·OS/native·Agent·실자료·P03R3·WSL/Oracle·사용자인수는 미실행이다. 합성 데이터/명시 fake mapping·crypto·delivery와 메모리 Tx의 성공을 실제 권위/원자성/실행 성공으로 승격하지 않는다. 보호 untracked3 보존, 새 QA 자원0/live0이다.

rollback은 동일 branch의 이 코드 commit만 정상 revert하는 방법이며 DB 적용/서비스 변경이 없어 runtime rollback 대상은 없다. 실제 supplier·native 서명 전달·제품 조립이 다음 미완료이고, 별도 helper compiler 소비선 source는 그 생산 경로 일부일 뿐 이를 대체하지 않는다. 필수 실제 gate가 남아 PR/main 병합·전체 완료는 하지 않는다.