# FN02 저장 보호 후보 첫 격리 검수 — 진행 중

## 범위와 판정

기존 Stage B/FN02의 미적용 SQL 컴파일·graph/form/숫자/검토 함수 대조다. 실제 양성 적용·직접 DML 위조/양방향 COMMIT·경합·초기 createProject 실행·정식 DB/served·전체 FN02 완료를 검증하지 않았다.

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
