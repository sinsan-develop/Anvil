# P03 Docker 관측 시각 source 보완 결과

## 현재 판정

2026-10-28 기준 기존 P03 계획 내 Docker timestamp source-only 버그 보완과 한정 검수가 완료됐다. Main 신규13+기존 host35 단일48 PASS, type/diff 검사 exit0, 독립 품질·명세 C0/I0/M0이며 필수 미해결 finding은 없다. 전체 P03·작업계획 완료나 실제 보호 사본 복제 성공으로 판정하지 않는다.

이번 최종 쓰기는 허용 결과서1뿐이다. 제품·신규시험은 아래 지문으로 동결하고 기존 host 시험·shell 바이트를 보존한다. 원격·실제 Docker·cp·컨테이너·새 grant/nonce·DB·환경·서비스·Agent 실행0이다. Git/status/게시·통합은 Main 별도 소유이며 작성자는 이번 결과 작성에서 Git을 실행하지 않았다.

## 기준·범위

- 기준 HEAD: Main f6dd75/d6e331 전달 `e8c0a42a1433a77e637dede5188a93312233f7aa`, 기존 `codex/av3-stage-b`. local/private 동일·tracked clean·보호 untracked8 및 기존 보호4·main f976 불변은 Main 증거다.
- WI: `docs/work_packages/P03_DOCKER_TIMESTAMP_SOURCE_FIX_IMPLEMENTATION_20261028.md` / SHA256 `3F4095D76782F5D9F8117A7C80AEB8F0FB40190776D5E12E88850D23B0ED0886`.
- manifest: `docs/work_packages/P03_DOCKER_TIMESTAMP_SOURCE_FIX_SOURCE_MANIFEST_20261028.json` / SHA256 `FFA35EF77E6C57DA08B8A6289F7E56A282BEFDF046E879EA67D6F8F6C6B572A4`.
- 문서 preflight 독립 C0/I0/M0 및 Main6409b2의 base/원raw/보호12/신규부재/indexempty/trackedclean 확인 후 TEST_ONLY GO, Main fresh RED 후 제품1 GREEN GO를 따랐다.
- 정확 제품1: `scripts/p03-pg-copy-host.ts`. 신규시험1: `tests/unit/P03/pg-recovery-copy-docker-time.test.ts`. 기존 시험·shell·다른 제품·새 의존성·서비스 API·실 R2 resource/constants는 변경하지 않았다.

## 원 actual 실패는 별도 사실로 보존

[원 실제 1회 복제 결과](P03_LIMITED_COPY_ONCE_20261028_RESULT.md)의 Main 보고 SHA 접두 `7E365AC6`을 따른다. 원 실행 source는 `367d9d49daeee08a319431853006db0647129910`, controller Git LF `605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8`이었다. 이번 새 controller 지문이 원 실행 지문을 대체하지 않는다.

Main fbe8b8의 원 결과는 NOT_COMPLETE / phase=create-volume / COPY_VOLUME_IDENTITY, consumed=true, copyCreated=true, helpers={}, cp 미도달이다. 기존 승인 one-shot과 old grant는 소진됐고 같은 승인 재시도는 없다. 원 copy R1 volume과 ledger/consumed/receipt는 보존한다. 원 QA/helper 잔여0의 별도 관측·정리는 원 보고서 증거이며 이번 source 시험이 물리 자원을 조회·정리한 것이 아니다. grant·ledger 복사본은 Git에 포함하지 않는다.

Main d9fa9e 실제 volume의 CreatedAt `2026-10-28T11:44:26+09:00`은 UTC `2026-10-28T02:44:26.000Z`다. grant issued `2026-10-28T02:37:32.000Z`, expires `2026-10-28T03:07:32.000Z`, 관측 wall `2026-10-28T02:45:35.206Z` 범위 안이었다. 독립51a0ab의 고정367 source/제공 metadata 순수 메모리 대조에서 object·Name·Driver·Scope·Options·nonce 포함 labels·epoch 시간창·Mountpoint는 모두 true였다. `instant(CreatedAt)`의 `new Date(value).toISOString()===value`만 false였다. 실제 Docker offset 시각을 grant용 canonical UTC 문자열 조건으로 검사한 혼용이 원인이다.

## 변경 전후·보존 경계

변경 전에는 Docker volume/container의 관측 시각도 기존 `instant`로 검사했다. 변경 후에는 controller 안의 순수 내부 export `parseDockerTimestampNanoseconds`가 엄격한 Docker RFC3339 문법·달력·offset·fraction을 검증하고 bigint nanosecond epoch를 반환한다. 서비스 API를 추가한 것이 아니다. Date.parse 자동 보정만으로 유효하다고 판정하지 않고 월별 일수/윤년·시분초·offset 범위와 전체 문자열 일치를 검사한다. fraction1~9를 유지하여 millisecond 절삭으로 미래·expires 경계를 통과시키지 않는다.

실제 diff는 순수 parser1 및 내부 window/notFuture/positive 검사, 아래 metadata 소비5곳과 inspect 미래 비교2곳에 한정한다.

| 소비선 | 변경 후 | 유지한 조건 |
| --- | --- | --- |
| copyValid의 volume.CreatedAt | Docker epoch window 검사 | issued 이상/expires 미만/wall 이하·이름/driver/scope/options/nonce/labels |
| own의 container.Created | Docker window 검사 | strict 신원·원 grant 기간·mount/caps/argv 등 |
| runCopyHost clean의 State.FinishedAt | Docker 유효 epoch>0 검사 | strict 자기 ID·closed/exited/ExitCode0/정상 회수 |
| ownLimited의 container.Created | Docker window 검사 | limited 신원·원 grant 기간·mount/caps/argv 등 |
| runLimitedRiskCopyHost clean의 State.FinishedAt | Docker 유효 epoch>0 검사 | limited 자기 ID·closed/exited/ExitCode0/정상 회수 |

strict/limited inspect의 container.Created≤wall도 nanosecond 비교로 연결했다. 기존 최초/후속 Created 원문 문자열 동일성은 유지한다. sourceValid의 고정 원 source.CreatedAt literal exact 비교는 그대로다.

기존 `instant`, strict/limited grant issuedAt/expiresAt, strict evidence observedAt/expiresAt는 canonical UTC millisecond 조건을 유지한다. decision/hash/closed key/enum/mode·Node/source identity·nonce/labels·consume 단발·timeout/lifetime·보존·정상 회수·원 실패 상태는 변경하지 않는다. 실제 +09 volume metadata 양성은 정상 허용하되 잘못된 달력/offset, 미래·issued 전·expires 동일 이후와 labels/nonce/consumer/종료 상태 위반은 기존 오류로 거절한다.

## 공식 형식 근거와 실제 관측 구분

Main이 확인한 [Moby v26.1.5 공식 swagger](https://raw.githubusercontent.com/moby/moby/v26.1.5/api/swagger.yaml)는 Docker Engine API1.45 자료로 volume.CreatedAt(1913–1917), ContainerState.FinishedAt(4691–4694)에 9자리 소수 Z timestamp 예제를 둔다. [Docker API1.45 안내](https://docs.docker.com/reference/api/engine/version/v1.45/)의 explorer/Markdown 도구 한계로 원 schema를 읽은 근거다.

이는 Docker parser 형식의 source 지원 근거이며 실제 서버의 version을 조회하거나 현재 서버가 API1.45라고 확인한 것이 아니다. 실제 volume +09:00 관측, 문서의 RFC3339Nano 예제, 순수·가짜 ports 검증은 서로 다른 증거다. 원 실행 helper0이므로 container Created/FinishedAt nano 실측은0/미검증이다.

## 동결 지문

| 파일 | raw SHA256 | Git LF/정규 LF SHA256 |
| --- | --- | --- |
| `scripts/p03-pg-copy-host.ts` | `817E0E27CA42719C777796E97B3CB1A69BEEC8928D32E861A77846AE8EA2B0EC` | `E3934DE4FC9B32727ED2BF9B6768CD1190EB846EC4F16C9224DCD23ECFEC1A8E` |
| `tests/unit/P03/pg-recovery-copy-docker-time.test.ts` | `9CD9777A753DA80368E0B0AAA0FE48B0FD043FF8940B0601CD71A0BFA7B6E5C1` | 동일 |
| 기존 `tests/unit/P03/pg-recovery-copy-host.test.ts` | `10CAFD444DE2631E1B7F2778BBAF7B1484FAD27D0B091C4043A7D521BBD44DF2` | `F276712E1D8417256722E986F2A69986C943F2234DEA3D4306481C1F54E2BB45` |
| 기존 `scripts/pg-recovery-copy.sh` | `04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC` | 동일 |

원 controller raw는 `C96C7AAADC4B76822F698A6E4E9BD3CD7EADBA4F57ECC2EE5951FF3E598E40A5`, LF는 위 원605 지문이었다. Main diffcheck의 CRLF→index LF 예고는 EOL 기록이며 실제 source 내용/실행 결과를 바꾸지 않는다. 기존 preparation 시험은 읽기 보존했고 이번 실행에는 포함하지 않았다.

## RED→GREEN·정확 명령

| 구분/증거 | 실제 결과 | 판정 범위 |
| --- | --- | --- |
| Main c29504 / 3db98e | 신규13 = 8PASS5FAIL / 205.2293ms / skip0/cancel0/todo0 / exit1 | 원 controller/host/shell 확인 뒤 실제 RED |
| author 4de1fa | 신규13+기존35 단일48PASS / 663.1216ms / skip0/cancel0/todo0 / exit0 | 보완 후 가짜 ports 기본 검증 |
| author 2f2f32 | exact tsc exit0 | 타입 |
| Main ff8f12 | 신규13+기존35 단일48PASS / 408.7645ms / skip0/cancel0/todo0 / exit0 | 최종 독립 fresh 검증 |
| Main 55f31c / 0e4246 | exact tsc exit0 / diffcheck exit0 | 최종 타입·diff |
| 독립 품질·명세 | C0/I0/M0·필수 미해결0 | 한정 source 검사 |

Main RED5는 순수 parser 부재2와 실제 +09 volume/UTC-fraction/container Created·FinishedAt 소비 양성3이었다. 기존 canonical 양성·guard8은 PASS였다. 기대/timeout/skip을 낮추지 않았다.

```text
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-docker-time.test.ts
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-host.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

첫 명령은 Main RED, 둘째와 셋째는 author/Main GREEN 명령이다. 등록 source의 상대 경로 참조이며 내부 실행 공간을 제품 사용자 실행 방법으로 제시하지 않는다.

신규 시험은 기존 host 시험의 fixture 정의부만 읽어 복제했으며 기존 시험을 import/자동 등록하지 않았다. 모든 FS/Git/Docker/consume/receipt는 메모리 ports다. 독립 Date.UTC+정수 ns expected로 parser를 대조하고 strict/limited 공개 진입에서 실제 metadata 소비·원본 literal·정상 회수까지 검사했다. unexpected 가짜 command는 별도 배열이 비어야 하므로 예상 밖 오류를 정상 거절로 숨기지 않는다. grant/evidence의 offset/nano는 같은 epoch여도 원 canonical 오류·mutation/copy 차단을 확인했다.

작성 중 regex `$`가 마지막 newline 앞에서도 맞을 수 있음을 정적으로 발견해 실행 전 `match[0]===value`를 추가했다. 제품 시험 FAIL 후 기대를 바꾼 것이 아니며 기대 변경0이다. 이 보완을 원 actual 실패나 제품 반복 실패로 세지 않는다. author GREEN 전 실제 시험 실패0, Main의 원RED는 그대로 보존한다.

## 한계·미검증·다음 조치

실제 Docker/원격/cp/복제·새 grant·컨테이너·R2 자원/constants·DB/SQL/서비스/Agent 변경·실행0이다. 기존 preparation/Bash·전체91·원 물리 복제 검증도 재실행하지 않았다. 순수/가짜 ports 48PASS는 실제 helper/OS/volume 복제 성공·PG 복구 수용·사용자 인수가 아니다. 새 실제 복제 검증은 새 exact source/resource/기한/위험·보존 조건의 별도 실행승인 전 NOT_RUN이며 같은 old approval 재시도는 없다.

source rollback은 Main이 이번 controller 변경만 선택 복구하고 신규시험·문서와 원 실제 실패 증거를 보존하는 것이다. 원 copy R1/ledger 삭제·재사용·원 grant 부활·서비스 조작은 포함하지 않는다. 전체 P03·계획은 미완료다. Main은 별도로 지문/diff/보호자료를 확인하여 게시·통합하고, 새 source/resource actual 후보는 별도 업무로 준비한다. 작성자는 결과서 해시 제출 뒤 추가 제품/시험/원격 검사 없이 동결한다.
