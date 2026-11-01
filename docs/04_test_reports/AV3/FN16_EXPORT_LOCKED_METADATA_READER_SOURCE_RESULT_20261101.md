# FN16 잠금 metadata 보호 조회 r2 A source 검수 결과

2026-11-01 / Main 어울 / 기존 Primary 수행·기존 Reviewer 독립 검토.

## 판정
직접 채택된 r2 A의 제품·미적용 SQL·합성 검증을 구현하고 Main 신규9PASS/0FAIL/0SKIP·type/diff0, 독립 최종 scoped C0/I0로 source 범위를 검수했다. 실제 PostgreSQL 권한·RLS·잠금 경합·파일반출·서비스 반영은 미검증이다. 전체 FN16/백업·복원/WORK_PLAN 완료는 아니다.

## 승인·변경 이유와 동작
승인 후보2B351AA71037E43474CF767962821578B1F5DF49600E832AA17AF3D26BD59881·WI 보완1 7AEC3D2550CE3EF08C71A9D58FDAA88CA1FED068E8BE3C6216C5D36D57FA55D5. 시작 제품135244786a377bd6ab1cdca7e01312b60f075b44의 기존 backup source E1BE0569FE6925CE6B88965C0AF98FBD88FF72CCF45CBFDE8F54121497824A4B를 최소 수정했다. branch codex/av3-stage-b·단일 Primary writer, Main 제품write0.

이전 sourceRow는 앱 UPDATE 회수와 충돌하는 artifacts SELECT FOR SHARE를 직접 호출했다. 변경 후 현재 AuthenticatedIdentity.authSession.id/actorId/clientId와 고정 선택5값을 같은 PoolClient의 고정8인자 보호함수에 전달한다. 잠금 없는 fallback·앱 UPDATE 부여·신원 임의보충은 없다. 문서fullref/hash·본문/첨부귀속→exact8열/5조건/storagekey→기존 READY/inspection/실bytes검사와 create/job/file의 같은 인증 주체 전달을 보존한다.

0066.pending은 전용 NOLOGIN/NOINHERIT/NOBYPASSRLS 소유자, 최소 SELECT/잠금용 UPDATE(id), 고정 SECURITY DEFINER/VOLATILE/PARALLEL UNSAFE/search_path, 실제 app session·활성주체/회원검사·동일Tx FOR SHARE를 정의한다. 동명role/함수 인수 거절·PUBLIC회수·임시 CREATE/멤버십회수·후검산과 RLS불변을 포함한다. 역사 조회를 OWNER/control/미보관 전용으로 축소하거나 아직 없는 APPLIED command를 선행 요구하지 않는다. 함수 부재42883은 EXPORT_STORAGE_FAILED503,42501은 기존 EXPORT_STORAGE_NOT_READY503이다.

## 구현 범위와 기존 시험 보호
제품1·신규pending SQL1·신규순수시험1, 기존 직접caller 시험1·메모리fixture1의 정확5경로다. 기존 시험은 sourceRow3호출에 기존fixture actor만 추가했고 기존 거절 단언을 보존했다. fixture에는 새8인자·주체/회원·5조건을 검산한 exact8열 분기만 추가했다. 원단일행/분기를 역치환하면 시작696229EA/B1085402 bytes가 복원됨을 수행자와 Reviewer가 확인했다. FShelper 본문과 수명/정리·다른 SQL분기 불변이며 기존 FS시험 전체는 실행하지 않았다.

## 검증·실패 이력
- TEST_ONLY c1b12f: 실제sourceRow의 정상 문서검사 뒤 메모리 앱권한모델42501 RED, 문서hash/첨부음성1PASS로 1PASS/1FAIL·780.4368ms. 끝의 해시조회가 wrapper exit0을 만들어 native 종료값은 NOT_CAPTURED다. 이 실패는 실제PG 증거가 아니며 재실행하지 않았다.
- 수행자42650b 최초2PASS/native0→86e71a 기능8PASS/native0→70c033 최종9PASS/548.3466ms/native0,0d8a60 type0. 이후 제품변경은 erasable 타입 표현1곳이며 역치환 시 시험당시CC48E46F와 일치했다.
- Main eb2603: 최종5지문에서 신규9PASS/0FAIL/0SKIP·482.8889ms, 명령직후 native 종료0·type 종료0·diff0. 실제sourceRow/실bytes검사 함수를 메모리 자료로 소비하고 exportDb만 호출했다. FShelper·실DB·프로세스는 실행하지 않았다.
- 독립 중간 제품/SQL C0/I0와 최종5개 scoped C0/I0. 시작/끝5지문 일치·무관한 전체검사 반복0. 실제 권한/RLS/경합은 검토로 통과시키지 않았다.

정확 Main 명령:
```text
node --test tests/unit/FN16/project-export-locked-metadata.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json
git diff --check
```

준비 오류는 source/canonical cwd 혼동1호출/부재2출력, type의 기존직접caller3곳 누락과 metadata/inspection좁히기 실패다. af70c1 실패는 erasable 타입 표현으로 보정했고 optional인자·임의UUID·원단언 완화로 숨기지 않았다. 첫RED native 종료값 미수집은 그대로 남긴다.

## 미검증·복구·다음
0066 실제 CREATE ROLE/FUNCTION/GRANT/DDL·DB 접속/SQL 실행, 실제 키·계정/권한·사용자/백업대상 파일조사·FS시험·서비스·Agent 실행은 제외했다. 실제 PG15 동작/RLS·owner/ACL·잠금 경합·반출·복원·전체coverage·사용자인수는 NOT_RUN이다. 정책 부재는 fail-closed로 남기며 새 RLS정책을 추가하지 않는다. 실제 프로젝트 차단 해제·원본 보정·자동 적용0. 소유 QA/프로세스/livehandle0.

미적용 SQL이므로 실제DB rollback은 없다. source 이전 제품은13524478에 보존됐고 문제가 있으면 별도 forward수정/정상revert를 검토하며 dirty/untracked reset은 하지 않는다. 필수 실제gate 미충족으로 main병합/운영배포/작업branch삭제0. 다음 미완료 소비 경로는 이번 두 reader로 새로 가능해진 범위만 기존 Primary가 한정 읽기로 대조한다.

## 최종 source 지문5
| 경로 | SHA256 |
|---|---|
| apps/server/modules/backups/project-backups.ts | 55E76DC997577BEF1F16BF1E686954656CC29E15D2CBAE304801F37DC688255D |
| db/migrations/0066_export_locked_metadata_reader.sql.pending | 6FDE33E47828983B7B80398DFE9F60C8B36CDABF22DC2B4B09716060035F0496 |
| tests/unit/FN16/project-export-locked-metadata.test.ts | 4865A5B2B46360DC5B8889FF08C76ABEED8A004F6006A0B3D0B0355F26F0C09A |
| tests/unit/FN16/project-backups.test.ts | BE20A59351D0A0798B5A97D6C0801F772652D654634FFE0B49776DED9CD90E16 |
| tests/unit/FN16/project-backups-fixture.ts | CE3C45A36A68F4DBF60E016133F28DEAB53955E169A5165233BD6879C65348B1 |

## 커밋 사전 검사 오탐 보완
첫 commit963a5c는 gitleaks generic-api-key1건으로 차단돼 commit/push가 실행되지 않았다. redacted 진단14af49와 Main5c0c78은 신규시험52행의20bytes 합성 blobs 경로임을 확인했다. 실제 키를 읽거나 출력하지 않았다. 동일 문자열의 조각결합 표현으로만 변경했으며 hook/ignore/검사기준 우회0이다. 역치환하면 원시험95481FE9 bytes가 정확 복원되고 원단언·거절조건은 같다.

수행자 cd2535 순수9PASS/native0 뒤 Main841e33에서 최종시험4865A5B2의9PASS/0FAIL/0SKIP·428.0954ms/native0·diff0와 동등성을 확인했다. 제품/SQL·기존시험/fixture4개와 typecheck 검수 이후 런타임 변경0이다. 독립 단일줄 scoped C0/I0·새시험 시작끝지문동일로 마쳤다. 최초 차단을 PASS로 소급하거나 검사를 끄지 않는다.0066 stage의LF→CRLF예고경고는 보존하고 Git설정/내용정규화는 하지 않았다.
