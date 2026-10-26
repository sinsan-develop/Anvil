# FN16 선택 파일 보관본 생성·재읽기 내부 builder

기준 codex/av3-stage-b 47dd7d8c2e6264c313f2fded155935a3dd6119ab. 승인 FN16 수동 백업생성의 내부 부분구현이며 앞선 file-manifest 엔진은 읽기만하므로중복아니다. 실제선택파일의새보관본을생성하고다시읽어원선택/version/기대hash와대조한다. API/catalog/generated-types/공적Backup·Export형식/DB·실사용자자료반출·복원등록0. 내부임시구성은공적호환형식으로채택하지않는다.

## 단일 writer 허용4신규경로

- apps/server/modules/backups/file-bundle-input.ts — 내부caller입력/결과검사.
- apps/server/modules/backups/file-bundle.ts — 실제fs 새보관본생성/재읽기·소유실패정리.
- tests/unit/FN16/file-bundle.test.ts — 실제합성원본/목적지·원bytes/hash와부작용검수.
- tests/unit/FN16/file-bundle-fixture.ts — 아래exact QA만fresh생성/회수.

기존4manifest코드/다른모듈은수정하지않고소비한다. 새helper수정이필수면정확근거/diff범위를Main에먼저보고,인접정상함수를몰래변경하지않는다.

## 내부 동작·안전

1. 원선택·원문version참조·기대manifest/hash·source입력·유한예산/취소·새목적지경계를첫await전에고정한다. 외부mutable객체를진행중새정상본으로채택하지않는다. manifest엔진의독립기준검사를소비하고단순사전hash/복사성공만으로확정하지않는다.
2. 기존목적지는빈폴더도재사용/덮기0. 명시한보호parent하의새destination을배타생성,source/destination상호중첩·link/경로이탈·목적지data/내부marker이름충돌차단. 내부payload폴더를분리하고상대선택원본이름/bytes를그대로보존하는방식권장. manifest내상대경로를실디스크권한허가로취급하지않는다.
3. 선택included파일만순차적으로bounded읽기/쓰기,실제읽은bytes/hash·원파일전후안정성을비교하고새목적지를다시읽어원manifest/독립expectedhash와검수한다. Secret/credential/명시제외항목은원본미읽기이며제외이유를보존한다. .gitignore자동누락0·본문인코딩/압축/실행0.
4. 같은유한시간/byte예산을source검사·복사·handle종료·재읽기/최종marker계산/반환에적용한다. 정상/실패/취소모든handle종료,최종검수/기한·취소뒤만성공. metadata/marker존재만으로완성·진위/durability인증0. source변경/누락/변조·용량·쓰기/close/검증실패는불완전/실패로명시한다. 부분생성을전체성공으로숨기지않는다.
5. 실패회수는해당호출이배타생성해현재identity/범위확인되는파일과빈dir만. source·기존destination·사용자backup삭제0. unknown/교체/link/정리실패는보존하고상태·안전한사유/소유정리내역을반환한다. 자동retention정책/임의recursive삭제0. atomic rename/no-replace·전원장애durability·OS타프로세스경쟁/hardlink/specialFS보장0.
6. 현재caller는아래합성QA만허용. 이라이브러리가인증/읽기허가/목적지소유자결정·OSsandbox가아니다. 생산caller권한·신뢰root와DBsnapshot/프로젝트전체관계는후속연결이며전체백업·복원가능/secret-free를주장하지않는다.

## TDD·검수·자원

의미있는제품함수반례RED→GREEN; 실제BOM/CRLF/binary 보관bytes+hash/재읽기, 독립기준/원선택변조·중간source교체, 기존빈/비어있지않은목적지보존, 중첩/link·metadata이름충돌, 민감원본open0, bounded크기/기한·취소·읽기/쓰기/close실패, unknown출현보존/소유정리·handle0를위험에비례해검수한다. 파일존재/모듈부재assertion은기능RED와분리. 원기대/한도완화0·전체기존회귀반복0. Node집중/typecheck/diff/독립리뷰, Main제품수정0·동시writer1.

사전등록exact D:/tmp/anvil-v3-stage-b/fn16-file-bundle-20261027-01, owner SINSAN\cyhuh, fixtures/source 및 fixtures/target-parent 이하합성case만. 생성직전대상부재/부모owner·nonlink·realpath검사, 각생성최대30분·종료/실패즉시소유파일/빈dir만정리·별도잔류0. 기존manifest QA root/기존자료재사용0. fixture상Unknown보존반례는등록시험이만든synthetic파일이며소유증거/순서검사뒤명시정리한다.

실제DB/Secret/권한·인증서·서비스/Agent·네트워크/의존설치·native/compiler/실사용자backup/자동삭제0. 새로운public자료형·보관주기·키/암호화·포트는결정하지않는다. 코드/테스트4경로외/문서/Git쓰기0, 완료보고는정확명령/exit·hash·원RED/보정/실제fs·소유정리시각·미검증·writer해제. rollback은소유source checkpoint정상revert·실자료변경0. 다음은정확caller/화면/공적자료계약의소비연결이며이번완료를FN16전체로올리지않는다.
