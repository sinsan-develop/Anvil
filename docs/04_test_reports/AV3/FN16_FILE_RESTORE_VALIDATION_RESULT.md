# FN16 보관본 독립 검증·새 위치 파일 검증복원 결과

판정: 내부 파일 검증복원을 구현하고 합성 파일로 핵심 동작을 확인했다. 사용자 프로젝트 전체의 백업·복원, 공개 API·화면과 정식 DB 연동은 미완료다.

- 기준: codex/av3-stage-b / 5b17f3d1e0a41c344ef74b07108f816d9c92a5fa. WI 3DC4D194C4D4B23845BEDF8ABDD007B4FECB253D3A033F4C35F044D1A059F11C, 독립 preflight C0/I0/M0. 구현 담당 fn16_file_restore_validation, Main 어울 관리·검수·통합. Main 제품 수정 0, 기존 엔진/builder 8파일 변경 0.
- 원 source 경로가 없는 입력으로 독립 원선택·versionRef·기대 hash를 고정하고, 한도 내 metadata 읽기·허용 inventory·payload 검증을 수행한다. 별도 배타 목적지로 복사한 뒤 보관본과 검증복사본을 다시 검사한다. 원 Signal의 후속 취소와 같은 기한의 잔여시간을 유지한다.
- 기존 목적지·보관본·unknown을 삭제하지 않는다. builder 성공 뒤 후속 실패에서 소유 identity가 전달되지 않으면 임의 회수하지 않고 partial/preserved/IDENTITY_UNCONFIRMED로 명시한다. 생산 권한·OS sandbox나 전체 복원 가능성을 인증하지 않는다.

## 검수·보정 근거

담당자는 actualfs 정상 기능 RED1(825.55ms), 확장21 RED(13677.56ms)→GREEN21(14455.08ms)을 확인했다. 민감 제외 prefix 재해석, 정리 중 늦은 취소 사유 유실, metadata read/close 복합 실패 사유 유실도 각각 반례로 재현·보정했다. 마지막 28건 중 27PASS/1FAIL은 새 시험의 누락 사유 기대 오기였고, 선행 inventory의 INVENTORY_MISMATCH로 정정해 해당1PASS했다. 독립 검수에서 이는 거절 기준 완화가 아닌 실제 선행 소비 순서 일치임을 확인했다.

Main583597→동일 session19749→54ecdb exit0에서 원 4지문을 확인하고 **fresh28PASS/FAIL0/SKIP0,20367.7833ms**를 확인했다. 이후 독립 C0/I1/M0 finding은 새 목적지 metadata가 builder 종료 후 손상돼도 최초 inventory stat를 정상으로 채택하는 경로였다. 같은 writer가 실제 '{}' 변경의 complete=true RED1(878.2731ms)을 재현했다.

fixround1은 목적지 metadata를 bounded 재읽기하고 고정 manifest 직렬화 bytes·독립 baseline과 대조하며 그 stat를 최종 inventory까지 유지한다. 담당자 원본 없는 정상+반례2PASS1789.7578ms/type0. **Mainf70de9 최종 지문에서 동일 정상/반례2PASS/FAIL0/SKIP0,1596.0912ms**, 독립 scoped I1 해소 C0/I0/M0. 등록 범위는 현재29이며 **최종29개 단일 실행 PASS라고 보고하지 않는다**. 원28의 이력과 변경 영향2개 집중 검수를 구분한다. 기존 엔진/다른 기능 전수 반복·한도/기대 완화는 없다.

정확 명령: node --test tests/unit/FN16/file-restore-validation.test.ts. 보정 후 Main은 --test-name-pattern='원 source 삭제|새 목적지 metadata'를 사용했다. 담당자 type은 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0. 신규 no-index diff는 파일 차이 exit1과 공백 오류0을 구분했다. EOF2건은 새 파일만 정리했다.

## 자원·미검증·다음

등록 QA root D:/tmp/anvil-v3-stage-b/fn16-file-restore-validation-20261027-01만 사용했다. 각 case는 owner SINSAN\cyhuh·nonlink·realpath·fresh 부재 확인 뒤 생성하고 등록 파일/빈 디렉터리를 명시 회수했다. Main 원28은 2026-10-26 20:23:02.197Z~20:23:21.794Z, 최종 집중은20:27:39.993Z~20:27:40.866Z에 각 즉시 회수/residualfalse. 이후 별도 root부재·해당 unitprocess0를 확인했다. 시험용 원 source만 명시 제거했고 사용자 자료·실제 DB/Secret/권한·서비스·Agent는 변경하지 않았다.

Windows/PowerShell7 집중 검수다. 전체 npm test와 Linux/WSL·정식 DB/API·사용자 인수는 미실행이며 자동 skip/Gate 변경 0. 공적 Restore 형식·실제 원위치 적용·자동 업무 재개·프로젝트 DB snapshot/전체 관계, OS 경쟁·hardlink·특수 FS/reparse·강제 I/O 중단·전원장애 영속성은 미검증이다. 다음은 기존 exportProject(includeSource=false)를 통한 선택 문서 원본 반출의 서버·화면 연결이다. rollback은 소유 source checkpoint 정상 revert이며 실자료 변경은 없다.

## 최종 working 지문

- apps/server/modules/backups/file-restore-validation-input.ts — 1C382401831980AB927CF9A7AD6B821FC5AA9B79BF84E854BE3AF3CFC00131CF
- apps/server/modules/backups/file-restore-validation.ts — A6145CB651480F930296AC497F9DE2A941473C10B6F8608D0B83A7E0640AE362
- tests/unit/FN16/file-restore-validation.test.ts — E0DB09BE22756088DF0E02D0372AEBB9175B027D10D974EC451CD365930D61F5
- tests/unit/FN16/file-restore-validation-fixture.ts — C4422DAA62EC6DC4A51681BE51F1B31185D648CA8E8846A7C538521947D31D26
