# FN02 저장 보호 후보 첫 격리 검수 — 한정 PASS

## 범위와 판정

기존 Stage B/FN02의 미적용 SQL 컴파일·graph/form/숫자/검토 함수 대조다. 실제 양성 적용·직접 DML 위조/양방향 COMMIT·경합·초기 createProject 실행·정식 DB/served·전체 FN02 완료를 검증하지 않았다.

최신 판정은 시도5의 한정 PASS다. 앞선 4회 실패·미실행과 각각의 source/지문은 이력으로 보존한다. 미적용 파일을 정식 runner/DB에 등록하지 않았다.

## 시도 1 — 원 실패 보존

- 실행 source: `b6c6a00306888d6a2a731fb1e5bf1c62c88c32da`, 새 WSL Git exact/detached clean. Node24.21.0 SHA256 `7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c`.
- pending SQL: `F70F838E11293C5BA71255F762DCA7C42BB81DD00D9ED5D65CEE66C2BB399B89`. 등록 53개/순서/지문은 `EMPTY_APPLICATION_QA_MANIFEST.json`.
- 실제 명령: 등록 전용 경로에서 `ANVIL_FN02_QA_SHA=<위 SHA>`, `ANVIL_FN02_QA_SQL_HASH=<위 소문자 지문>`, 원격 현재시각+20분의 `ANVIL_FN02_QA_UNTIL` 아래 `node --experimental-strip-types scripts/qa-fn02-empty-application.ts --run`.
- 종료 1, `phase=CANDIDATE_SCHEMA`, `failure=FN02_QA_ASSERTION_OR_UNCLASSIFIED_FAILURE`, `cleanupFailure=null`, `diagnostic=null`, `report=null`. 함수 시험에 도달하지 않았다. 당시 단계가 초기 guard/hash와 manifest 비교를 함께 포함해 직접 원인은 미확정이다. psql 오류가 없다는 사실을 전체 SQL/COMMIT PASS로 승격하지 않는다.
- 생성 ID: PG `a81c79f179ff7c364821c80c9f5545a0b3f691c21b3e8d224b13bbc8ec6d169d`, network `70795ad257c524133369a14b5a403d8ff4fe2c185bc95ea806adb5004d9943a6`, instance `2c5007b4aafa2b0a3900c89ddd13434c`. exact ID/label/image/mount/port 검사 뒤 finally 회수했다.
- 독립 SSH 읽기 exit0: 등록 PG/network/tmp 이름 잔류0. 정식 PG의 exited/Runningfalse/Pid0/ExitCode0/Started2026-10-18T15:25:12.085069883Z/Finished2026-10-19T12:56:52.490883698Z·image594290·127.0.0.1:5546 정의가 사전과 동일했다. 새 Git checkout/의존성은 원인 재현용 보존 중이며 아직 경로 전체 잔여0이 아니다.
- 원인 조사: 로컬 manifest의 ASCII/locale 정렬 차이는 동일이라 기각했다. SQL·합격 기준을 추측 수정하지 않고 단계 세분화/비밀 없는 manifest ID·checksum 차이/에러 source 행만 추가했다. 이 진단은 원 실패의 삭제/통과 전환이 아니다.
- 준비 범위 예외: `npm ci --ignore-scripts --no-audit --no-fund`의 명시 cache 인자를 누락했다. 기본 npm cache 사용/실제 쓰기량 미측정이며 공유 cache는 임의 정리하지 않았다. 실제 Secret/설정·정식 DB·서비스 변경0. 이미 완료한 설치는 재실행하지 않는다.

## 다음 확인

같은 SQL/53개 기준의 진단만 보강한 exact Git 후보를 새 빈 PG로 한정 재현하고 실패·정리까지 기록한다. 직접 원인 확인 전 조건 완화나 SQL 변경은 하지 않는다. 본문 작성 시점에 재현은 미실행이다.

## 시도 2 — 직접 원인 확인, 함수 시험 미도달

- source `36ff01f96d5b666ea5c4981fdb6af0c82819a98c`, SQL/53 기준 불변. 새 PG `452000ffb7f36c40f5bbf6caf58aa4d7de052adba5c483347af2cdfb96e660f6`, network `b8d81d4b189389ee1294d2309ad7291a8e8db2c78099ea48d2906fd3c629160f`, instance `3daf7b48642930038c3734dff5be2f9f`.
- 실제 exit1, `phase=MANIFEST_COMPARE`, `ERR_ASSERTION` source74, `actualCount=expectedCount=53`, `mismatches=[]`. 앞선 53개 새 SQL 실행/COMMIT과 초기 guard 함수 정의 동일 검사는 통과했으나 함수 시험은 아직 미도달이다.
- 직접 차이: DB 조회는 `0003_documents` 다음 `0003_document_stage_bindings`, Node locale 정렬은 그 반대다. **DB 조회 순서와 명시 적용 순서를 혼동한 실행기 비교 오류**다. 로컬 정렬 가설 기각은 로컬/WSL/DB collation이 같다는 증거가 아니었다.
- finally 회수와 별도 SSHexit0로 두 등록 자원/tmp 잔류0을 확인했다. 같은 SQL로 실제 함수 PASS를 선취하지 않는다.
- 보정: 명시 실행 manifest 순서는 그대로 보존한다. 조회 집합은 양쪽의 동일 ASCII ID 정렬 후 정확53/중복0·ID/checksum을 대조한다. 잘못된 hash·누락·추가·중복·미지ID와 기준 자체 변조는 여전히 거절한다.
- 신규 helper 부재 RED108.4256ms 후, 기존 locale 방식 반례 1FAIL/2PASS141.401ms → 보정 뒤3PASS125.3112ms/type0. 합격 기준/제품 SQL은 변경하지 않았다. 후속은 이 직접 원인 보정만 반영한 exact 후보의 한정 실제 검수다.

## 시도 3 — 정렬 오류 해소, 정상 graph 실패 발견

- source `58ea594d374083c0d3a10e39988c9088a414a907`, SQL F70 유지. manifest 집합 strict 대조를 통과하고 함수 시험까지 진입했다.
- 실제 exit1/FUNCTIONS, 자식 `GRAPH/caseIndex0/ERR_ASSERTION`. 앞선 canonical의 두 세션 설정 루프를 지나 첫 정상 내장 graph의 SQL 결과가 JS의 true와 달랐다. 전체 함수 검수 PASS가 아니다.
- PG `2cb154b1cff732ad8b9e1cb390d1e5ae635d7a3fd9c41ec8e6f08593e0357ffa`, network `43fe7506b7712413d1058524424619151c20c0b7c72474a0b10b823af3b4a171`, instance `f70ba4321e280c1ac198da3e99e2433a`: finally 회수 및 독립 SSH exit0의 등록 PG/network/tmp 잔류0.
- 직접 원인은 아직 미확정이다. 독립 source I1 후보는 조건 함수의 인자 `value`와 `jsonb_array_elements`의 기본 출력 열 `value` 충돌이다. 원 `WHEN OTHERS`가 내부 42702를 false로 숨길 수 있으며 첫 SEQUENCE의 정상 조건이 해당 조회를 소비한다.
- 진단 후보 SQL `49401D4DB4E046A82A0955DD74A999208AA75A20AED8F19775EEC2DD405EE048`: 4개 helper가 자료 오류(class22)만 false로 처리하고 내부 SQL/프로그램 오류는 드러내도록 좁혔다. canonical의 지원불가 3예외는 class22로 명시했다. true 조건/그래프/검토 기준은 그대로이며 이 시점에 별칭 수정은 아직 하지 않았다. 새 manifest는 같은53개/마지막checksum만 갱신했다. 원 F70와 3회 실패는 이력이다. 직접 원인 재현 전 실제42702라고 확정하지 않는다.

## 시도 4 — 내부 모호한 참조 42702 직접 재현

- source `30445def4c45092195430e6ad59eaa1baa75a1ce`, 진단 SQL49401D4D. 실제 새 빈53SQL/함수 실행은 exit1, `GRAPH/caseIndex0/code42702`였다. 이전 false와 달리 내부 모호한 참조 오류가 드러났다. 함수 양성/전체 PASS가 아니다.
- PG `c8188909719c57288597ff1494cc35825480383b3512ee5b43eb64bf718e608a`, network `bc50cbb60f321245cf341f21b0914be25078712728d3d0def7bbe814c9df0e8e`, instance `517bb6150979fcd61aa9f9d5c736b6af`, `cleanupFailure=null`. 별도 잔류 확인은 후속 기록한다.
- 정확 보정: condition 함수의 SRF 기본 출력 열 `value`와 입력 `value`가 충돌하지 않도록 `node_row(node_json)`/명시 열 참조만 변경했다. SQL 새지문 `E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6`. 원래 조건·graph/form·검토/합격 기준 불변이며 자료 예외만 false/내부 오류 노출 정책을 유지한다. 이 직접 SQL RED 뒤 같은 조건의 실제 GREEN 여부를 아직 확인하지 않았다.

## 시도 5 — 실제 SQL RED→GREEN / 한정 PASS

- source `d9a56d1aca1bbe55180cf82e655b10208a5d87be`, SQL E9DEE26A, manifest rows hash `261620dbbe23286752b329aacb8c71b34260f9a98cc914b69a3ed883670f85d0`. 최초와 동일53개/고정 실행 순서이며 마지막 후보의 오류 보정 지문만 변했다.
- 동일한 전용 새 빈 PG15/image594290·Node24.21.0에서 실제 exit0, `status=PASS/phase=DONE/failure=null/cleanupFailure=null/diagnostic=null`.
- 실제 확인: 53 SQL 컴파일·COMMIT/정확 ID·checksum, 초기 `guard_initial_project_methodology` 함수 정의 hash 전후 동일, 비관리자 app 접속, canonical 35벡터×세션0/3=70대조·공식8양식/3방법론, 정상3/변조14의 graph17 JS/PG 결과 일치, 검토 항목 변조4 거절, 기준 snapshot 및 v/VT/NBSP 구분·unsafe integer 거절.
- 이는 actual42702 RED 뒤 동일 함수 시험의 GREEN이며 기대값·합격 기준은 느슨하게 바꾸지 않았다. 모든 숫자/그래프 조합을 전수 검증한 것은 아니다.
- PG `d3fe48191d89f531a887f09bba4ab35da00ef273cc736c8dd33fbec3c1fd9849`, network `bdd13853d0fb5a7b0af01ca64ea0a8075fb82160e5aaa04b49fd7aeac7b07d10`, instance `448806733a0ff97121f825525f9c3d26`, exact 회수. 시도4 자원 부재도 시도5 시작 전 별도 확인했다.
- 종료 정리: QA Git 경로 exact d9a56d1a/clean·UID1000/nonlink·열린 process0·파일별 hash와 symlink 내부 대상 확인 뒤 7211파일/734디렉터리(루트 포함)/13내부 symlink·327272797 bytes를 비재귀 회수했다. 소스와 증거는 private Git에 보존돼 복구 가능하다.
- 별도 SSH 읽기 exit0: 등록 두 경로·PG/network 잔류0. 기존 정식 PG의 동일 fullID/exited/Runningfalse/Pid0/Exit0/StartedAt/FinishedAt/image/127.0.0.1:5546 정의 및 Windows3830/5546 listener0 유지. 기본 npm cache의 실제 쓰기량 미측정/임의 삭제0이라는 준비 예외는 그대로 보존한다.

## 남은 실제 기능 검수

다음은 같은 승인 FN02의 실제 인증 API→확정 방법론→명시 적용·영수증/replay·적용본 재조회와 row-only/receipt-only COMMIT·직접 DML 위조/7원장·동시 요청·초기 createProject 회귀다. 첫 함수 QA를 이 결과로 승격하지 않는다. 이 핵심 저장 흐름을 검증한 뒤 기존 UI03의 별도 적용/미확인 명령 보존/재조회까지 연결한다.
