# FN02 빈 프로젝트 방법론 적용 — 실제 workflow 격리 결과

2026-10-20 / Main 어울 / 기존 Stage B FN02의 한정 핵심 검수. 전체 기능 완료 아님.

## 판정과 후보

- **한정 PASS**: 실제 repository 로그인·재인증 + Fastify inject 기반 인증/CSRF·API·DB transaction을 확인했다. HTTP 로그인 endpoint/socket·served UI 검증이 아니다.
- exact source `e196a057b5882ab4476c8b42d17fb7f7f05efb49`, private codex/av3-stage-b. SQL `E9DEE26A03DDD643F06DDC9DFBFE39DCCFB91FC305FCC465E53A5D15FD2880C6`, runner `680A74643FDEC6953AF76DA27EBFE47F84547CB9ADCF9E95ACAB1AF27D3698FA`, test `FEC2770C6626B61BB5CF94F93D51BD7BBD8E712DC948F5341594E2A316D242CA`.
- PMO는 QA문서 `9CE5B67C5BBEDA4DD48BD96A48999DA468514E95B86D122A85754BA4D5A0B998`의 한정 범위를 기존 승인 계획 필수 검수로 확인했다. 독립 정적 C0/I0/M0이며 원 I1은 아래 보존한다.

## 실제 실행

새 빈 등록 PG15/image6eb0add3/ID594290·internal network·tmpfs256MiB/publish0에서 exact53개 SQL/ID/checksum·초기guard 함수정의 동일을 확인한 뒤 다음 명령을 실행했다. 이전 canonical/graph 함수 시험은 반복하지 않았다.

`ANVIL_FN02_QA_SHA=e196a057b5882ab4476c8b42d17fb7f7f05efb49 ANVIL_FN02_QA_SQL_HASH=e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6 ANVIL_FN02_QA_UNTIL=<당회20분기한> node --experimental-strip-types scripts/qa-fn02-empty-application.ts --workflow`

exit0, status PASS/phase DONE, failure·cleanupFailure·diagnostic null, applications2/actualAgentCalls0/formalDbChanges0.

| 실제 marker | 검증 범위 |
|---|---|
| NO_POLICY_DENIED | 명시 정책 부재 거절 |
| CONFIRM_NOT_APPLY_UNCONFIRMED_DENIED | 미확정 적용 거절·검토/확정만으로 적용행 생성0 |
| EXACT_APPLY_COMMIT_REPLAY_WEB_READ | 첫 명시 적용 COMMIT·이유/원문ref/hash·동일 명령 replay·내용변경409·기존 Web reader의 inject 조회 |
| RECEIPT_ONLY_DEFERRED_COMMIT_ROLLBACK | 같은 TX 명령/영수증/감사 각1·적용행0·callback정상완료 뒤 COMMIT42501·원 명령 rollback |
| SAME_GENERATION_API_SINGLE_APPEND_OLD_SNAPSHOT_UNCHANGED | 두 API 명령200/409·세대2단일append·첫 snapshot/hash불변·최신재조회 |
| ROW_ONLY_AND_POSTCOMMIT_MUTATION_DENIED | 잘못된 명령 설정의 row-only INSERT 즉시42501·적용행/명령 UPDATE42501 |
| CURRENT_DENY_AND_OLD_GENERATION_REPLAY_REJECTED | 현재 DENY403·옛 control generation409, 과거 replay도 우회0 |

다른 사용자404/client403·동일source중복409·stale source409, 최종7원장/outbox0도 시험 assert로 확인했다. API경합은 같은 auth/control 경로이며 원장 직접 INSERT 경합 증명이 아니다.

## 원 지적·오류와 조치

- 원 I1: INSERT42501도 COMMIT음성으로 오분류 가능 → TX내3행/적용0·callback완료 확인을 추가했다. type0·한정 재검토 C0/I0/M0. 실제 COMMIT은 위 시험에서 별도로 확인했다.
- 준비 npm ci102packages exit0/Node24.21.0, 등록전용 cache만 사용. 명령 마지막 SQL checksum 경로에 stdin CR이 붙어 준비 shell exit1이 발생했다. 설치/Git/앞2hash는 성공한 상태였고 재설치하지 않았다. 후속 shell 입력의 CR 정규화 뒤 SQLhash 일치·실제 시험 exit0. npm 새버전 notice는 자동설치/설정변경하지 않았다.
- 첫 비재귀 cleanup은 디렉터리의 하위삭제 후 size/mtime까지 동일 요구한 AssertionError1로 일부416파일 삭제 후 중단됐다. 원 실패와 독립잔여 확인 실패를 숨기지 않는다. 남은 exact2경로를 재목록/hash/UID/link/process0 고정 후 디렉터리는 inode/dev/mode/owner와 빈 상태, 파일/링크는 원 size/mtime도 검사해 회수했다. 이 cleanup 오류는 제품 기능 실패로 합치지 않는다.

## 자원 정리·불변

- PG ID `7a1a695c1e34df8ad497dc19d4929afb80a37fd46d362fd5cc1394ad97f67f70`, network ID `ec9d9f8aed1cd613adca8d6ac116199ed486703c1289be95b59cb9c43f78236d`, instance `d6bc3a7dc5adc157e6b70057fbfca3c1`. runner finally 회수 후 별도 부재 확인.
- Git `/home/daon/deploy/anvil-v3-fn02-empty-application-qa-01`: 최초7155파일/684하위dir/13link·155815713bytes·inventory e58a8929. 부분회수 후6739파일/684dir/13link·152811962bytes·inventory `5b15d3374517473d871dec038af99e1c00beeec0d70a7029852deb7d6c676815`, 남은7437entry(루트포함) 정확 회수.
- cache `/tmp/anvil-v3-fn02-empty-application-01`: 204파일/374하위dir·35351384bytes·inventory `59b688e56d1d551c9649ac31a7fcd9d3b6e1c7a1aaa524529691cd51e1dfa864`, 579entry(루트포함) 정확 회수.
- 새 SSH exit0 `REGISTERED_QA_RESIDUAL_ZERO`: 등록 Git/tmp 두 경로·PG/network 잔여0. 소스는 private exact에 보존하며 shared cache/다른 자료 삭제0.
- 기존 정식PG e6f798c3… exited/Runningfalse/Pid0/Exit0/OOMfalse·Started2026-10-18T15:25:12.085069883Z/Finished2026-10-19T12:56:52.490883698Z·image594290·127.0.0.1:5546정의 전후동일, Windows3830/5546 listener0. 정식DB/runner등록·서비스/실계정/정책/Secret/cert·Agent변경0.

## 남은 핵심 작업

UI03의 별도 명시 적용·미확인 명령 재확인·재조회 연결, 초기 createProject 실행 회귀, 7원장 직접 INSERT와 적용의 경합/다른project·비기본isolation 영향, 정식개발DB/served는 미검증이다. 일반 함수/단위PASS로 이를 완료 처리하지 않는다. 다음은 UI03 기존 계약의 실제 적용 소비를 이어간다.
