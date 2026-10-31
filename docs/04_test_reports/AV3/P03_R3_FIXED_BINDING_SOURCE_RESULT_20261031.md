# P03 R3 고정 결박 source 검수 결과

2026-10-31 / Main 어울 / source-only 검수 완료·실제 복구 미실행

## 판정·기준
Main fresh 전체130PASS/FAIL0/SKIP0/CANCEL0/TODO0·type/Bash구문/LF/diff0, 최종5지문 독립 scoped C0/I0다. R3 고정 값/후보/결과·parser 정합만 검수했다. 실제 Docker·복제·PG·IX01 완료나 복구 실행 승인은 아니다.
- 부모 후보94BB0D36438873994003F062A9C18ABC378E9C2382A7D617C45EE411141F0092, bindingEF21B4CBB5EB394A03EFDEFC49583DC9664EE056735BCD5D545C57362479F19C, WIE332921F24919FFDEC82A4D2E639CA92CA6C8659DCBBE6502BDC4A656E8819CC.
- 신산님은 PMO trusted 전달로 ‘R3 source 보완은 재승인 없이 진행, 실제 복구 실행은 별도 승인 유지’를 지시했다. source와 actual은 구분한다.
- 시작 HEAD3e428c5aab5795603f302e0ad4cafcbb7e6ebd4a / codex/av3-stage-b / tracked clean·원보호 untracked3. 기존 Primary 단일 writer, Main 제품 동시 수정0.

## 정확 변경5
| 경로 | 최종 raw SHA256 | 변경 |
| --- | --- | --- |
| scripts/p03-pg-copy-host.ts | 591B95E0573B76C5D053F49A85131ACD2692052DBBDB79731E6F3A9A144C1A57 | FIXED literal6·limitedCandidate1 |
| scripts/pg-recovery-copy.sh | 8F1C435187ED253CBC1ACAABD430B4B4F891D84EBBC37A3027744A22B44C9BB3 | strict/limited 결과의 copyname2·candidate parser/결과2 |
| tests/unit/P03/pg-recovery-copy-host.test.ts | FFDEC7415D28237FF1CD3A7B014D914FD1ED2615511A1B7E4ABAA9FBADAE4C8A | 독립 R3 정상 및 기존 R1/새 R2 거절·생성후 보존 |
| tests/unit/P03/pg-recovery-copy-docker-time.test.ts | 9C57668A2618D07B509BAAC539F09F2414F07BCDD379F36F15808455825895F6 | 정상 fixed/candidate/report와 R3 조건 |
| tests/unit/P03/pg-recovery-copy-preparation.test.ts | 9EC69E3FA3BAD55CC2DFD118EB6FE6333DDB4853DC7C8CDDA04F8A18F4A1F3CF | 정상 report copyname1 |

Main aa42db가 메모리에서 새 결박을 역치환하자 시작 hostAF61BAF27184529505689B5BAE68ACDDFBF2E0B4406DF5D8486312F636449ABC/shell76952702BA93E48ACE81A879C19D0190A7CE3D4EA5A7374B0E494AD650335271와 raw hash가 일치했다. 제품 diff는 host2+/2-,shell3+/3-이며 나머지 바이트는 불변이다. 시험3도 Main fresh RED 때의 지문과 같다. 실제 Linux checkout의 controller raw hash는 Windows CRLF 관측과 구분해 최종 Git blob 기준으로 후속 실행안에서 고정한다.

## TEST_ONLY → Main RED → PRODUCT_GO
시험3만 먼저 바꾸고 제품2는 불변으로 둔 실제 Main5409c7:
```
C:\Program Files\nodejs\node.exe --test --test-name-pattern=r3Binding tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts
```
선택10 중1PASS/9FAIL·native exit1·175.5767ms. 새R3의 HOST_BINDING·실shell의R2name, 통째oldR2가 합성consume1/createVolume1에 도달한 반례가 확인됐다. 일부후속음성은 앞선binding실패로 미도달이며 이 RED만으로 각 음성을 검증했다고 하지 않는다. wrapper exit0은 예상 native RED1/제품불변을 확인했다는 뜻이다.
수행자76baf1의 같은 선택1/9/208.3885ms와 Main 결과는 별개다. 최초82fd69 후 미도달 정상 반환필드를 실제copyResult로 맞춘 준비 보정은 별도이며 제품·합격 기준 변경0이다. Main 제품GO 후 선택7bda3d10GREEN/255.4712ms를 거쳐 최종전체 검수를 수행했다.

## 최종 Main fresh
Main bc8746, 최종5지문을 먼저 확인한 단일 명령:
```
C:\Program Files\nodejs\node.exe --test tests/unit/P03/pg-recovery-copy-host.test.ts tests/unit/P03/pg-recovery-copy-docker-time.test.ts tests/unit/P03/pg-recovery-copy-preparation.test.ts
```
130PASS/0FAIL/0SKIP/0CANCEL/0TODO·15383.7826ms·exit0. 출력 일부 중간 이름은 도구에서 잘렸지만 최종 집계/exit는 확인했다. 수행자의2853dd→915660(session54170 완료)130PASS/18526.153ms를 Main 재실행으로 대신하지 않았다.
Main4e1b0e: 기존 고정Node `tsc --noEmit -p tsconfig.base.json`, 기존 `C:\Program Files\Git\bin\bash.exe --noprofile --norc -n scripts/pg-recovery-copy.sh`, 실제shell CR0/LF, `git diff --check` 각 exit0. Git의 CRLF/LF checkout 예고는 경고로 구분하며 설정/ACL 변경0이다. 검수 후 같은 코드로 동일 검사를 추가 반복하지 않는다.
독립 reviewer는 동결시험3 diff와 최종제품2를 분리해 읽고 최종5지문 동일·C0/I0를 반환했다. 기존 R1 거절·시각·tmpfs·cleanup·한도 단언과 원본RO/NoCopy/nonce·소비/fence·위험4는 보존됐다. 실제 시험 실행은 Main/수행자와 별개다.

## 미검증·다음·rollback
- 실제 actual packet/grant·nonce/issuedAt/expiresAt·원격 준비/checkout·R3자원 부재/owner/link/공간 관측·volume/helper·copy/cp·신호·PG/SQL·권한/Secret·서비스·Agent·IX01 served는 미실행이다. 시험은 fake runner/메모리 frame·기존 합성 guard이며 실제 Linux/cp/DB 복구 PASS가 아니다.
- 소진 R1/R2 승인/원장/원본·사본은 보존하고 재사용/삭제0. Main e6ef07은 등록PG 이름metadata1회 exit0/행0만 확인했으며 전체자료/volume 손실을 뜻하지 않는다. 일반 계획내DB변경은 재승인 대상이 아니지만 실행대상 복구·새위험수락을 대체하지 않는다.
- source만 검수됐고 실제복구는 별도 exact 실행 승인 전0이다. 최종Git commit/blob hash·대상6·위험4·30분/상한·정상정리/불명보존을 갖춘 후속 지원을 준비한다. 현재 이 결과로 새 권한을 발급하지 않는다. 전체P03/IX01/Stage/계획은 미완료다.
- rollback은 R3 결박 diff만 후속commit으로 철회한다. 이미검수된 mount/시각·다른기능/보호3·원자료·이력은 reset/삭제하지 않는다. oldsource로 돌아가도 소진승인은 복구되지 않는다. 필수실제gate 미충족으로 main 병합/배포·branch/worktree 정리는 수행하지 않는다.
