# FN06/FN08 관측 HTTPS source 구현 검수 결과

2026-11-01 / Main 어울 / 기존 Primary 구현·독립 Reviewer 검수.

판정: 채택된 관측 HTTP wire와 실제 Node HTTPS 호출 코드의 source 단위를 검수했다. 실제 연결·실제 TLS·서버 저장·Agent 실행/전체 FN06/FN08/계획 완료가 아니다.

- 기준: 기존 branch codex/av3-stage-b, control d4f04ded8befe8e49429a7f45b4185270c7c9e21. 신산님 최신 직접 승인, 고정 후보A SHA62E9B2D3E6D36489C2D7769BD8158B80E737A86D9FAA97A6035163FB3F4A00B3 및 WI SHA8FAF945EF9E18CEB5A49F44C91EAEE956C39AA0C6225498E8C2BDBFB2EB35329를 적용했다.
- 변경: 신규 계약 codec과 HTTPS client가 정상 EXECUTION challenge/observations만 포장·검산/전송한다. 기본 driver는 node:https.request이며 import/생성 IO0이다. 기존 canonical target·proof8·서명 domain/바이트·nonce·opaque challenge ref를 유지한다. 서버 main/등록/모델 guard·provider claim·SQL·package/lock·기존 보호3은 변경하지 않았다.
- 권한·현재성·내구성/실제 공급자 관측을 생성하지 않는다. client ackAudited/writerReleaseVerified/actualExecutionVerified/executionAuthorized/dispatchPerformed는 false다. 기존 SYNTHETIC_ONLY 모델을 성공 응답으로 벗기지 않는다.

## 정확 변경과 최종 raw SHA256
| 경로 | SHA256 |
|---|---|
| contracts/runtime/execution-observation-http-v1.ts | 594C3B5E9084C014F3578616800FF507E255471ACFBB2502510D9B61A6FB27D9 |
| apps/connector/runtime/execution-observation-https.ts | F7508C83D088AF14B7448AACC39D29010D5C66FC106056780EE8D2659260584E |
| tests/unit/FN08/execution-observation-http.test.ts | C02EBF9222F24FF8085CC0F100BB02C3743DB2B5F29A65DFA2804DD2D45C4B64 |
| tests/unit/FN08/execution-observation-https.test.ts | F69F96DFE44708AC8EA1847862A6A4902751C88E5D92FC128B95239CC6BFB59B |

## 실제 검증과 한계
Main666571: 신규18+직접 인접11=29PASS, fail/skip/cancel/todo0,199.0508ms/native0. 관측 동결 검수 시점 root typecheck와 diff도 각각exit0이었다. 수행자2013b9의29PASS203.5865ms와 별도이며 합산하지 않는다. 독립 최종4파일 spec/품질 C0/I0다.

```powershell
& 'C:\Program Files\nodejs\node.exe' --experimental-strip-types --test tests/unit/FN08/execution-observation-http.test.ts tests/unit/FN08/execution-observation-https.test.ts tests/unit/contracts/canonical.test.ts tests/unit/FN08/execution-observations.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

합성 request/response 대역에서 정상 header/body·canonical/서명 바이트 불변, 중복/상이Host·Content-Length·Cookie/임의 인증·query/경로/권한종류/기한/버전/UTF8/BOM/JSON중복·크기·ACK hash/scope/순번·gap/개수, non200/redirect/단절/abort/timeout·늦은error/response·다른request 보존·원입력/식별 보존·자동retry0을 검산했다. 전체 deadline은 최초 최단 예산과 monotonic 경과를 함께 사용하여 벽시계 후퇴·timer 지연에도 연장되지 않는다. 자기 timer/abort·기능 listener를 회수하고 늦은 error를 흡수할 안전 sink는 권한/성공으로 해석하지 않는다.

실제 socket/API/TLS 왕복·서명 진위/키 생성·현재 등록/권한·영속 nonce/ACK·보호 원기록/서버 repository·실제 SDK/Agent/사용자 인수는 NOT_RUN이다. 실행하지 않은 서명 생성/검증 시험을 PASS로 표시하지 않는다. 기존 execution-client/proof의 키생성 인접시험은 제외하고 순수 canonical·메모리 observations만 실행했다. 새 QA파일/브라우저/서비스·실DB·권한·키·사용자/백업 자료 조사0, 수행 후 live session/timer/socket/QA0이다.

## 반례·보완
처음 신규module 부재2 loader FAIL은 핵심 사례 미실행 baseline이며 기능 오류로 소급하지 않는다. 실제 코드 반례는 원문 초과공백의 parse전 한도 누락, 재봉인 ACK cardinality 모순, 실제 driver의 표준 header와 reader 불호환, 벽시계 후퇴 시 최초 최단 기한 연장이었다. 각각 실패를 확인한 뒤 동일4경로에서 보완했고 합격 기준/기존 protocol·guard를 낮추지 않았다. WI 게시 전 경로 조회 부재1과 Main의 추정 파일 부재1은 준비 오류로 WORK_STATUS에 구분했다.

## 통합·다음·복구
Main은 exact4+작업계획·이 결과/WORK_STATUS만 기존 branch에 정상 commit/private push한다. 같은 Primary가 다른 FN14 Web7을 작성 중이므로 해당 변경은 이 checkpoint에 stage하지 않는다. FN14 Web 검수 전 통합/사용 가능이라고 주장하지 않는다. rollback은 이 논리적 source commit의 정상 revert이며 실환경 rollback 대상이 없다. main 병합/배포·force/reset·실제 자산 변경0이다.
