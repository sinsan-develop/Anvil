# P03 RO 구조 metadata 조사 source 준비 검수 — 2026-10-27

## 판정
소유 shell·합성 집계·검토용 실행안의 준비 범위 C0/I0/M0. **전체 NOT_EXECUTION_READY**이며 실제 원volume/이미지/PG/DB 기능·복구 완료가 아니다. host60초/합계8KiB·단발/자원확인·정리 controller와 정확실행결정이 남았다. 이 준비를 사용자 기능 진도로 세지 않는다.
기준 f3d5357c099e6ef0edb79e7aa89d0eb888b319f3/branch codex/av3-stage-b, R2 범위6FC9A7CB0F6421944C60E7E8987DDF9579B9599F1844935381A58FC7CBE5E860, WI6C3BF818632322F2D235AD571C601597F1C109F85CE096889836C38CE4E0BE50. 단일 담당 p03_discovery_preparation/Main 관리검수통합·Main 제품 코드 수정0.

## 소유 변경과 효과

| 신규 파일 | 최종 raw SHA256 |
|---|---|
| scripts/pg-recovery-discovery-readonly.sh | 156867EF53948C2A18CF439EBA8DB46ECF461AB11FD86116239B2E5FEC9A480B |
| tests/unit/P03/pg-recovery-discovery-preparation.test.ts | B90F8D8799ABF4DB877227BDEBE48CBAD5CBDF80BA7F015EB1AD13EE7E8A96FB |
| docs/work_packages/P03_PG_RECOVERY_DISCOVERY_EXECUTION_PLAN_20261027.md | 32E9DD88D6C0EE7B7E7B46EE3CCDD58CF333144525096B4546A0B1D01A949A19 |

import/무인자 실행은 함수 정의와 PREPARATION_ONLY뿐이다. 실제 조사는 명시 단일 flag일 때만 진입하며 그 문자열은 사람승인을 인증하지 않는다. source 종류·수치 metadata만 집계하고 filename/내용/hash·PG_VERSION·Secret/설정/PGbinary 실행은 제외한다. 미실측 image tool주소/기능·PG계정을 실제값으로 가정하지 않는다.
단일 numeric stream의 regular/dir/link/특수 entry·고유 device/inode·regular logical/allocatedbytes를 구별하며 hardlink 모순·부분순회/END 누락·필드/정수/합산·entry100000 초과를 실패로 닫는다. 출력은 고정 status/수치/허용 image toolpath/hash뿐이다. 파일 내용을 읽거나 수치 문자열을 실행하지 않는다.
새 helper literal/RO mount/UID999·실PGUID구별/networknone/rootfsRO/한도·자신fullID정리/원volume보존 후보는 실행안에 있다. 이는 도구 지원이나 실제 host controller가 구현됐다는 뜻이 아니다. 동작 준비·실제생성/관측·복구의 단계는 분리한다.

## 실행·실패·보완 증거

1. Main4adab0: 신규 명시8 시험의 PREPARATION_SOURCE_MISSING RED/exit1. 이때 Bash 미시작이다. unit의 HOME=/nonexistent 항목은 자식 실행 전에 제거했다.
2. 담당 첫 GREEN 시도: sandbox Git Bash NtCreateDirectoryObject0xC0000022·초기3221225794, 0PASS/8FAIL2121.0343ms. 집계코드 도달 증거0·다른도구/WSL 우회0이다.
3. Main341982로 import/default/순수 숫자만인 시험을 읽고 동일명시파일을 허용환경에서 a26153→02ee26 실행: 7PASS/1FAIL15906.5842ms. 100000 entry가 spawnSync15000ms ETIMEDOUT으로 실패했다. ae4158 별도 읽기는 해당 script/p03_aggregate Bash 생존후보0이다.
4. source 실패 ENTRY_100000_BASH_LOOP_DEADLINE1회: 행별 Bash 비용을 고정 /usr/bin/awk stream으로 보완했다. local Git awk 존재/779620bytes는 담당 읽기다. unit raw/기대·15000ms/entry100000은 불변이며 이미지 awk/canonical 지원은 여전히 미실측이다.
5. Mainfa6611 동일명시 node --test tests/unit/P03/pg-recovery-discovery-preparation.test.ts →8PASS/0FAIL/skip0/2059.8609ms, entry경계648.5426ms. 정상·다른device·hardlink·부분실패·악성필드·안전정수·entry상한의 합성 stdin만 검증했다. 실제source metadata가 아니다.
6. Main99f2fc: local Git Bash --noprofile/--norc -n 및 인자없는script 실행 →각 exit0/정확기대출력/stderr0. 실제main flag는 전달하지 않았다.
7. 독립 C0/I1/M0: consumer 조기실패시 producer의 printf stderr가 열려 raw Bash/script 경로를 노출할 수 있는 PIPE_PRODUCER_STDERR_UNCLOSED1회. producer 블록 전체의 stderr만 닫았다. 기존집계/unit은 불변이다. 실제 고장주입은 하지 않았다.
8. Main0b0abb: 최종source의 한 줄 redirection을 메모리에서 역대조한SHA가 보완 전 C0BB0CCC와 정확 일치, 최종Bash -n0/출력0·typecheck/diff0. 기존8은 집계코드 불변이므로 반복하지 않았다. 독립 scoped I1 ADDRESSED/C0I0M0·수정/실행0. Main5121eb 보호8 raw 불변이다.

초기 관리shell Git 격리오류1/정본package 미존재읽기1은 기능오류와구분했고 config/ACL 우회0이다. 담당의 일본어표현은 한국어로 정정했다. 집계 deadline과 producer stderr는 서로 다른 root/fingerprint 각1회이며 동일실패3회로 합산하지 않는다. 초기실패/미검증은 지우지 않는다.

## 미실행과 정확 다음

실제 scanner flag·SSH/WSL/Docker·원volume 구조/파일·PG binary/SQL·copy·Secret·서비스·Agent·기존PG_VERSION/C# 시험은 이번에0이다. 임시fixture파일/QA/container/volume생성0이며 정리할 새metadata 자원은없다. local Node/Git Bash 합성 검증과 관리shell읽기만 실행했다.
실제 image 도구/GNU·PG 숫자계정/source 권한/용량·일관성/외부설정·host60초/합계8KiB/단발·종료/정리 controller·실행준비·DBready는 NOT_RUN/미완료다. 실행안에남은조건을숨기지않고고정script/argv제안만으로실행하지않는다.
다음은 exact sourcecheckpoint/private 보존 뒤 기존 controller 재사용 여부와 최소 host 제어 준비를 검토해 한도/신원/정리의 공백을 메운다. 새 RO 효과는 정확 직접 결정 전 실행하지 않는다. 기존 원volume/PG설정·Secret·서비스·승인/marker·보호8은 보존한다. rollback은 소유신규3파일 후속 정상 revert이며 원자료 자동삭제0이다.
