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

## 두 번째 실제 시험 — 연결 단계 분리

진단 후보 `4cfc740d02915e883842a3f1c94a3bed74a554cf`의 새 instance `b85ddb15599656aa0f0add5d630c5bb0`는 21:54:02.603Z 생성 확인 뒤 21:54:11.354Z 실패·정리 결과를 냈다. 정확 진단은 `BOOTSTRAP_IDENTITY / FN16_QA_CONNECTION_TIMEOUT / Error / pgCode:null`, cleanupFailed=false다. DB identity 연결이 끝나지 않아 이후 역할/schema·실제 반출 workflow에는 도달하지 못했다. 첫 실패의 SQL 진행 상태까지 소급 확정하지 않는다. 원 command exec1bb561→50702→882131은 exit1, 외부 cleanupFailure=false다. 이 후보는 source2636파일·Node24.21.0이었으며 manifest SHA는74d45d0bd95a0e39ad2a20fd4ccfd948a71dfee65d7841d0f008fd554dfaed26이다. PG063f378bac5f0ebc207715477507213a132833316452eace32f63712f335c751, Nodeb13dab93cbad02c6852096b97bb49eb85aadd67d3026b1a23018ce1dfb21b033, network499a9b58cc50d236086bf8b48bcf0af64b49a44dbdc42711d87101e0cd952d0c는 회수했다.

같은 bootstrap을 세 번째 반복하지 않는다. 다음은 동일 등록 신규 자원의 DNS/TCP/PG listen 상태만 진단하는 최대2분 시험이며, 제품 SQL·사용자·정책·원문·반출 생성은0이다. timeout·합격 기준 변경 없이 원인을 분리한다. 새 Git/config 경로는 만들지 않고 새 network/PG/Node만 생성·소유 검증·정리한다. 기존 서비스·정식 환경의 네트워크 설정은 변경하지 않는다.

## 별도 연결 진단 — DNS 정상 / 컨테이너 간 TCP 미연결

같은 bootstrap을 세 번째 실행하지 않고, 제품 source/SQL/사용자/정책/원문 없이 새 PG/Node/internal network만 생성해 연결을 분리했다. instance는 `5f502b03c88fe5363cdafcf0606ba65e`, 원 명령 exec50097f→9578→4d7559다. 진단 실행은 exit0으로 끝났지만 **연결 검증은 FAIL**이다.

- PG IP `172.22.0.2`, Node IP `172.22.0.3`, network Options `{}`, PG listen `*`·5432 및 local ready.
- DNS lookup은 정확 PG IP/family4를 반환했다.
- hostname TCP는 TIMEOUT/4002ms, 직접 IP TCP도 TIMEOUT/4003ms였다.
- network `598818f2ea465494dca934eeee871405610ed874597e5660149ed0638d9b1d35`, PG `d6d0bdb8c531de2def19eb8646d4c31737c425160907ee707e8bd603aa34bdc3`, Node `0476123f17cd456fe6ae1d01f2bbea0456f5af825bcfd9eb5b5d6511be901030`만 사용했다.
- elapsed11702ms, 종료 `2026-10-26T21:57:09.809Z`, 외부 cleanupFailure=false. 별도 **79ff29**에서 등록 경로2 부재 및 owner container/network 출력0을 확인했다.

정확한 호스트 네트워크/방화벽 원인은 미확정이다. PMO에 신규 internal bridge의 컨테이너 간 TCP 원인을 읽기 전용으로 확인하고 허용 해결안을 지원해 달라고 요청했다. 기존 설정 변경·host network/공유 namespace로의 우회·timeout 연장·검사 생략은 하지 않았다. 이 경계만 별도 미해결로 두고 계획의 독립적인 미완료 기능 선정·구현은 계속한다. 정식 WSL 기능 검증/사용자 인수 또는 전체 FN16 완료로 표시하지 않는다.
