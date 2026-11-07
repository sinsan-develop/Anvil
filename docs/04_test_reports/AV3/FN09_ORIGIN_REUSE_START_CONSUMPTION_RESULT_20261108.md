# FN09 원자료 재사용 START 소비 구현·검증 결과

작성: 2026-11-08 / Main 어울 / 구현: 기존 Primary

## 판정과 범위

기존 승인 원자료·명시 APPROVE를 같은 인증 거래의 exact8 START 소비, 기존 queue/material/outbox 저장, 원 승인 ID의 v3 결과 재조회와 UI08 읽기 전용 표시에 연결했다. 소스·합성 검증 결과이며 실제 PostgreSQL 적용·권한·동시 잠금·서비스·Agent 실행 완료가 아니다. 전체 WORK_PLAN은 미완료다. 최종 독립 인수와 Git 통합 결과는 WORK_STATUS에 추가한다.

- 통합 기준: main `7d51ce10594df663ddf13cba4a65e860d838d1e2`.
- 작업 브랜치: `codex/av3-fn09-origin-consumption`.
- 부모 채택 문서 SHA256: `1eabb2ad93aa87ccb61865249e88953d8400229de92299aa24dd3bb046e96522`.
- 구현 WI: `docs/work_packages/FN09_ORIGIN_REUSE_START_CONSUMPTION_IMPLEMENTATION_WI_20261108.md`, SHA256 `0441d0096248c4de40afb269fa4ae68c474786caf5294fb252d3cd285cfca83b`.
- 최종 제품13 원본 manifest: `ad3bb40ce58d42822cb78da125ab85fc71163dd929b8c5a7f68d3e11b28325e4`.
- 허용 제품13·시험7 원본 manifest: `7fb3d02ea9f1d948220c22a7eec1cbd827dd2d1fd4b7576d1e1e21da5bd42870`.
- manifest 형식: 경로 정렬 `{path,bytes,sha256}`의 compact UTF-8 JSON, BOM·마지막 개행 없음. 로컬 검증 원본 지문이며 실제 서버 checkout 검증 지문으로 주장하지 않는다.

## 구현 결과

1. 원 요청·명령 hash, 같은 actor/client/Session·제어 세대·정책, 원 S/Q와 P2 결정을 실제 보호 클래스와 private lease로 묶었다. callback·거래·기한이 끝나면 원문 접근 권위를 재사용하지 못한다.
2. 기존 저장량 reserve→receipt/승인 소비 CAS→execution/grant/usage/writer/queue/material/outbox→settle을 같은 거래에서 연결했다. 신규 원장·전송 버튼·자동 재송신을 만들지 않았다.
3. 기존 0082 pending SQL에 목적별 계상·역완결을 작성했다. 앱 invoker는 비공개 저장량 원장을 직접 읽지 않고, 기존 definer 최종 guard가 이번 거래의 신규 소비에만 원장·현재 Tx·봉인·최단 기한을 강제한다. 과거 완결 검산은 시간 독립적으로 보존했다. 실제 SQL·GRANT 실행은 하지 않았다.
4. 기존 GET은 exact outcome 6필드와 false 표식 두 개를 반환한다. UI는 원 v1 봉인·APPROVE·CONSUMED·원 exact8 hash를 확인하고 합성 저장 결과만 표시한다. 유효 queue fullref의 실제 저장행 동일성은 서버 검산이며 UI 독립 재구성이라고 주장하지 않는다.
5. 신규 역방향 import 3곳의 TDZ를 지연 import와 기존 private receipt 상태로 해소했다. 원 prototype pin은 그대로 유지하며 새 await 전후 query·주체·원명령·실제 lease/clock/Tx를 검산한다. 공개 setter·caller 검증 callback은 추가하지 않았다.

## 확인한 검증

재실행·부모/하위 사례·중복을 합친 총합으로 보고하지 않고 각 실제 실행 묶음의 결과를 구분한다. 선택 실행의 세부 명령이 복구 문맥에 남지 않은 경우 도구 기록을 참조하며 사후 구성한 명령을 실행 사실로 쓰지 않는다.

| 검증 | 실제 결과·증거 | 증명 범위 |
|---|---|---|
| 실제 보호 클래스 정상 소비→GET v3 | 변경 후 `cac187/session99606→ec579a`: 1 PASS, skip0, exit0; 사례 30437.4639ms | 합성 DB/FS·정지 합성 시계. 실제 30초 수명 보증 아님 |
| 결정·교차 후보·최종 await 교체·rollback·응답 유실 | `764766/session4572→514cbf`: 5 PASS, skip0, exit0 | 메모리 SQL·원 packet 유지 |
| 승인 후 취소·회수·만료·xid/query 변화 | `18031f/session92708→517f2d`: 7 PASS, skip0, exit0 | query 교체로 rollback 불명이면 503/reconcile-first 유지 |
| COMMIT 후 응답 폐기·다음 Tx 원문 차단·별도 승인 동일 실행 ID | `3d9b45/session69642→0134b9`: 2 PASS, skip0, exit0 | 원 packet 보존·GET·동일 원명령 POST replay의 queue ref/도메인 수 불변 및 다른 승인 직렬 경쟁. 전체 영수증/예약 검산은 아래 강화 시험으로 별도 확인 |
| 원 exact8 명령의 성공 후 명시 POST replay 강화 | `cf46df/session25133→454bf8`: 1 PASS, skip0, exit0 | 원 result·C/A/U·모든 저장행/예약·원 S/Q 불변, reserve/settle 추가0·실 replay branch/basis0·registrar 조회 검산 |
| 호출 만료·내장 preabort·await 중 abort | `3d675b/session97911→a53ffd`: 4 PASS, skip0, exit0 | 원 getter/호출 수명 검산 |
| 최초 clock 실패·저장량/COMMIT 불명 | `c15d7e/session70190→1258de`: 7 PASS, skip0, exit0 | lease 폐기·원 결과 불명 보존. 실제 DB 아님 |
| SQL 형상·계상·ACL·현재/과거 경계 | `cd0552`: 39 PASS, skip0, exit0 | 정적 소스·순수 모형. SQL 설치·trigger 실행 아님 |
| UI08 보호 조회·표시·변조·scope·UNKNOWN 보존 | `f75406`: 40 PASS, skip0, exit0 | 메모리 Vite/React, 새 POST0. 실제 브라우저 아님 |
| TDZ 직접 import | `505d2e` 1 FAIL→`ba1e04` 1 PASS, skip0, exit0 | 실제 Node 모듈 로딩 |
| 새 await·private receipt 위조/복사·회수 | `c3f642`: 1 PASS, skip0, exit0 | genuine 객체 불변과 보호 검산 |
| 기존 START/SEND·ledger·basis 인접3 | `38ea4d/session22700→461888`: 93 PASS, skip0, exit0 | 수정 후 인접 회귀 |
| 원 Context 전체 | `ec1751/session49601→676fe3`: 3 PASS, skip0, exit0; aggregate8430.0012ms | 원 timeout10000ms·기대값·시험 지문 불변, 단독1회 |
| 최종 타입 | Main `5db9ef/session26508→e2326b`: exit0 | 수정 후 타입 검사 |
| UI 메모리 빌드 | Main `b41e26`: exit0, 518 modules | UI 불변 이후 재사용, 파일 출력 없음 |
| diff | Main `c25a2a` 등 exit0 | 줄끝 변환 안내와 실패를 구분 |

확인된 정확 명령:

```powershell
node --experimental-test-module-mocks --test --test-name-pattern='원자료 P2 APPROVE의 exact8 START는' tests/unit/FN09/execution-start-origin-routes.test.ts
node --test tests/unit/FN08/execution-start-material-registration-schema.test.ts tests/unit/FN13/project-storage-quota-schema.test.ts
node --experimental-test-module-mocks --test tests/unit/UI08/origin-reuse-approval-read.test.ts tests/unit/UI08/approval-api.test.ts
node --experimental-test-module-mocks --test --test-name-pattern='소비 모듈은 runtime 정책' tests/unit/FN09/execution-start-origin-routes.test.ts
node --experimental-test-module-mocks --test --test-name-pattern='소비 receipt 지연 import' tests/unit/FN09/execution-start-origin-routes.test.ts
node --experimental-test-module-mocks --test --test-name-pattern='원자료 exact8 START 성공 뒤 명시 동일 packet' tests/unit/FN09/execution-start-origin-routes.test.ts
node --experimental-test-module-mocks --test tests/unit/FN08/execution-command-ledger.test.ts tests/unit/FN08/execution-instruction-queue.test.ts tests/unit/FN09/execution-start-origin-queue-basis.test.ts
node --experimental-test-module-mocks --test tests/unit/FN08/execution-start-context-source.test.ts
npm run typecheck
node --input-type=module -e "import {build} from 'vite'; await build({configFile:'apps/web/vite.config.ts',build:{write:false}})"
git diff --check
```

## 오류·미검증 보존

- 최종 독립 대조가 동일 원명령 POST replay 부재를 지적했지만 Main d37a48의 원문 재확인에서 기존 응답폐기 시험 끝의 동일 packet POST·200·queue ref/도메인 수 불변 단언이 확인됐다. POST 자체가 없다는 판정과 Main 설명을 정정한다. 전체 원 result·C/A/U·reserve/settle·원 S/Q까지 추가 효과0을 확인하는 별도 강화 시험은 cf46df→454bf8의 1 PASS로 종료됐다. 제품 변경은 없으며 원 오독 지적은 철회됐다.

- 초기 미구현 정상/화면 RED와 quota fixture Date·SQL 인자/내부 관계 보완을 구분했다. 보호 source/완료 기준·timeout을 완화하지 않았다.
- 독립 검수에서 발견한 앱 비공개 원장 조회 Important와 정상 sourceScope 과다 거절 Important를 보완하고 재검수했다. 기존 C0 판정은 발견 시점에 I1로 정정해 이력에 남겼다.
- TDZ 최초 인접 실행 `3a71e3/session77555`의 전체 exit·집계는 출력 회수 실패로 미확인이다. 이후 수정된 동일 목적 인접93 PASS가 과거 기록을 덮지 않는다.
- frozen actor 정리 코드의 재대입과 provenance 원조회 누락은 시험 준비 오류로 보존했다. 제품 오류 반복 횟수와 섞지 않았다.
- 실제 DB schema/함수/권한/기한·trigger/동시 잠금·프로세스 재접속, 서버 반영, 실제 browser/Agent, 사용자 인수는 NOT_RUN이다. 합성 COMMIT/rollback을 PostgreSQL 결과로 승격하지 않는다.

## 복구와 후속

최종 통합 전에는 같은 브랜치의 게시 checkpoint와 기준 main으로 변경 hunk를 비교한다. 정상 통합 후 복구는 해당 PR revert를 사용한다. 미적용 SQL이므로 실제 DB 복구·권한 변경은 수행하지 않는다. 최종 commit·PR·병합 후 smoke·정리와 다음 미완료 업무는 WORK_STATUS에서 이어간다.
