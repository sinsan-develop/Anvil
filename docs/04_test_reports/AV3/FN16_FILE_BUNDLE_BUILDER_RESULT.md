# FN16 실제 파일 보관본 생성·재읽기 내부 builder

판정: **내부 생성기 구현·합성 파일 핵심 동작 확인, FN16 전체는 부분 구현**. 실제 새 보관본과 metadata를 만들고 다시 읽어 독립 기준에 대조한다. 공적 반출 형식·API/화면·실제 사용자 백업·DBsnapshot·복원은 미구현/미검증이다.

- 기준 codex/av3-stage-b 47dd7d8c2e6264c313f2fded155935a3dd6119ab, WI7E45B392CEA58CBA7B06CF917FF5E9BF91739755518F522F5131B1F8A9A97640/preflightC0I0M0. 구현 fn16_file_bundle_builder, Main 어울 관리·검수·통합·제품수정0. 신규4파일만, 기존manifest엔진/정상코드변경0.
- 최초await전원선택/version·manifest/독립hash·목적지/예산을고정하고원Signal의후속취소를관측한다. 기존빈목적지도배타생성거절, payload/metadata이름을분리하고bounded순차복사·source전후identity/bytes/hash·dest/metadata재읽기·최종inventory/기한검사를소비한다. 민감/제외원본open0, unknown/교체항목보존·현재identity확인소유파일/빈dir만실패정리,recursive삭제0.
- 실제bytes보관성공의false!==true RED→GREEN, 최종unknown유입true!==false RED→GREEN. 모듈부재를기능RED로세지않았다. 신규 node --test tests/unit/FN16/file-bundle.test.ts 담당자21PASS/FAIL·SKIP0/13766.4563ms, fixture실경로보강후BOM/최종unknown/중첩집중3PASS2098.9861ms·typecheck0. 마지막EOF/LF정리만추가했다.
- **Main846b09→동일session96541→e0fe95 exit0**, exact4hash확인후fresh21PASS/FAIL·SKIP0/25116.2602ms. 실제복사/재읽기·원파일중간변경/독립기준변조·기존목적지보존·민감미접근·읽기/쓰기/zero-write/file·directory close실패·최종기한/lateabort·unknown보존/정리거절·다중중첩파일을검수했다. 독립읽기검수C0/I0/M0·수정요청0. 제출PASS를실행PASS로대체하지않았다.
- 등록D:/tmp/anvil-v3-stage-b/fn16-file-bundle-20261027-01의합성source/target-parent만각freshowner SINSAN\cyhuh/nonlink/realpath확인뒤생성했다. Main실행20:02:17.542Z~20:02:40.913Z(2026-10-26)에각case즉시개별회수/residualfalse,등록syntheticunknown은제품보존assert뒤fixture소유증거대조·마지막명시회수. 별도root부재·해당단위process0확인. 실제사용자자료삭제0/권한·ACL/DB/서비스/Secret/Agent/native변경0.
- 오류: nullable타입진단7건/수정묶음1·시험mock복구호출오기6FAIL/공통1·fixtureunknown등록조건1·EOF공백2 모두정정. sandboxGit128은exact승격읽기로구분,Mainc4e2ee CIM기본권한거절은process0판정에쓰지않고1891bf/최종승격읽기로별도확인했다. 정식FAILURE_REPORT0·기대/한도완화0.

## 미검증·복구·다음

complete는내부선택파일보관본검수이며프로젝트전체완료·Secret-free/실제권한/복원가능·durability인증아니다. OS타프로세스TOCTOU/hardlink·특수FS/reparse·강제I/O중단/전원장애,DBsnapshot·전체관계복구는미확인이다. 단일cooperativedeadline과유한데이터크기를적용하지만OS작업강제취소는보장하지않는다. 공적wire/API/자동보관삭제·암호화/사용자복원으로활성화하지않았다. 다음은보관본독립검증·정확caller/화면소비연결이며같은계획작업을계속한다. Rollback은소유source checkpoint정상revert·실자료변경0.

## 최종 working 지문

- apps/server/modules/backups/file-bundle-input.ts — D299381099E5AD17E329D0208BDDAF95E58D1CAF3FBD53F0E62915BB399C9890
- apps/server/modules/backups/file-bundle.ts — 973DD9B44BFF47196E05205530C9C40865362D34F6085073A93582C11042DB5B
- tests/unit/FN16/file-bundle.test.ts — 91A112BF85C7BE5149ADD76ADA7BB0F936F595250461A9234662F689B77B3D02
- tests/unit/FN16/file-bundle-fixture.ts — 2074671C03940CFBBC4DC4A42BC868E73DE08A86736F15DAFB69F04B6C38E2E8

검수 환경 보충(2026-10-27): 이 집중 검수는 등록된 Windows/PowerShell7 QA에서 실행했다. 전체 npm test와 Linux/WSL 실행은 이번 미실행이다. package.json의 전체 unit glob에는 해당 시험도 포함되나 저장소에 CI workflow/실행 OS 정의는 확인되지 않았다. 기존 FN06/FN08에도 Windows 전용 시험 전제가 있으며 새 builder만의 Linux CI 실패를 주장하지 않는다. 향후 Linux/WSL 전체 Gate 지정 시 실행 대상/QA 프로파일을 명시해야 하며 자동 skip이나 교차 OS PASS로 숨기지 않는다.
