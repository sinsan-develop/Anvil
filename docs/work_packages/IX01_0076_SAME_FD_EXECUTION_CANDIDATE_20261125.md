# IX01 0076 동일-FD 실행 검증 및 단일 실행 후보

- 작성일: 2026-11-25 KST
- 기준: `03a9dea58b3a99a085549901db222afb07204ff8`
- 상태: `SOURCE_AND_SYNTHETIC_CANDIDATE_ONLY`. 이 문서는 Linux·WSL·Docker·PostgreSQL 실행 승인이 아니다.
- 목적: read-only로 pin한 원 regular-file FD를 자식의 고정 descriptor로 넘기고 `/proc/self/fd/<n>`을 실행했을 때, 자식의 실제 executable identity가 원 FD와 같음을 한정된 benign 실행으로 확인할 수 있는지를 검증한다. 이 결과는 0076 실행 승인·도구 provenance·DB rollback PASS·성공 영수증이 아니다.

## 1. 이번 source 단위

`scripts/qa-ix01-0076-negative-linux-fd-proof.ts`는 실제 provider를 등록하지 않는다. 외부에서 명시적으로 공급한 보호 authority와 system port만 소비하며 다음 고정 형상만 허용한다.

- benign executable: `/usr/bin/sleep`
- child executable path: `/proc/self/fd/3`
- child descriptor: `3`
- `argv[0]`: `anvil-ix01-0076-fd-proof`
- arguments: `10`
- shell: 사용하지 않음
- environment: `LANG=C`, `LC_ALL=C`, `PATH=/usr/bin:/bin`
- 원 창: 최초 wall/monotonic anchor에서 최대 10초, equality는 만료
- 입력 파일: root:root, regular file, nlink 1, exact `0755`, 최대 64 MiB

Source는 원 FD의 read-only bytes SHA-256과 dev/ino/size/time을 읽고, 자식 시작 뒤 `/proc/<pid>/exe`의 dev/ino가 원 FD와 같은지 확인한다. 이후 원 자식에만 종료를 요청하고 `SIGTERM` exit 및 child close를 확인한 뒤 원 FD close가 확정된 경우에만 `SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED`를 반환한다. 이 이름은 RAM 합성 계약 검증을 뜻하며 실제 Linux 관측을 뜻하지 않는다.

Timer 동기 만료, wait reject/timeout, identity mismatch, authority 상실, 파일 변화, child 또는 FD close 불명은 모두 `UNKNOWN`이다. 불명 child와 FD는 process-private strong custody에 보존하고 재시도·자동 close·삭제·후속 실행을 하지 않는다. 같은 attempt는 process-local에서 한 번만 소비한다. 실제 재시작 단회성은 기존 durable claim이 담당해야 한다.

## 2. 한정 benign 실행 후보

실제 실행 승인을 별도로 받은 경우에도 다음 한 번의 관측만 허용한다.

1. 지원 Linux와 `/proc` mount를 확인하되 새 mount·권한·설정을 만들지 않는다.
2. 고정 `/usr/bin/sleep`을 `O_RDONLY|O_NOFOLLOW` 계열 read-only FD로 열고 fstat·read·SHA-256·동일 FD 재검산을 수행한다. pathname stat만으로 대체하지 않는다.
3. Node child의 stdio descriptor 3에 원 FD를 직접 전달하고 executable을 `/proc/self/fd/3`으로 지정한다. pathname을 다시 open하거나 다른 FD를 실행하지 않는다.
4. 자식 시작 직후 `/proc/<pid>/exe`를 같은 보호 창에서 관측하여 원 FD dev/ino와 대조한다. 단순 child exit 0, loader 진입, `/proc/self/fd/3` 문자열 사용만으로 동일-FD 실행을 인정하지 않는다.
5. 원 자식만 종료하고 exit와 close를 확인한 뒤 원 FD를 한 번 닫는다. close가 불명하면 결과도 불명이며 재close하지 않는다.

현재 source에는 이 OS system port의 실제 Node 구현이나 호출 진입이 없다. 따라서 이번 source/RAM 결과만으로 이 후보를 실행할 수 없다. 실제 Node에서 stdio FD 전달과 `/proc/self/fd/3` exec가 위 조건대로 동작한다는 관측이 이 후보의 유일한 목적이며, Docker 또는 0076 실행 권위를 발급하지 않는다.

## 3. 전체 0076 단일 실행 후보의 결박 순서

향후 실제 0076 후보는 아래를 하나의 원 window와 하나의 exact attempt로 결박해야 한다. 항목별 별도 승인·TTL을 새로 발급하거나 앞 단계의 관측값을 다음 실행의 기본값으로 사용하지 않는다.

1. **원 승인과 배타 claim**: 기존 0076 plan·approval·graph·attempt와 보호 receipt root를 exact 검산하고 `claim-v1.json`을 기존 O_EXCL journal로 한 번 정착한다. 충돌·partial·close 불명은 후속 0이다.
2. **호스트·도구 최초 관측**: 같은 승인 window의 첫 read-only 단계에서 고정 Node와 Git, `/usr/bin/docker`를 same-FD로 관측한다. path·owner·mode·dev/ino·bytes SHA-256을 원 handle과 결박하고 이후 같은 실행에서 재대조한다. Git/Docker 지문을 별도 사전 입력이나 추가 승인 조건으로 요구하지 않으며, 최초 관측과 후속 재대조가 다르면 즉시 중단한다. 미관측 값이나 다른 실행의 값을 승인 지문처럼 만들지 않는다.
3. **정확 source custody와 load 증거**: 보호 graph의 manifest·130 SQL·R9·reader·approval·journal·host·container·Docker/native-Docker·schema-stage·receiver/result source 전체 raw bytes/hash를 같은 보호 reader로 검산한다. 이 raw source 검산과 Node가 실제로 import/evaluate한 exact bytes 증거는 별개다. 실행 후보는 검산된 동일 bytes만 안전 추출·load하고, load 직전과 직후 동일 hash·원 owner/current를 다시 대조해야 한다. caller JSON, checkout HEAD 문자열, import 경로 일치만으로 source 또는 load 증거를 만들지 않는다.
4. **격리 대상·내부 역할 준비**: 같은 attempt의 고정 container/database, network none, port/mount/privilege 없음과 고정 image를 검산한다. 외부 또는 기존 DB의 role·계정·권한은 생성·변경하지 않는다. 새 격리 DB 안에서만 기존 R9 `bootstrapSql`의 exact 계약을 적용한다. `anvil_v3_bootstrap` 원 session으로 `anvil_v3_migrator`와 `anvil_v3_app`을 만들고, PUBLIC database/schema 권한을 회수하며, migrator 소유 `anvil`·`anvil_qa` schema와 app의 exact 사용·기본 table DML 권한만 부여한다. 보호 manifest에 0037이 선택된 경우에만 `anvil_v3_provider_claim_writer`를 NOLOGIN/NOINHERIT로 만들고 migrator에 기존 계약의 ADMIN OPTION을 부여한다. PRISTINE→INSTALLER role metadata를 원 R9 verifier로 대조하며, 종료 정리에서는 migrator의 CREATEROLE을 제거하고 선택된 내부 role membership을 회수한 뒤 REVOKED metadata, container stop/remove/absent와 결과를 검산한다. container create/start는 claim과 같은 원 tool owner 및 동일-FD 실행 provider가 모두 검증된 뒤 한 번만 가능하다.
5. **음성 migration**: 앞 106개 exact SQL과 ledger를 적용하고 pristine catalog, 고정 sentinel, before catalog를 읽은 뒤 교정 0076 bytes를 outer `--single-transaction` 없이 stdin으로 한 번 전달한다. R9 parser가 exact exit 3, SQLSTATE `42723`, statement-end line `2343`을 확인한 경우에만 after catalog 조회를 허용한다. 0076 ledger append는 0이어야 하고 before/after fingerprint가 같아야 한다.
6. **결과 후보**: 동일 attempt/approval/plan/graph/container, 원 claim receipt, 106/106, 42723/2343, before/after fingerprint, 원 owner 종료와 정리의 구조화 terminal receipt가 모두 일치할 때만 `result-candidate-v1.json`을 source-only 후보로 기록한다. 이것은 실제 성공 receipt나 acceptance가 아니다.
7. **정리와 UNKNOWN**: container stop/remove, tool child 종료, 모든 원 handle close의 실제 권한과 순서는 실행 전에 별도로 확정돼야 한다. 현재 후보는 A14 정리 권한을 상속하지 않는다. 하나라도 불명하면 원 owner를 보존하고 자동 삭제·재시도·새 claim·성공 승격을 하지 않는다.

## 4. 실행 전 미충족 조건

다음이 미충족이므로 현재 실제 실행은 닫혀 있다.

- 실제 Linux/Node same-FD system port와 보호 entry 연결이 없음
- Node·Git·Docker의 지문은 별도 사전 제공물이 아니다. 동일 승인 window의 최초 관측과 같은 실행 내 재대조 source가 실제 보호 entry에 아직 연결되지 않았다.
- 실제 Docker/PG owner와 동일-FD tool handoff의 최종 연결·검증이 없음
- container stop/remove 및 close 불명 보존을 포함한 정리 권한이 확정되지 않음
- 결과 후보를 실제 승인 영수증으로 승격할 별도 계약이 없음
- 실제 WSL/Linux/Docker/PostgreSQL 실행 승인과 실행 receipt가 없음

따라서 source·RAM PASS는 actual OS, Docker, DB rollback, cleanup 또는 acceptance PASS가 아니다. 위 조건을 채우기 위해 새 role·키·DB 권한·서비스·일반 CLI·범용 command runner를 만들지 않는다. 값이 미확정이면 후보를 실행하지 않고 `UNKNOWN`으로 남긴다.

## 5. 검증 및 rollback 경계

- 이번 검증: 신규 source의 RAM port 합성, TypeScript typecheck, diff 검사만 수행한다.
- 제외: 실제 native/OS/WSL/SSH/Docker/DB/키·권한·서비스·Agent 및 child 실행, 파일·receipt 생성, commit/push.
- 향후 실제 후보의 rollback은 격리 container/database와 원 owner의 명시적 stop/remove/close로만 수행한다. 실행 전 그 권한·순서·불명 보존이 승인되지 않으면 mutation을 시작하지 않는다.
- close나 정리 응답을 caller가 받았는지는 disk 상태만으로 복원하지 않는다. 과거 요청의 `UNKNOWN`과 현재 artifact 상태는 별도 축으로 유지한다.
