# FN06 native 준비 r2 A — HUMAN 원명령·저장 source 검수 결과

2026-11-02 / Main 어울 / **업무A source 검수·통합 · 전체 native 준비 기능 미완료**

## 범위와 기준

채택 r2 A SHA256 `5C4AF434D5367CDDB378238247056DD536F05CC6AA6AAB10DEE33DC99B2E3085`, 직접 승인 `FN06_NATIVE_PREPARATION_R2_A_SOURCE_APPROVAL_20261102.md` SHA256 `9B10475C96E993112B104F1813A86B1B2A2E401429CBED293100ACA036E17567`, WI SHA256 `3905A46EEE54AF75C1971C66A51A8D1AB5E6F2EA439462F4192F53FDA151C1F6`를 적용한다. 시작 branch는 `codex/av3-stage-b`, HEAD는 `c17ea282b6b3e7bf0abd81f70f30193076b89c73`다. 보호 미추적3개는 보존했다.

기존 Primary가 업무A의 제품·시험 14경로를 작성했고 Main은 제품을 직접 수정하지 않았다. 업무B connector 부분4경로는 별도 진행 중이며 이번 검수·commit 대상에 포함하지 않는다. 업무A source commit은 `8cdb7f3f72011424182fd4de4669b824ae52b00d`이며 시작 통제 commit의 직접 자식, 정확14경로·415추가/10삭제다. Main `f6b91c`에서 14경로의 raw blob과 staged blob 일치를 확인했다. 0071의 향후 CRLF 변환 경고는 있었으나 현재 원문/인덱스는 일치하며 설정을 바꾸지 않았다.

변경 경로는 app.ts, access/project-command.ts, approvals/approval-input.ts·project-approvals.ts, executions/project-writer-authority.ts·native-preparation-input.ts·native-preparation-routes.ts·native-preparation-store.ts·project-native-preparations.ts, runtime/native-preparation-authority-v1.ts, 0071.pending 및 위 선정3시험이다. 정확 저장소 루트 경로와 diff는 해당 commit의 14경로로 고정한다.

## 구현한 연결

- 명시적으로 주입한 source에만 새 HUMAN options·준비 명령·고정 조회를 등록한다. 기본 서버는 미등록, 공급자 부재는 거절한다.
- 현재 로그인·OWNER·단독 제어·명시 정책과 정확한 일회 승인을 검산해 불변 intent를 만든다. 실제 공통 command/receipt/audit→명시 writer reserve→분리 authority/events의 INSERT·재조회가 같은 transaction에 연결된다.
- 기존 D1/v1과 writer 원형을 보존한다. 새 operation의 baseline은 정확한 원 head 한 개이며 다른 operation의 기존 거절은 유지한다. 새 authority·사건의 미래 hash를 원 intent/영수증으로 역참조하지 않는다.
- 같은 원명령 replay·COMMIT 결과 불명·INSERT/CAS 실패 rollback·한도 포화·정확 승인 자기소비를 구분한다. 역사 조회는 저장 당시 parent/원 command·receipt·audit·소비 관계를 복원하고 fresh head/현재 사업 기한을 소급하지 않는다.
- 새 `0071_native_preparation_authority.sql.pending`은 미적용이다. 새2표·지연 완결·원 증빙 역검산·유한 합산 한도를 작성했으며 기존 SQL을 수정하지 않았다. 업무B 사건은 아직 `AUTHORITY_CREATED` 외 거절하는 부분 source다.
- options의 원 작업 예산은 기본 10초 이하다. supplier에는 query 전용 수명 포트를 전달하고 만료 뒤 원 client 사용을 차단한다. 이미 진행 중인 query는 정착 전 lease를 반환하지 않으며 미정착 supplier를 종료 성공으로 표시하지 않는다.

## 실제 실행한 선정 검증

Main 최종 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/unit/FN06/native-preparation-authority-contract.test.ts tests/unit/FN06/native-preparation-store.test.ts tests/unit/FN06/native-preparation-routes.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

- `26e88c` 최종 신규3파일 **23PASS / FAIL0 / SKIP0 / 7023.9787ms**. 같은 session64578의 최종 회수 `1412e2`에서 type·diff exit0과 동결 지문을 확인했다.
- 앞선 `f0d272`는 당시 신규12와 직접 인접 기존 writer40·승인5를 포함한 **57PASS / 7528.9775ms**, `0f1505` type·diff0이었다. 이후 변경은 coordinator/store·신규 시험·0071에 한정했으며 불변 인접45건을 불필요하게 반복하지 않았다. 57과23을 합산해 서로 다른 80건으로 보고하지 않는다.
- 승인 누락/다른 명령/다중 소비, 원 head/CAS 불일치, 재봉인한 parent·receipt·감사/소비 변조, 만료 뒤 역사/replay, options 만료/정상 및 늦은 query·진행 중 query 정착/rollback·lease 반환·unhandled rejection을 선정했다.
- SQL 검사는 정적 구조·접점 검사다. fake PoolClient/Fastify inject는 실제 query 호출선을 시험하지만 실제 PostgreSQL 실행·SQL 구문·RLS·OID·동시성 검증은 아니다.

## 발견·보정과 독립 검수

첫 동결 C0/I5는 SQL의 native-only 후속 용량 검사와 원 증빙 역검산 누락, 서버의 짧은 승인 기한·options 기한·역사 원 증빙 관계였다. 첫 보정 재검토에서 5건은 해소됐으나 timeout 뒤 supplier가 반환된 client를 쓸 수 있는 추가 I1이 생겼다. 같은 Primary의 두 번째 보정과 새 반례로 수명 보호를 추가했다. **두 번째 scoped 독립 재검토는 추가 I1 해소·C0/I0**이며 시작·끝 지문이 일치했다. 마지막 검토는 해당2경로 보정에 한정하고 나머지12경로/SQL을 반복 검토한 것으로 보고하지 않는다.

최종 주요 지문: coordinator `03B55486F65F0957FA62728551E24A083BC2D9B39FFCE9CAD71CC9393D8D560A`, store 시험 `A264E647C2358103A2B666098C69945210A129BEE423E3EBC08E5429B1CD23F0`, 미적용 SQL `2FEBD8AD521CD212BC6263CD8EFA50036E23277380A2152C3422693C2376BF12`. 독립 검수는 읽기/정적 검토이며 실제 실행 검증은 위 Main 선정 명령으로 분리한다.

기능 RED와 준비 오류를 분리했다. 최초 options404·baseline 승인412, 새 preparationIntent 필드 연결, 짧은 승인/재봉인 역사 및 늦은 query 반례는 실제 연결 결함이다. I4 첫 시험은 supplier 함수 자체 교체에 의한 조기503으로 기한 RED가 아니며, 동일 supplier 내부 시각 진행의 보정 후 GREEN·정적 근거만 주장한다. module 부재/작성 중 타입 진단은 기능 반례로 합산하지 않는다.

## 미구현·미검증·복구

**실제로 사용할 수 있게 반영된 서비스는 없다.** 이번은 승인된 source·미적용 SQL·합성 검수다. 업무B의 host current/challenge/consume·보호 delivery/local journal/factory 단발 소비·업무C 화면/승인 연결은 후속이며 전체 FN06/FN08/Stage/작업계획서는 미완료다.

실제 DB/권한·정책 부여·키·CA/TLS·서비스·OS/native/helper/compiler·Agent·실자료/백업 파일 조사·P03 R3는 실행하지 않았다. 실제 writer bootstrap issuer/물리 관측/강제·보호 credential 발급·내구 journal·factory·actual START/SEND/STOP/ACK·실제 회수와 사용자 인수는 미구현 또는 미검증으로 남는다.

복구는 검수된 source commit을 기준으로 정상 Git revert할 수 있다. SQL 미적용이므로 DB down/자료 삭제를 하지 않는다. 보호 자료와 별도 B 진행 파일을 되돌리거나 정리하지 않는다. main 병합·배포·완료 인수는 수행하지 않는다.
