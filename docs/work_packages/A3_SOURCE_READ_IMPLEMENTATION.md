# A-3 읽기 관측 후보 구현 계획

> 작업자: Main 어울이 `superpowers:executing-plans`로 순차 구현한다. 독립 검수는 읽기 전용이며 code writer는 Main 한 명이다.

목표: UI11의 명시적 읽기 관측 요청/회수·보호 교환/permit·불변 보고 조회 후보를 승인 r2대로 연결한다. 실제 OS/소스 관측·Agent 실행은 포함하지 않는다.

구조: 기존 현재 HUMAN/등록/제어·정확 원본 선언을 소비하되 별도 SOURCE_OBSERVE_READ_ONLY 계약/4표를 둔다. 공통 strict wire→서버 명령/저장/교환→명시 UI 순서다.
기술: 기존 TypeScript/Node24·Fastify·PostgreSQL15 SQL 초안·React. 신규 의존성0.
설계: docs/contracts/SOURCE_READ_OBSERVATION_A3.md r2 SHA095B5FEFDBB2F903415AE404CC97D50FB585D1696FA6468CBFC91E805464D035.
권한: PMO AV3-PMO-A3-LOCAL-IMPLEMENTATION 2026-10-17T13:47:32Z, 실제 요청완료13:34:33Z/12분59초·이후 답변/중지/거절 부재를 확인한 정확 권장A 적용. 이 계획은 새로운 권한을 추가하지 않는다.

## 전역 제약·검수 초점

- 현재45 SQL·정식DB/등록 credential·실사용자 정책 불변. 새 SQL1/4표는 작성만, actual PG/정식 적용0.
- 상태조회 grants=[]/기존 HostProof parser·A-1 dispatch false 유지. P-256/key/token은 로컬 합성시험 메모리뿐, 보호 key/기존 token 접근0.
- native 파일/컴파일/OS·DPAPI/ACL·실source/Agent·서비스/Oracle/main 변경0. code/hash 적합은 실제 권한/OS 증명이 아니다.
- FILE≤200·비재귀 READ_ATTRIBUTES, scope≤256KiB/permit≤512KiB/report≤1MiB, grant≤2h/challenge≤2min/credential≤5min, 관측≤30초·시계오차30초/서버기한 무관용.
- 검수 초점1: 동일 source ref라도 경로 projection/hash 불일치·구정책/구등록은 시작0. scope/permit 음성→N1/N2.
- 초점2: 타purpose/유효서명 아닌 요청으로5회 잠금소진 금지. proof/교환 실패 음성→N1/N2.
- 초점3: 큰 uint64/시간경계/누락·root실패와 서명된 보고는 OS UNVERIFIED 유지. report 음성→N1/N2.
- 초점4: 늦은 응답·user/client/project 변경·중복명령은 입력/원문 보존, 조용한 재발급0. N2/N3.
- 초점5: SQL guard·canonical/COMMIT·현재권한/경합은 실제PG 전 미검증. N2에서 시험 경로를 작성하더라도 실행0, 이를 fixture PASS로 승격하지 않음.

## N1. strict 공통 계약·별도 서명 검증

파일: contracts/runtime/source-read-observation-v1.ts(요청/scope/permit·bounded wire), source-read-report-v1.ts(정확 report/시각/해시), apps/server/modules/connections/source-read-proof.ts(별도 purpose 서명). tests/unit/FN08/source-read-contracts.test.ts·source-read-proof.test.ts.
기존 source-scope-v1.ts에는 순수 relativeFile 검증의 export alias만 추가해 같은 문법을 재사용한다. 기존 READ/WRITE parser 허용값/본문은 바꾸지 않는다. 내부 책임 분리는 r2 의미변경이 아니다.
인터페이스: readSourceReadRequestV1(input,nowMs), readSourceReadScopeV1(input), readSourceReadPermitV1(input,expected,nowMs), parseSourceReadWireV1(raw,kind), readSourceReadReportV1(input,context), verifySourceReadProof(spki,signature,payload,expected,now), verifySourceReadReportProof(spki,report,context).
- [x] source-read-contracts 정상/초과/추가키·경로·현재기한·projection·보고상태/time/hash/uint64 음성부터 작성, `node --test tests/unit/FN08/source-read-contracts.test.ts` 부재RED 확인.
- [x] 최소 순수 validator 구현→동일GREEN. exact snapshot/권한 확인은 서버 소비 책임임을 명시.
- [x] 합성 메모리 P-256 정상과 타purpose/key/DER/서명/nonce/기한 음성 RED→GREEN, 기존 runtime-contracts/host proof 인접·타입0.
- [x] 안전 checkpoint 1adbfb7e·WORK_STATUS 증거/미검증 기록. 자료형만으로 기능 전체 완료라고 하지 않음.

## N2. 현재 권한·불변 저장·보호 protocol 후보

후속현재사실(2026-10-18): exact86bae1e7의별도새internalPG/psql은46schema COMMIT·appREADONLY fullchecksum/동일26벡터/새4표0행PASS/정리0다. 원8cFAIL은보존한다. 실제서비스8범주·원자보고/실패rollback은별도protocol QA후보를준비중이며새정확결정전미실행이다. 아래실제전체검수체크를이SQL한정PASS만으로완료하지않는다.

최신 부분 진행(2026-10-18): 보호 protocol/routes·보고/HUMAN조회·4표/guard SQL초안·독립 migration manifest와 SQL vector 준비 함수를 작성했다. 직접47PASS·인접5PASS/CAS·기존credential5PASS·타입0, 첫 C0/I3/M1 보완 후 지정 재검토 C0/I0/M0다. SQL parsing·함수·guard·현재권한/실제COMMIT/rollback/API 전체시험·새 격리 runner는 아직 미실행/미완료이며 실제 저장/권한 PASS가 아니다. 기존45 SQL·정식 runner 변경0이다.

파일: source-read-input.ts/project-source-read-grants.ts/source-read-protocol.ts/source-read-records.ts, 기존 projects/routes.ts·access/project-command.ts 최소 연결, db/migrations/0008_source_read_observation.sql 초안1. 허용 HUMAN op 2개/GET·별도 connector exchange/permit/reports만 추가.
소비: N1 strict codec·기존 AccessRepository/currentProjectController/currentPolicy/projectReplay/persistProjectReceipt·source_roots/connector_basis_current.
산출: HUMAN 요청/회수·OWNER/VIEWER projection/서명cursor·별도 challenge/tokenhash/permit·보고1건·불변ref/상태. 현재성은 매 소비 transaction에서 재검증·현재권한 확인 전 replay0.
- [x] 정상/타주체·프로젝트/회수/옛세대/기한·동일/상이명령·응답유실/무효서명부작용0의 서비스 경계 RED→GREEN. 합성 서비스 경계만 확인했다.
- [x] 원자receipt/audit와4표·exact JSON/canonical·상태 UPDATE/불변 guard/현재basis 초안 작성. 기존45 SQL 수정0·tracked diff0. 실제PG 불변식은 미검증이다.
- [ ] 실제PG용 직접 음성/실패rollback·canonical 벡터 경로를 준비하되 실행0. 로컬synthetic으로 실제 SQL/COMMIT/권한PASS 주장0.
- [ ] 코드·SQL hash/원 finding/미검증을 checkpoint로 기록. 정식migration runner 자동 연결·catalog/QAseed·DB적용0.

## N3. UI11 명시 요청·조회·회수

최신 부분 진행(2026-10-18): 화면/별도 Web helper·주체별 보존을 연결, 원 합성 browser 버튼부재RED→4PASS6.1초·의미 보완 후 새build/4PASS7.6초는 과거 완료 증거로 재사용한다. 추가 project/detail선택 지연2PASS6.3초는 최종 digest 완료 barrier를 보강한 결과이며 원 검수C0/I1/보정과 분리한다. 사용자/client 교체 지연 신규2PASS7.6초·지정 읽기 독립C0/I0/M0는595349bebce760c73e3d7a30f1a01f946c4e3f31에 보존했다. QA02/03/04는 각 exact정리·독립부재 확인이며 다시 생성하지 않는다. 모든 asset/auth/API는 합성이므로 실제 인증·세션폐기/PG·served/TLS·OS 인수는 여전히 미검증이다. 보존초안 hostLabel 표시 누락 Minor1은 이월한다. 이 부분 결과를 아래 전체 검수 완료로 대체하지 않는다.

파일: apps/web/src/features/connections/SourceReadGrantsPanel.tsx·source-read-api.ts, 기존 SourceRootsPanel/App의 주체별 보존 연결 최소 수정, tests/unit/FN08/source-read-web.test.ts·tests/browser/UI11/source-read-grants.spec.ts.
소비: N2 HUMAN op/ref/보호projection. 산출: source/host/file·경로/이번이유 전달 preview→명시 요청/결과재확인/회수·보고 OS미확인 상태. connector token은 브라우저로 전달0.
- [ ] 명시 동작/기준바뀜/만료/VIEWER·dirty/pending/주체교체·늦은 응답 RED→GREEN, 타입/build·직접인접.
- [ ] 등록 QA D:\tmp\anvil-v3-stage-b\browser\ui11-source-read-01/{dist,results,temp,config.mjs}만 생성전 부재/owner/nonlink·수명 검수종료또는2h·exact정리/독립0. 현재 생성0.
- [ ] 기존3830/서비스·DB/계정/TLS에 접근하지 않는 후보asset/합성API browser 검수. 실제 served/PG/OS는 UNVERIFIED.

## N4. 한정 인수·후속 실제 검증 결정자료

- [ ] 새 경계 전체의 읽기 독립검수·Critical/Important 확인/직접 RED→GREEN 보완. 기존 완료 작업 전수 반복0, Minor/declined 사실기록.
- [ ] 정확 commit/SQLhash·허용변경/실행0·검증·미검증·QA정리·복구를 WORK_STATUS/FILE_MAP/결정자료에 기록·기존 private branch 보존.
- [ ] 필요한 actual PG/정식DB/native는 별도 exact 자원/image/hash·보호/유한창·전후gate·대안/복구로만 요청. Main이 다음 미완료/선행을 선정하며 PMO배정 대기0.

자체대조: r2 §1/7의 실제 OS·Agent는 의도적 제외, 나머지는 N1~N3로 연결했다. 계획은 source snapshot 독립검증/서버현재권한을 순수 validator에 맡기지 않는다. 작업 순서는 승인 계약의 내부 구현 선택이며 최신 직접 주도 지시와 제한 구현 결정에 따라 Main inline 실행한다. 새 계획 문서 때문에 재착수/업무배정 대기를 만들지 않는다.
