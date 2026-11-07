# P03 R2 고정 리소스 결박 source 구현계획

> 순차 수행은 superpowers:executing-plans를 참고하되 아래 PMO 채택→Main TEST_ONLY→Main fresh RED→제품 GO 경계를 우선한다. 현재는 문서2 준비 및 PMO 채택 결박만 수행하며 Main TEST_ONLY/제품 GO나 실제 실행 GO가 아니다.

**목표:** 보존 중인 R1 대상·소진 grant를 재사용하지 않고, 정확 R2 리소스6개와 새 후보 SHA에만 source를 결박할 준비를 한다.

**구조:** 기존 controller/shell literal만 한정 전환하고 기존 독립 fixture3을 정합한다. 새 제품·의존성·범용 path/환경변수/외부 parameter 선택기는 만들지 않는다. 구현 이후 final commit/controller/shell hash는 별도 actual packet에 고정한다.

**기술:** 기존 TypeScript/Node fake ports·Git Bash source 합성 시험. 실제 Docker/원격/cp/자원/DB 실행0.

**근거:** `docs/contracts/P03_PG_COPY_LIMITED_RISK_R2_BINDING_CANDIDATE_20261028.md` SHA256 `467A5FFF50C0C22D76F283AF144A312E8BA7D805AA5E5F12AF52870FB63064AF`. 독립 C0/I0/M0 이후 PMO가 source-only 한정 채택을 위임했다. 현재 승인기록은 `docs/approvals/P03_R2_BINDING_SOURCE_PMO_20261028.json` / SHA256 `3A7094B80EA33B315A5FEBE7A161C93FB8444B8F9BE8833BFFF2EBAB9A81A978`이다.

## 현재 상태와 권한 경계

이 WI/manifest의 최초 준비는 채택 대기 WIP였고, 현재는 위 승인기록의 DELEGATED_PMO_SOURCE_ONLY_ADOPTED에 결박한 Main preflight 대기 자료다. 후보 원문 미채택 표시는 당시 immutable 원문으로 보존하며 새 기록이 현재 상태에 우선한다. source-only 제품2/직접시험3 구현·합성검수만 채택됐고 이번 문서 수정이 Main TEST_ONLY/제품 GO가 아니다. Main 독립 preflight와 정확 단계 지시 전 제품·시험·Bash/Node 시험 실행0이다. actual 권한0이며 새 직접 사람 actual 승인으로 표시하거나 old 승인을 재사용하지 않는다.

Main 전달 base `9bb9780e02b31620309109249b0ea33a54a027fc`, branch `codex/av3-stage-b`를 유지한다. 현재 Main 소유 status dirty 예정 외 제품 변경0·보호12 보존을 기준으로 한다. 작성자는 Git/status/WORK_STATUS·게시를 소유하지 않는다.

부모 FFC3 후보 `P03_PG_COPY_LIMITED_RISK_DELTA_CANDIDATE_20261027.md` SHA `FFC3F2A2979A7845C48B61946A32F0B142C698ED7C6E8004D3038BAD777670D3`는 수정하지 않는다. source 승인 5398/54922 계보와 원 actual 결정 `337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0`는 원래 범위만 증명한다. 새 R2 source 채택이나 actual 승인으로 재사용하지 않는다.

## 원 R1 보존

원 source `367d9d49daeee08a319431853006db0647129910`/controller LF `605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8`에서 Main fbe8b8은 NOT_COMPLETE/create-volume/COPY_VOLUME_IDENTITY, consumed=true/copyCreated=true/helpers0/cp 미도달로 끝났다. [원 결과](../04_test_reports/AV3/P03_LIMITED_COPY_ONCE_20261028_RESULT.md) SHA `7E365AC623FF97700C91BDA2F8A8CFB0DDF5899581BC92342914FB46CB89272C`를 보존한다. R1 사본과 grant/consumed/receipt 원장은 삭제·비우기·재사용하지 않는다.

시각 보완 checkpoint9bb의 48PASS/type0·독립C0/I0/M0와 결과 SHA `A2A0B4E8F46000A4EEEAEB72E8ACAB2185D749826EE384CF72230FE2CFA6E3A5`는 source 검수다. 원 actual 실패를 성공으로 바꾸거나 container nano 실측/새 복제를 증명하지 않는다.

## 정확 허용8

| 구분 | 경로 | 단계 |
| --- | --- | --- |
| 신규 WI | `docs/work_packages/P03_R2_BINDING_SOURCE_IMPLEMENTATION_20261028.md` | 지금 문서만 |
| 신규 manifest | `docs/work_packages/P03_R2_BINDING_SOURCE_MANIFEST_20261028.json` | 지금 문서만 |
| 기존 제품 | `scripts/p03-pg-copy-host.ts` | 채택·Main RED·제품 GO 뒤 |
| 기존 제품 | `scripts/pg-recovery-copy.sh` | 채택·Main RED·제품 GO 뒤 |
| 기존 시험 | `tests/unit/P03/pg-recovery-copy-host.test.ts` | 채택·Main TEST_ONLY 뒤 fixture/반례 한정 |
| 기존 시험 | `tests/unit/P03/pg-recovery-copy-docker-time.test.ts` | 동일 |
| 기존 시험 | `tests/unit/P03/pg-recovery-copy-preparation.test.ts` | 동일 |
| 신규 결과 | `docs/04_test_reports/AV3/P03_R2_BINDING_SOURCE_RESULT_20261028.md` | 실제 부재 확인, 검증 후 별도 지시 |

새 fixture/test/제품/도구 파일 추가0이다. 기존 expected/negative/오류 enum/timeout/skip 기준을 완화하지 않는다. 시험은 정확 target fixture 정합 및 아래 증거 강화 외 변경하지 않는다.

## 리소스6과 후보 전환

| field | 기존 R1 | R2 후보 고정값 |
| --- | --- | --- |
| sourceRoot | `/home/daon/anvil-v3-pgcopy-20261027-r1-src` | `/home/daon/anvil-v3-pgcopy-20261028-r2-src` |
| ledgerRoot | `/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1` | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r2` |
| copyVolume | `anvil-v3-pgdata-recovery-20261027-r1` | `anvil-v3-pgdata-recovery-20261028-r2` |
| toolsName | `anvil-v3-pgcopy-tools-20261027-r1` | `anvil-v3-pgcopy-tools-20261028-r2` |
| initName | `anvil-v3-pgcopy-init-20261027-r1` | `anvil-v3-pgcopy-init-20261028-r2` |
| copyName | `anvil-v3-pgcopy-20261027-r1` | `anvil-v3-pgcopy-20261028-r2` |

limited candidate code literal은 부모 FFC3에서 위 R2 후보 SHA의 lowercase `467a5fff50c0c22d76f283af144a312e8ba7d805aa5e5f12af52870fb63064af`로 전환할 예정이다. 현재 채택 기록과 별개로 Main 단계 GO 전에는 반영하지 않는다. protocol scope `P03_PROTECTED_COPY_R1`/`P03_PROTECTED_COPY_LIMITED_RISK_R1`, policy `P03_COPY_LIMITED_RISK_POLICY_R1_20261028`, 기존 mode/carrier는 유지한다. 이름의 R1 protocol 접미사를 resource suffix와 일괄 치환하지 않는다.

## 실제 source 표면·독립 fixture

- controller 현9행: FIXED_COPY의 target6. 현321행: limitedCandidate1. 나머지 소비는 이 고정값을 참조한다.
- shell 현266행: strict 결과 copyIdentity.name1. 현444행: limited parser candidate 검사1. 현597행: limited 결과 copyIdentity.name 및 acceptedUncertainty.candidateSha256. 두 결과 위치를 모두 고쳐 controller parser와 정합해야 한다.
- host 시험 현10행의 독립 fixed6, 현66행 candidate1. docker-time 시험 현8행 fixed6, 현33행 candidate1. preparation 시험 현20행 strict report.copyIdentity.name1. 날짜 시각 양성·원 actual 증거 timestamp·기존 negative의 의미는 바꾸지 않는다.
- 각 시험은 실제 controller URL을 직접 import하고 preparation은 실제 shell source를 읽어 기존 fake 함수만 주입한다. fixture끼리나 FIXED_COPY 값을 모두 복사하여 실제 source 오결박을 숨기지 않는다.
- 읽기 rg 조사에서 apps/scripts/contracts/tests의 해당 R1 target/FFC3 literal hit는 위5파일뿐이었다. 역사 문서·원 결과는 검색 제외·삭제가 아니라 보존 대상이다. 최종 diff 때 같은 범위의 추가 hit가 생기면 근거를 보고하고 임의 확장하지 않는다.

## 반드시 보존할 조건

source volume `anvil-v3-development-pgdata`, instance `dc22a0629e79f259dcd935845e88e58e`, 원 CreatedAt `2026-10-16T03:53:33+09:00`; daemon `e3349f1d-dbfc-478a-96d9-295bf6c6839e`; image `sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f`; Node path/hash 및 owner 검사를 유지한다.

위험4(writer 완전통제 미입증·hardquota 미강제·ACL/xattr 미지원만 한정 수락·numeric owner1001 잔여 위험), protocol/closed key/enum/mode·grant/evidence canonical UTC·Docker strict/ns 시각교정·nonce/labels·consume 단발·원본 RO/nocopy·network none·기존 UID/caps/정상 회수·보존을 유지한다.

한도는 기존 전체600초/source500초/reserve25초·시작 잔여525초·grant최대30분, 논리256MiB/entries100000/할당512MiB guard/free reserve128MiB/10초 관측/audit32MiB/stdout16KiB/control256KiB, volume1/helper3·role별 create/start1이다. 새 범용 params·키/허가·자동retry/force/창 연장0이다.

## 검수 초점·거절 증거

1. resource6와 candidate만 전환하고 scope/policy/mode·원 source identity를 바꾸지 않는가.
2. shell strict/limited 두 결과와 controller parser가 같은 R2 이름/새 candidate를 실제로 결박하는가.
3. 독립 fixture가 source 값을 동적으로 복사해 잘못된 source까지 PASS시키지 않는가.
4. old R1 binding/target names/candidate/grant가 첫 consume/mutation 전에 기존 정확 오류로 거절되는가.
5. 시각·consumer/labels/nonce·단발/원본보존 negative와 원 R1 실패/소진 사실을 유지하는가.

old R1 경로 거절은 가짜 fs binding.sourceRoot/ledgerRoot가 R1인 경우 HOST_BINDING 및 consume0/mutation0, old grant names는 GRANT_REJECTED/LIMITED_GRANT_REJECTED 및 consume0/mutation0, old limited candidate/수락은 LIMITED_GRANT_REJECTED 및 consume0/mutation0로 직접 확인한다. old 실제 실행 source/commit/hash를 임의 새 지문으로 치환하지 않는다.

**구분:** 사본 metadata를 반환하는 copyVolume inspect는 새 volume 생성 이후다. 그 단계에서 old R1 metadata.name이 오면 기존 COPY_VOLUME_IDENTITY와 helper/cp0·부분사본 보존으로 닫는다. 이를 consume 전 실패라고 거짓 주장하지 않는다. 원 R1 grant/binding의 consume 전 차단과 raw 결과 parser의 무효과 거절을 별도로 검증한다.

최소 cross-file 검사는 허용 기존시험 안에서 실제 shell source의 strict/limited printf 결과가 내보내는 copyIdentity.name 및 limited candidate 필드를 구조적으로 추출해 독립 R2 literal과 비교하고, 같은 이름/candidate의 가짜 report가 실제 parseCopyResult/parseLimitedRiskCopyResult를 통과·old값은 정확히 거절되는지 대조한다. 시험명 문자열 존재·단순 source contains만으로 의미 검증했다고 하지 않는다. shell을 수정 전부터 fixture까지 R1에 맞춰 양쪽 동일 오류를 PASS시키지 않는다.

## 순차 실행계획

- [ ] 문서2 및 PMO source-only 채택 승인기록의 정확 hash를 제출한다. Main preflight/TEST_ONLY·제품 GO 전 시작0.
- [ ] Main preflight 후 TEST_ONLY GO에서 기존 시험3의 독립 R2 fixture literal과 최소 old값/cross-file 반례만 정합한다. 기대/음성 기준은 유지·강화한다. 기존 원raw와 보강raw/diff를 분리 제출한다.
- [ ] Main fresh RED로 아직 R1 제품과 R2 fixture/cross-file 불일치를 확인한다. 제품2 write는 별도 GREEN GO 전0.
- [ ] Main 제품 GO 뒤 controller6+candidate/shell결과2+candidate검사·출력만 최소 수정한다. source hash를 다시 자기본문에 박는 변경0.
- [ ] 직접3 시험·type·확인된 Git Bash -n1만 기본 검증한다. 기존 실제 복제/원격/Docker는 실행하지 않는다. 예상 밖 fixture/수집 오류는 제품 실패와 구분하며 같은 원인3회는 Main 인수 판단으로 중단한다.
- [ ] Main fresh/독립 source 검수 뒤 허용 결과1만 작성하고 최종 지문을 동결한다. 최종 checkpoint/hash를 별도 actual packet에 고정하는 일은 이후 Main의 별도 업무다.

향후 GO 후 정확 후보 명령(현재 실행0):

```text
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

PowerShell의 확인된 구문 검사:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' --noprofile --norc -n scripts/pg-recovery-copy.sh
```

Git Bash 경로는 `P03_PG_COPY_SOURCE_PREPARATION_RESULT_20261028.md`의 기존 명령이다. preparation 시험은 실제 Git Bash child를 사용하나 source된 shell의 기존 fake cp/관측 함수를 호출하며 Docker/실cp를 호출하지 않는 범위다. 이 단계의 Bash/Node 실행조차 아직 GO가 아니다. 이전 전체91이나48 PASS를 이번 R2 검증으로 재분류하지 않는다.

## SHA 순환 방지·미검증·rollback

R2 후보문서 SHA는 외부에서 확정하고 코드에 반영한다. 후보 본문에 미래 최종 controller/shell SHA를 넣고 그 source가 후보 SHA를 참조하는 순환은 만들지 않는다. 구현 후 exact source commit/controller/shell SHA는 별도 actual packet/manifest에서만 결박한다. 새 grant/nonce/실제 승인창은 지금 만들지 않는다.

실제 부재·owner/realpath/link·도구/daemon/image·공간/권한·새volume 추가효과·복제 bytes/metadata·PG/SQL·served·사용자인수·전체P03/계획은 NOT_RUN/미완료다. 실제 재실행은 source-only 채택과 별개의 새 exact actual 직접승인 전0이다. 원 R1 volume/원장/원본을 정리·변경해 새 R2 수용으로 대체하지 않는다.

rollback은 Main이 이번 R2 source 결박 변경만 선택 복구하고 기존/신규 증거를 보존하는 것이다. R1 source로 되돌아가도 소진 승인은 되살아나지 않는다. 실제 R1/R2 자원 삭제·원본 복원·재실행·권한 변경은 포함하지 않는다.

## 채택 결박 이력

최초 준비 WI `2F49692C6C6635EAF514977F6257457AE23E4C2CDFE0F1FA0E1CB8219C8A1991` / manifest `D798CF3740DEFC3E291C34CD6087416D86300C3EC02F583711A830370F509DC2`는 채택 대기 문서였다. 이후 PMO 위임 source-only 채택 기록 `3A7094B8…`을 확인해 현재 상태만 결박했다. candidate467A/부모FFC3/허용표면/원raw/실제 실행권한0은 동일하며 제품·시험·Bash·환경 실행0이다.
