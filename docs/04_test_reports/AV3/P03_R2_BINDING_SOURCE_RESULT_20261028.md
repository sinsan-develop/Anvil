# P03 R2 고정 리소스 결박 source 결과

## 판정

2026-10-28 기준 PMO가 채택한 R2 고정 리소스 결박의 한정 source 구현·검수가 완료됐다. Main 직접3 단일111 PASS, type/Git Bash 구문 검사 exit0, 독립 제품2 scoped C0/I0/M0·시험3 C0/I0/M0다. 실제 R2 부재/권한·복제 성공·PG 복구·운영 인수 또는 전체 P03/계획 완료 판정은 아니다.

이번 결과 제출은 허용 결과서1만 양쪽 동일 신규 작성한다. 제품2·기존시험3은 아래 지문으로 동결했다. 추가 제품·의존성·범용 경로/환경변수 parameter·실제 grant/nonce·원격·Docker·cp·자원·PG/SQL·서비스·권한·Secret·Agent 효과는0이다. Main 제품 write0, 작성자 Git/status/게시0이며 통합은 Main 별도 소유다.

## 권위·기준

- base `9bb9780e02b31620309109249b0ea33a54a027fc`, 기존 branch `codex/av3-stage-b`. Main preflight562473에서 HEAD/branch·status만 Main dirty/indexempty·보호12·문서4 양쪽 SHA를 대조했다. 이후 Main 소유 WORK_STATUS/WORK_PLAN dirty2는 이번 작성자 수정 대상이 아니다.
- WI `docs/work_packages/P03_R2_BINDING_SOURCE_IMPLEMENTATION_20261028.md` SHA `9CB1FF2B9E4363508D47CFB955ABABEB48208C4DEE5B22F550AC49CAA2BC85AA`.
- manifest `docs/work_packages/P03_R2_BINDING_SOURCE_MANIFEST_20261028.json` SHA `49AC56FD184CE5070D82943C1294FBB2C1A23E5143B2A76C32967BBA6424BFCE`.
- PMO source-only 채택 `docs/approvals/P03_R2_BINDING_SOURCE_PMO_20261028.json` SHA `3A7094B80EA33B315A5FEBE7A161C93FB8444B8F9BE8833BFFF2EBAB9A81A978`, 상태 DELEGATED_PMO_SOURCE_ONLY_ADOPTED. 새 직접 사람 actual 승인이 아니다.
- 새 후보 `docs/contracts/P03_PG_COPY_LIMITED_RISK_R2_BINDING_CANDIDATE_20261028.md` SHA `467A5FFF50C0C22D76F283AF144A312E8BA7D805AA5E5F12AF52870FB63064AF`. 원문의 미채택 표시는 채택 전 immutable 문서로 보존하고 현재 채택 기록이 상태를 설명한다.
- 부모 `P03_PG_COPY_LIMITED_RISK_DELTA_CANDIDATE_20261027.md` SHA `FFC3F2A2979A7845C48B61946A32F0B142C698ED7C6E8004D3038BAD777670D3`는 원 R1 내용 그대로 보존한다.
- 문서 독립 C0/I0/M0 후 PMO 채택→Main preflight/TEST_ONLY→fresh RED→제품2 GO→한정 검증 순서를 따랐다. 최초 채택 대기 문서 지문과 현재 채택 결박 이력은 WI에 보존한다.

## 원 실제 R1과 별개

[원 실제 복제 결과](P03_LIMITED_COPY_ONCE_20261028_RESULT.md) SHA `7E365AC623FF97700C91BDA2F8A8CFB0DDF5899581BC92342914FB46CB89272C`를 따른다. 원 source `367d9d49daeee08a319431853006db0647129910`/controller Git LF `605FB84674B99629B99004023AFF7F1E79F9400EFE8ADE0303043861E0F17AA8`에서 fbe8b8은 NOT_COMPLETE/create-volume/COPY_VOLUME_IDENTITY, consumed=true/copyCreated=true/helpers0/cp 미도달이었다.

원 actual 결정 `337E26F75B85F4F04EB9901F899BB5EF87B0631E86A3F834A6EE9933DF6F07D0`의 one-shot은 소진됐다. source 승인5398/54922와 이 actual 승인을 R2 권한으로 재사용하지 않는다. R1 copy volume·grant/consumed/receipt 원장을 보존하고 삭제·비우기·재사용하지 않았다. 시각 source 보완의 48PASS·checkpoint9bb 및 이번111PASS가 원 실패를 성공으로 바꾸거나 실제 R2 동작을 증명하지 않는다.

## 정확 변경 전후

| field | 이전 | R2 고정값 |
| --- | --- | --- |
| sourceRoot | `/home/daon/anvil-v3-pgcopy-20261027-r1-src` | `/home/daon/anvil-v3-pgcopy-20261028-r2-src` |
| ledgerRoot | `/home/daon/.local/share/anvil-v3-pgcopy-20261027-r1` | `/home/daon/.local/share/anvil-v3-pgcopy-20261028-r2` |
| copyVolume | `anvil-v3-pgdata-recovery-20261027-r1` | `anvil-v3-pgdata-recovery-20261028-r2` |
| toolsName | `anvil-v3-pgcopy-tools-20261027-r1` | `anvil-v3-pgcopy-tools-20261028-r2` |
| initName | `anvil-v3-pgcopy-init-20261027-r1` | `anvil-v3-pgcopy-init-20261028-r2` |
| copyName | `anvil-v3-pgcopy-20261027-r1` | `anvil-v3-pgcopy-20261028-r2` |

제품 diff는 `scripts/p03-pg-copy-host.ts`의 위 target6 각1회 및 limitedCandidate1, `scripts/pg-recovery-copy.sh`의 strict/limited 결과 copyIdentity.name2 및 limited candidate 검사/출력2 literal 전환뿐이다. code의 candidate는 새 후보 SHA lowercase 값으로 결박한다.

시험 diff는 host/docker-time 각 독립 fixed target6+candidate1, preparation strict report.copyIdentity.name1 정합이다. host에 readFileSync import와 아래 반례7개만 추가했다. 기존 criteria/negative/오류 enum/timeout/skip 기준을 낮추거나 기존 시험을 삭제하지 않았다.

protocol `P03_PROTECTED_COPY_R1`/`P03_PROTECTED_COPY_LIMITED_RISK_R1`, policy `P03_COPY_LIMITED_RISK_POLICY_R1_20261028`, mode/carrier의 R1 접미사는 유지했다. 이는 protocol 버전이며 R1 리소스 재사용 허가가 아니다. 원 source volume/instance/CreatedAt·daemon/image/node/owner·위험4·한도·metadata ns 교정·grant/evidence canonical·닫힌 keys/nonce/labels/소비자·단발 consume/lifetime/보존·원본 RO/nocopy·UID/caps/network/정상 회수 조건은 그대로다.

## 필수 반례·실제 cross-file 대조

1. 실제 FIXED_COPY target6를 독립 R2 literal과 비교하고 원 source/protocol/한도를 유지한다.
2. old R1 QA/ledger binding은 strict/limited 모두 HOST_BINDING으로 consume0·첫 mutation0이다.
3. old R1 grant의 copy/tools/init/helper 이름 각1 및 전체 names는 GRANT_REJECTED/LIMITED_GRANT_REJECTED로 consume0·첫 mutation0이다.
4. 부모 FFC3 candidate가 outer/limitedAcceptance/양쪽에 일관되게 들어와도 LIMITED_GRANT_REJECTED 및 consume0·mutation0이다.
5. **생성 후** old R1 metadata.name은 COPY_VOLUME_IDENTITY/create-volume, consumed=true/copyCreated=true/helper0·사본 보존으로 닫는다. 이 검사를 consume 전 거절로 주장하지 않는다.
6. 실제 shell의 strict/limited printf JSON 결과 구조2개에서 copyIdentity.name 및 limited acceptedUncertainty.candidateSha256을 추출하고 실제 limited parser candidate gate와 독립 R2 literal을 대조한다. 그 이름/candidate를 넣은 report를 실제 controller parser에 전달한다. 단순 시험명/source contains나 FIXED_COPY 동적 복사로 교차 일치를 가정하지 않는다.
7. 무효과 실제 결과 parser도 old R1 name과 부모 candidate를 각각 COPY_RESULT_IDENTITY/LIMITED_COPY_RESULT_IDENTITY/LIMITED_COPY_RESULT_BINDING으로 거절한다.

기존 시각13은 실제 +09 관측 fixture·UTC/fraction1~9·ns 미래/기한 경계·grant/evidence canonical 거절을 보존한다. 기존 host의 source/도구/nonce/labels/consumer·기한/guard·partial preservation/단발·strict/limited 분리 음성도 유지한다.

## 지문

| 파일 | 최종 raw SHA256 | 최종 LF SHA256 |
| --- | --- | --- |
| `scripts/p03-pg-copy-host.ts` | `082D36D58438723117B4F68A4471D67B1733DD45CADEA345A2B4F48EDC30E5F4` | `532621070134EC7AE63151DEE3F25EFD7D49456CC7481E4C79401157E1695261` |
| `scripts/pg-recovery-copy.sh` | `CF6B604C2EBB3DC8552C9F341934CC00A5F7970AD8B2F17C1435DF6B14C0A9C8` | 동일 |
| `tests/unit/P03/pg-recovery-copy-host.test.ts` | `F269C0889DEFB07CB5F823BC6B5FA712D42F12ACDEA603C24CCF6E80F3A2006F` | `A5C6AF3018692423BF205003A27F7BC64099DB1D6AEF6F66E14871824C0DFB3D` |
| `tests/unit/P03/pg-recovery-copy-docker-time.test.ts` | `5A254445588BE50468DBA734527CDE3D1A21A4DDF19B7FC1EA7225E05E388778` | 동일 |
| `tests/unit/P03/pg-recovery-copy-preparation.test.ts` | `815F14F4E5729EB838C9F44205B539736B0FA71D1130F9F18F938338529055BD` | `6B93A001AB123114071FFA37A6BE03F8109107619E84CC1671C6F377CF42733B` |

원 기준 raw5는 controller `817E0E27CA42719C777796E97B3CB1A69BEEC8928D32E861A77846AE8EA2B0EC`(LF `E3934DE4FC9B32727ED2BF9B6768CD1190EB846EC4F16C9224DCD23ECFEC1A8E`), shell `04FE0C3F958DFE5378F60A99D4EF5422F99C543DB66D24157A73BCBADD375FDC`, host `10CAFD444DE2631E1B7F2778BBAF7B1484FAD27D0B091C4043A7D521BBD44DF2`, docker-time `9CD9777A753DA80368E0B0AAA0FE48B0FD043FF8940B0601CD71A0BFA7B6E5C1`, preparation `55345F63479E88B6400EFE3348262885CAD1200C79D83736932C6BF1AEAEBA1F`다. 원 LF/보호12는 manifest에 고정돼 있다. 최종 source 지문을 원 actual367/605와 혼동하지 않는다.

## RED→GREEN·명령

| 증거 | 실제 결과 | 구분 |
| --- | --- | --- |
| Main c2a868/7b2df5 | 직접3 단일111: 75PASS36FAIL / 10338.7421ms / exit1 | TEST_ONLY R2 fixture 대 원 R1 제품의 fresh RED |
| author 50b24f/session7885→216139 | 직접3 단일111PASS / 10759.4152ms / skip0/cancel0/todo0 / exit0 | 기본 GREEN |
| author 3728c0/e26539 | type exit0 / Git Bash -n exit0 | 기본 타입/구문 |
| Main dbe2df/51d6aa | 직접3 단일111PASS / 10104.8899ms / skip0 / exit0 | 최종 독립 fresh GREEN |
| Main 99af51/5e543f | type exit0 / Git Bash -n exit0 | 최종 타입/구문 |
| 독립 source2/test3 | 각 C0/I0/M0 | 필수 미해결0 |

정확 직접3·타입 명령:

```text
node --test --test-reporter=spec tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
```

등록 Git Bash 구문 명령:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' --noprofile --norc -n scripts/pg-recovery-copy.sh
```

등록 source의 상대 참조 명령이며 내부 실행 공간을 제품 사용자 실행 경로로 제공하지 않는다. author GREEN 수행 중 추가 제품 실패·fixture 오류·수집 오류는0이었다. source patch 전 원raw/count를 대조하고 제품2의 지정 literal 개수만 치환했다. TEST_ONLY 단계의 원 기대·RED를 지우거나 제품에 맞춰 약화하지 않았다.

## 증거 한계·미검증

host/docker-time의 FS/Git/Docker/consume/receipt는 가짜 ports다. preparation은 등록 Git Bash child에서 source/fake cp/관측 함수를 사용하는 합성 검사다. 실제 Docker/원격·실cp/TERM·새 파일 원장/volume/container를 생성한 검사가 아니며 물리 프로세스·FD/timer/파일시스템·hardquota 통제를 입증하지 않는다. 실제 shell 결과 구조 대조는 source 정합 증거로서 실제 image에서 helper 결과를 관측한 증거는 아니다.

새 R2 경로/volume/helper의 현재 부재·소유·실경로·공간·도구·서버 version을 이번 작업에서 확인하지 않았다. 원 source·보관 R1·모든 writer 통제/시점 일관성·hardquota·ACL/xattr/numeric owner1001 잔여 위험은 기존대로다. 실제 재검증·새 grant/nonce/QA checkout·원격·Docker·cp·container/volume·권한·PG/SQL·서비스/Agent·사용자 인수는 새 exact actual 직접승인 전 NOT_RUN이다. 전체 P03/계획은 미완료다.

## SHA 순환 방지·rollback·다음 조치

새 후보 SHA를 확정한 뒤 source에 반영했다. 후보 본문에 미래 final controller/shell SHA를 넣고 source가 그 후보 SHA를 참조하는 순환을 만들지 않았다. 최종 source commit/controller/shell hash와 새 실제 run/기한·대상/추가 공간·위험/보존 책임을 묶는 actual packet은 이후 Main의 별도 업무이며 이번 source 채택이 실제 실행허가가 아니다.

source rollback은 Main이 이번 R2 결박 제품2/시험3의 소유 변경만 선택 복구하고 원/현재 증거를 보존하는 것이다. R1 source를 선택해도 old grant/actual 승인은 되살아나지 않는다. R1/R2 volume·ledger 삭제, 원본 복원·재실행·권한 변경은 포함하지 않는다.

작성자는 결과서 해시 제출 뒤 추가 제품/시험/원격 검사·다른 문서·Git 변경0으로 동결한다. Main이 exact diff/지문/보호자료를 대조해 별도 게시·통합하고, 새 actual 후보는 독립 source checkpoint 이후 별도 결정 경계에서만 준비한다.

## Main 최종 diffcheck 보충

Main eea8c9의 diffcheck exit2는 Main 관리 신규 문서3의 CRLF(HEAD CR0) 때문이었다. Main95a565로 확인한 뒤 추가 CR만 LF에 정합하여 Main8c0442 diffcheck exit0을 확인했다. 제품·시험·설정 변경0이며 source 제품 본체 오류가 아니다. 원 오류는 WORK_STATUS에 보존한다. 이 보충 전 결과서 SHA `ADDD77CF444C8E26E3C6C76105AE53352051F128129C174D3D43BE82A8B89170`와 최종 지문을 구분한다.
