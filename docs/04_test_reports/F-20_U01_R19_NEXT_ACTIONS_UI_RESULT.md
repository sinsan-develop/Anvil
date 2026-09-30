# F-20/U-01 R19 Next Actions UI 구현 결과

## 판정

`COMPLETED` — 승인된 내부 UI slice의 로컬 검증만 통과했다. U-01 전체 acceptance, F-20 최종 검증, C30 incident 해소 또는 ReleaseDecision 변경은 아니다.

## 기준·권한

- 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R19 계획 `6543DC078DF1C3520103CE4E27CCCE6042CAF49922ECFD1BCDDB38BB101DA4EB`.
- 작업 시작 branch `codex/f18-wsl-ops`, HEAD `937465264dbf712d8d3694dba1c686819b088612`, tracked/untracked 변경 없음. `development/codex/f18-wsl-ops`가 같은 HEAD였다.
- canonical progress/HANDOFF seq1912의 dual lease epoch33 `ACTIVE`, actor `developer-primary-f20-u01-r19`, exact3 allowed paths, `execution_fencing_token=f20-u01-r19-execution-fence-epoch-33-r19ui3009a`, `write_fencing_token=f20-u01-r19-write-fence-epoch-33-r19ui3009a`를 확인했다. lease의 `baseline_git_commit`/`dispatch_head=4c8e6a339e9685e7bd407cc3b26aae57dbb32ecc`는 start 통제 commit `93746526`의 직전 선조다. Main이 start commit local/remote/WSL 동일 SHA, G-05 seq1912 PASS를 확인해 이 정상 control commit 관계를 판정했다.

## 변경·검증

- `apps/web/tests/f15-console.test.mjs`: 실제 `loadDashboardQueue`와 실제 `NextActionsCard` 렌더를 이용하는 5개 테스트 추가. 정상/빈 목록/401·403/5xx·transport/행 malformed·101건/위험 링크·HTML escaping·Queue/Health 독립성을 확인한다.
- `apps/web/src/console/App.tsx`: 같은 출처의 기존 `/api/dashboard/operations` 응답 `next_actions` exact5·타입·최대100을 검증하고 Dashboard에 텍스트 기반 Next Actions를 연결했다. 메뉴에 구현된 안전한 내부 상대 경로만 링크로 사용한다. 비정상 행은 `UNAVAILABLE`, 401·403은 `BLOCKED`, 그 외 실패는 `UNAVAILABLE`; 기존 Queue·Health·Alerts는 변경 없이 독립 유지한다.
- TDD RED: 테스트 추가 후 `npm run test:console -- --test-name-pattern="Dashboard Next Actions renders validated rows"` 종료 1, 40개 중 39 PASS/1 FAIL. 실패 원인은 `state.nextActions?.status`가 `undefined`인 기능 부재였다.
- 구현 뒤 `npm run test:console` 종료 0, 44/44 PASS. 첫 `npm run lint` 종료 1 (`noArrayIndexKey` 1건); 안정적 콘텐츠+동일행 발생번호 key로 수정했다.
- 최종 재검증: `npm run test:console` 종료 0, 44/44 PASS; `npm run typecheck` 종료 0; `npm run lint` 종료 0, 3 files checked; `npm run build` 종료 0, 20 modules transformed. `git diff --check` 종료 0.
- build가 생성한 `apps/web/dist`는 시작 시 없던 경로임을 초기 clean 상태로 확인했고, 빌드 후 exact 경로·내용을 확인해 삭제했다. 잔류 없음. 최종 Git 변경은 이 결과를 포함한 allowed exact3뿐이다.

## 미검증·잔여 위험·rollback

- 실제 WSL-server exact SHA 재검증, 실제 브라우저 E-SHOT/E-NET/E-API, 전체 U-01 메뉴 수직 흐름과 사용자 인수는 **미실행**. Main의 후속 작업이다.
- 기존 API가 공급하는 action 외의 실행·승인·비용 read model은 아직 `UNAVAILABLE`이다. `next_actions` 빈 배열은 현재 관측된 0건만 의미한다. 위험하거나 미구현 `deep_link`는 이동 링크로 사용하지 않는다.
- 새 API·schema·인증·Secret·비용·운영 변경 없음. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다.
- 회귀 시 R19 exact3 변경만 정상 revert하며 기존 Queue/Health/Alerts 구현은 보존한다. Git commit/push와 progress/HANDOFF/WORK_STATUS 갱신은 Main 소유라 Developer가 수행하지 않았다.
