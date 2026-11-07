# P03 Docker 관측 시각 source 보완 구현계획

> 담당자는 superpowers:executing-plans를 참고하여 아래 단계를 순차 수행한다. Main 지정 TEST_ONLY→독립 fresh RED→제품 GO를 우선하며 새 작업영역·Git commit·실제 실행을 만들지 않는다.

**목표:** Docker 관측 metadata의 정상 RFC3339 offset/UTC 및 fraction 1~9자리 표현을 엄격 검증하여 동일한 실제 시각으로 비교하고, grant용 canonical UTC 검증과 분리한다.

**구조:** 기존 controller 내부에 순수 Docker 시각 parser/validator를 두고 아래 실제 소비5곳만 연결한다. 필요시 신규 시험이 직접 호출할 순수 함수 export1만 허용한다. 추가 제품파일·공개 서비스 API·의존성은 없다.

**기술:** 기존 TypeScript/Node 순수 함수·node:test, 가짜 ports. 실제 Docker·원격·cp·DB·서비스 실행0.

**근거:** 승인된 P03 보호 사본 계획 안의 내부 source 버그 보완. Main의 fbe8b8 actual 실패·d9fa9e metadata·독립51a0ab 판정 및 이번 문서2 준비 지시. 실제 사본 재실행 승인은 아니다.

## 현재 상태·기준

2026-10-28 문서 준비 단계다. 이번 허용은 WI/manifest 신규2를 정본과 등록 source에 동일 작성하는 것뿐이다. 제품·시험 작성/실행0, Git/status/WORK_STATUS Main 소유다. Main f6dd75/d6e331 갱신 기준 HEAD는 `e8c0a42a1433a77e637dede5188a93312233f7aa`, branch `codex/av3-stage-b`, local/private 동일·tracked clean·보호 untracked8·기존 보호4 유지·main f976 불변이다. 이전 배정 base d4fb5fc190f2a8816b0cababfea121c27d7715fe 이후 actual 실패 결과/status exact2가 게시됐다. 원 P03 결과 SHA 접두7E365AC6을 보존하며 grant/ledger 복사본은 Git에 포함하지 않았다. 작성자가 별도 Git 상태를 조회·수정한 것으로 표시하지 않는다.

원 실행 source는 `367d9d49daeee08a319431853006db0647129910`. controller Git LF SHA `605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8`, 현재 raw SHA `C96C7AAADC4B76822F698A6E4E9BD3CD7EADBA4F57ECC2EE5951FF3E598E40A5`이며 CRLF→LF 동일이다. shell Git LF/raw SHA는 `04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC`로 유지한다. 새 source hash가 원 actual 실행 hash를 대체하지 않는다.

## 원 실패·정확 원인

- Main fbe8b8: NOT_COMPLETE / create-volume / COPY_VOLUME_IDENTITY, consumed=true/copyCreated=true/helpers={}, cp 미도달. 원 사본 volume과 consumed/receipt 원장은 보존하며 같은 승인 재시도0이다.
- d9fa9e의 새 volume CreatedAt은 `2026-10-28T11:44:26+09:00`, UTC 정규값은 `2026-10-28T02:44:26.000Z`이다. grant issued `2026-10-28T02:37:32.000Z`, expires `2026-10-28T03:07:32.000Z`, 관측 wall `2026-10-28T02:45:35.206Z` 안이다.
- 독립51a0ab는 고정367 source를 읽고 제공 metadata를 순수 메모리1회로 대조했다. object/Name/Driver/Scope/Options/nonce 포함 labels5/시간창/Mountpoint는 모두 true. `instant(CreatedAt)` 내부 `new Date(value).toISOString()===value`만 false였다. 정상 offset을 canonical UTC 문자열이 아니라는 이유로 거절한 혼용이 원인이다.
- 실제 Name은 `anvil-v3-pgdata-recovery-20261027-r1`, nonce는 `cef316aec47f84f6d3e0f27f1e1c939a`, source instance는 `dc22a0629e79f259dcd935845e88e58e`였다. 이 값은 원 실패 증거이며 새 실행값으로 재사용하지 않는다.
- controller current raw와 고정 LF가 처음 달라 보였던 것은 EOL 차이였다. Main2ef0d5 및 고정 blob 읽기3539e8의 동일 LF 근거를 보존한다. 내용 차이·새 실행 source 대체로 주장하지 않는다.

## 정확 쓰기 허용5

| 구분 | 경로 | 현재/향후 |
| --- | --- | --- |
| 신규 계획 | `docs/work_packages/P03_DOCKER_TIMESTAMP_SOURCE_FIX_IMPLEMENTATION_20261028.md` | 지금 작성 |
| 신규 manifest | `docs/work_packages/P03_DOCKER_TIMESTAMP_SOURCE_FIX_SOURCE_MANIFEST_20261028.json` | 지금 작성 |
| 기존 제품1 | `scripts/p03-pg-copy-host.ts` | Main fresh RED 뒤 별도 GREEN GO 전 write0 |
| 신규 시험1 | `tests/unit/P03/pg-recovery-copy-docker-time.test.ts` | 부재 확인. 별도 TEST_ONLY GO 뒤 작성 |
| 신규 결과1 | `docs/04_test_reports/AV3/P03_DOCKER_TIMESTAMP_SOURCE_FIX_RESULT_20261028.md` | 부재 확인. 검증 후 별도 보고 지시 때 작성 |

기존 `tests/unit/P03/pg-recovery-copy-host.test.ts`와 `pg-recovery-copy-preparation.test.ts`는 읽기·바이트 보존만 한다. shell·다른 제품·기존 시험·환경·constants·새 literal R2 자원·원 grant/nonce/ledger/volume은 쓰지 않는다.

## 실제 Docker 시각 소비선5

| 현재 위치 | metadata | 경로 | 유지할 비교 |
| --- | --- | --- | --- |
| copyValid, 현40행 | volume.CreatedAt | strict/limited 공통 | issuedAt 이상, expiresAt 미만, 현재 wall 이하; 이름·labels·driver/scope/options 그대로 |
| own, 현42행 | container.Created | strict helper 신원 | issuedAt 이상/expiresAt 미만, inspect에서 wall 이하·최초 Created 재관측 문자열 동일성 유지 |
| runCopyHost clean, 현57행 | container.State.FinishedAt | strict 정상 회수 | 유효 timestamp·epoch>0 및 기존 closed/exited/ExitCode0/자기 ID/회수 조건 유지 |
| ownLimited, 현308행 | container.Created | limited helper 신원 | strict와 같은 생성 시간창·inspect의 wall/재관측 조건 유지 |
| runLimitedRiskCopyHost clean, 현316행 | container.State.FinishedAt | limited 정상 회수 | 기존 strict와 동일한 종료·신원·회수 조건 유지 |

source volume의 sourceValid.CreatedAt은 고정 원본 식별자 문자열과 exact 비교하므로 변경하지 않는다. Docker 생성 시각의 표현 허용을 이유로 최초/후속 metadata 문자열 교체를 허용하거나 grant 기간을 늘리지 않는다. FinishedAt의 기존 epoch>0 조건을 바꾸지 않는다. 생성 시각 미래/기한 경계 반례는 해당 비교를 실제 caller까지 검증한다.

## 파서 및 보존 계약

- Docker 관측 전용 엄격 RFC3339 문법으로 `YYYY-MM-DDTHH:mm:ss`, 선택 fraction 1~9자리, `Z` 또는 부호 있는 `HH:MM` offset을 검증한다. 공백·날짜만·timezone 없음·임의 문자열/자료형·무한/NaN·fraction 10자리 이상은 거절한다.
- 월별 날짜/윤년·시/분/초·offset 시/분 범위를 명시 대조하여 Date.parse가 잘못된 달력을 자동 보정하는 것을 허용하지 않는다. leap-second처럼 기존 epoch 비교로 표현하지 못하는 값은 추정 보정하지 않고 거절한다. permissive Date.parse만으로 유효 판정하지 않는다.
- fraction의 1~9자리 정밀도를 검증 후 유지한다. 기한과 wall 비교에서 sub-millisecond를 무조건 버려 미래·expires 경계를 통과시키지 않는다. 내부 bigint nanosecond 등의 방법으로 원 관측과 grant/wall의 epoch를 일관되게 비교할 수 있다. 외부 DTO·grant schema는 그대로다.
- 기존 `instant`와 strict/limited grant의 issuedAt/expiresAt, strict evidence observedAt/expiresAt는 기존 canonical UTC 밀리초 기준을 보존한다. decision/candidate/hash/closed key 집합·허용 enum·Node/source identity/nonce/labels/원본보존·consume/단발/timeout/회수 조건은 바꾸지 않는다.
- 실제 관측된 양성은 volume +09:00 하나다. container Created/FinishedAt의 RFC3339Nano 지원은 공식 schema 근거와 source 시험 범위이며 실제 helper는 원 실행에서0개였다. Main이 확인하는 Docker 공식 API/schema 근거를 결과에 정확 링크하고 실제 관측으로 승격하지 않는다.

## 검수 초점

1. 정상 +09:00을 허용하려고 grant canonical 조건까지 완화하지 않았는가.
2. parse 가능한 잘못된 달력·offset·fraction을 조용히 정규화하지 않는가.
3. nanosecond truncation으로 미래/issued/expires 경계를 통과하지 않는가.
4. strict/limited 두 공개 경로 모두 volume·생성·정상 회수 소비선에 실제 연결되는가.
5. timestamp 변경 뒤 다른 identity/labels/nonce/closed 상태 실패를 정상화하거나 consume·cp를 실제 실행하지 않는가.

## 순차 단계·직접 검증

- [ ] 문서2·기존 raw/신규 부재·소비5 확인을 Main에 제출한다. 지금은 여기까지다.
- [ ] Main TEST_ONLY GO 후 신규시험1 작성. 순수 parser가 아직 없으면 동적 import에서 정확 부재만 명확 RED로 잡고 예상 밖 예외는 실패시킨다. 공개 runCopyHost/runLimitedRiskCopyHost 가짜 ports의 실제 metadata 소비 반례도 포함한다(helper-only 금지). 기존 fixture를 읽어 닫힌 grant/도구/동일 ID·receipt 조건을 맞추되 기존 시험은 수정하지 않는다.
- [ ] 첫 시험 동결 raw/명령/기대/예상 RED를 Main에 즉시 제출한다. Main fresh RED 전 제품 write0.
- [ ] Main GREEN GO 뒤 기존 controller1만 최소 수정한다. 필요시 내부 순수 parser export1만 허용하며 서비스 API를 추가하지 않는다.
- [ ] 신규시험 단일, 기존 host 직접 인접, type를 필요한 범위에서1회 실행하고 raw/diff/오류/미검증을 제출한다. 같은 원인 오류3회는 중지·Main 인수 판단이며 환경/수집 오류를 제품 실패로 세지 않는다.
- [ ] Main 독립 source 검수와 fresh 직접 검증 후 허용 결과서1에 원 actual 실패·new source 시험·원장보존·실제 미검증을 분리 기록한다.

향후 승인 후 실행 후보(현재 실행0):

```text
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

기존 preparation 시험은 Bash spawn 경로를 포함하므로 이번 최소 인접에 자동 포함하지 않는다. source 수정은 controller뿐이며 기존 Bash/물리 동작 시험을 다시 실행하지 않는다. 전체91 합성 PASS를 재실행하거나 실제 Docker 검증으로 인용하지 않는다.

신규 반례: actual +09 양성·동일 UTC·fraction1/3/6/9·윤년/offset 경계 양성; 비정상 달력/offset·timezone 누락·추가문자·fraction0/10·NaN 음성; created 미래/issued 전/expires 동일 이후(미세 정밀도 포함)·labels/nonce/이름/hash 변조 음성; strict/limited 공개 흐름의 volume/Created/FinishedAt 연결; grant/evidence의 비canonical 시각은 계속 원 코드/상태로 거절하며 mutation0. 최종 성공/회수·오류 enum 기대를 약화하지 않는다.

## 실행 금지·미검증·복구

새 grant/nonce·기존 원장 수정/삭제·사본 삭제·R2 resource/constants 변경·같은 승인 재시도·Docker/원격/cp/컨테이너/SQL/서비스/Agent0이다. source 테스트 완료는 실제 P03 복제 성공·실제 helper 시각 관측·보호 사본 수용·계획 완료를 뜻하지 않는다. 실제 재검증은 새 exact source/자원/기한/위험/보존 조건의 별도 직접 실행승인 전 NOT_RUN이다.

source rollback은 새 controller 변경만 선택 복구하고 신규시험/문서를 보존 가능한 방식으로 Main이 정리한다. 기존 actual consumed=true/copyCreated=true/helpers0/cp0 및 사본·원장 보존 사실을 지우거나 성공으로 바꾸지 않는다. 이 계획은 물리 자원 rollback/정리 명령을 승인하지 않는다.

## Docker 형식의 공식 근거

Main이 확인한 [Moby v26.1.5 공식 API swagger](https://raw.githubusercontent.com/moby/moby/v26.1.5/api/swagger.yaml)는 Engine API 1.45 자료로 volume.CreatedAt(1913–1917), ContainerState.FinishedAt(4691–4694)에 9자리 소수 Z timestamp 예제를 둔다. [Docker API 1.45 안내](https://docs.docker.com/reference/api/engine/version/v1.45/)의 explorer 도구 한계로 원 schema를 읽은 근거다. 이는 parser의 RFC3339Nano source 지원 근거이며 현재 서버의 실제 version을 확인하거나 API1.45 서버라고 단정한 것이 아니다. 실제 +09:00 volume 관측과 문서 예제·가짜 ports 시험은 구분한다. 원 actual helper0이므로 container Created/FinishedAt 실측은 NOT_RUN이다.
