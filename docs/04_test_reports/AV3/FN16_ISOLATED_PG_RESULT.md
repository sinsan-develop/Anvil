# FN16 새 격리 PG 실제 시험 — 첫 실행 결과

2026-10-27 / Main 어울 / **SETUP_FAILED**. 실제 반출 기능 검증은 미완료다.

## 실행 후보와 자원

- branch `codex/av3-stage-b`, exact SHA `226e77016b84bd93d1eae4b43e3b6e760634d89e`. 새 private Git clone/detached·tracked clean, 원격 URL 및 lockfile 일치를 확인했다. 서버 source patch/복사·정식 migration 적용은 하지 않았다.
- owner `AV3_FN16_SELECTED_ARTIFACT_EXPORT_QA`, instance `7d9f6326b25e54366730483f04bb4e30`.
- 실제 생성 확인 `2026-10-26T21:43:13.247Z`, 종료·정리 결과 `2026-10-26T21:43:21.734Z`. 첫 준비부터 최대30분/외부 timeout 경계 안의 실행이었다. root 최초 생성 시각을 별도 출력하지 않았으므로 위 생성 확인 시각과 같다고 주장하지 않는다.
- network ID `16f82de08286ce7368d35dc1c5595da72cf936ee5400e3afe857718ac0109688`.
- PG ID `7e94c02422b041c6ff319658c2ec0d509900d139deb76a3352f4134be3f15768`.
- Node ID `97505d65d7c47a5d4ee6bebb66d680eb8ed4bc33c638edde805c74061b2b7935`, 실제 Node `v24.21.0`.
- image ID·label·daemon·mount/read-only·tmpfs·host publish 없음·새 internal network를 대조했다. 세부 등록은 [사전 등록](FN16_ISOLATED_PG_PREPARATION.md)이다.
- source manifest는 tracked2635파일, SHA256 `d8854e80e2873f95164693539b33927fda53b5e1a9dd1f1c1cd59854aa59db76`이었다. 비밀 값은 출력하거나 이 문서에 기록하지 않았다.

## 실제 실패와 검증 범위

Main 실행 exec d6687f→5287→240d25는 exit1이다. Node helper의 `--execute --bootstrap --config /qa-config/run.json`에서 다음 안전 진단이 나왔다.

```json
{"kind":"FN16_SELECTED_EXPORT_ISOLATED_FAILURE","phase":"BOOTSTRAP","code":"FN16_QA_UNCLASSIFIED_FAILURE","pgCode":null,"exitCode":1}
```

config/source 검사를 거쳐 bootstrap 호출에 진입했지만, 내부 어느 SQL/연결 단계에서 실패했는지는 진단이 충분하지 않아 **미확정**이다. 새 DB의 역할/schema 적용 일부가 수행됐는지도 확인하지 못했다. SQL 실행0·고정51+0043 성공·실제 RLS/FK PASS로 표시하지 않는다. 새 일회 cluster는 회수되어 지속하지 않는다.

workflow의 합성 로그인·정책·파일 업로드·문서 저장·반출 POST·실 COMMIT replay·별도 연결 사본 조회는 **NOT_EXECUTED**다. Windows unit/API/합성 App 성공과 실제 PG 성공을 혼동하지 않는다. 전체 FN16/UI14/Stage 및 작업계획은 미완료다.

## 정리와 다음 조치

외부 소유 driver는 성공·실패 공통 finally에서 등록 ID·label·image/네트워크를 확인하고 Node/PG·빈 internal network, 소유 보호 파일 및 새 tracked-clean checkout을 회수했다. 최종 결과는 `failure:true,cleanupFailure:false,formalDbChanges:0`이었다. 별도 exec **23bfd7**에서 정확 Git/config 경로2곳 부재, 등록 owner의 container/network 출력0을 확인했다. 정식 개발 DB/기존 서비스·실제 Secret·인증서·Agent 변경은 없다.

같은 단일 구현 담당자에게 bootstrap 세부 phase·허용된 오류 종류/고정 코드·message를 제외한 알려진 파일/행 진단을 보완하도록 배정했다. 원인과 최소 수정·검수를 먼저 확보한다. 동일 후보를 무작정 재실행하지 않으며 다음 실행은 새로 비어 있는 등록 자원과 게시 exact SHA로 다시 대조한다. 과거 FN03의 소진된 1회 권한은 사용하지 않았다.

## 첫 실패 이후 안전 진단 보강

같은 helper/unit 2파일에 bootstrap 하위 phase, 고정 오류·허용된 오류 종류/node code 및 알려진 helper 파일명/좌표만 추가했다. 원문 message/SQL/DSN/credential은 출력하지 않는다. 첫 독립 검수의 cleanup 성공 후 원 phase 오분류 I1은 실제 finally 소비선 반례 RED 뒤 최소 복구로 보완했고 scoped C0/I0/M0다. Main 8a633c의 순수 진단10 PASS(1235.0823ms) 후, 최종 변경 가지 d42cc8의 cleanup 관련3 PASS(795.5693ms)·type/diff0을 확인했다. 이를 최종12개 단일 실행으로 합산하지 않는다. 시간 제한·고정51·0043 hash·integration은 바꾸지 않았다. 첫 실제 bootstrap 실패의 근본 원인은 아직 미확정이며 이 소스 보강 자체는 실제 PG 재실행/PASS가 아니다.
