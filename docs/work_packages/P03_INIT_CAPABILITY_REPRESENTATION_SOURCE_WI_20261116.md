# P03 init capability 표기 동등성 소스 보완

직접승인실행의고정8d source는원격에서수정/재실행하지않는다. 이번작업은계획P03의실패원인보완을위한현재로컬branch source·RAM시험한정이다. 실제승인1회는이미소진됐고기존init/사본/원장보존·PG/SQL/키/서비스/Agent/SDK/원격추가조회/정리0.

## 근거와 불변 조건

원5909d3/e76e5f의init은--cap-add CHOWN으로생성됐으나inspect CapAdd는정확단일[CAP_CHOWN]이다. scripts/p03-pg-copy-host.ts의strict own과limited ownLimited는[CHOWN]만same비교해이한조건은필연실패한다. 이것을유일원인/전체식일치라고단정하지않는다. 나머지실제mount/identity검산의미확인은유지한다.

## 단일 writer 허용2경로

기존developer_primary만아래제품1/시험1을수정한다. Main은문서/독립검수·통합,같은코드수정0. 다른작성자의변경을되돌리지않는다.
- scripts/p03-pg-copy-host.ts
- tests/unit/P03/pg-recovery-copy-host.test.ts

init에서CapAdd가정확singleton CHOWN 또는CAP_CHOWN인경우만동일권한으로판독한다. 일반prefix제거/casefold/빈값fallback/임의cap추가/중복허용0. tools/copy는기존empty검산,CapDrop exactALL과나머지mount/image/owner/labels/time/identity/gates는불변이다. Dockercreateargv/cap요청/범위·한도·grant/소비·정리조건은바꾸지않는다. 신규공개API/실권한부여/실행허가0. 불필요한공통화/새export0.

## 검증

실제CAP_CHOWN형상반례RED→GREEN,기존CHOWN양성/strict·limited양성및extra/duplicate/mixed/null/foreign/lowercase/다른role음성. 기존원본RO/일회소비/불명정리차단검사보존. 직접파일및필수인접Docker-time회귀·typecheck/diff/지문/검수자료제출. RAM/주입ports만사용하며실Docker·원장·파일자료/실제원격effect0. source보완성공이실복제성공이아님을명시한다. 정확허용경로변경필요시쓰기전Main에반환한다.
