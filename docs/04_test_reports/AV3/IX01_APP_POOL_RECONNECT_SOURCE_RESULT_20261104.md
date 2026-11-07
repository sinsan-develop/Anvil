# IX01 접속·app 재생성 source 결과

판정: SOURCE_ONLY 검수·scoped C0/I0/M0. 실제 PG 여정·재접속·프로세스/화면 재시작·IX01 인수는 NOT_RUN.

- 담당 기존Primary·Main어울 독립인수. WI0448f5784d2c9e96bdc5785795489975fa4b2c6052457715dde6bd88b5f34e60/기승인WORK_PLAN Stage B IX01의재조회요구보완.
- 기존 시험의appPool/access/app을인스턴스직접캡처형factory로만들고같은시험메모리installationId/key·원token/CSRF/client/ref를유지한다. adminPool/PG/artifact root는유지하며원app→pool확정종료/fresh뒤새문맥으로고정GET·원문/물리행·command/receipt/audit수를대조한다.
- registerJourneyClose는자원별promise1개를캐시하고명시close/finally는같은promise를관측한다. sync throw/reject/pending·각await뒤기한초과면새생성0,부분factory자원은즉시소유등록한다. 원음성·replay·90초/10분·권한/sourcehash/manifest/markerguard보존.

## 파일

- tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts 35006B / 87B70EEBEFE3D18ECB203A35956D3BF9F25063E8555DE281E0537CCED866F25E
- tests/integration/IX01/journey-context-lifecycle.ts 694B / 90D4107FD6E7C15545333AFCB0EBAB2D06C44660605166233D1198DAE91736C9
- tests/unit/IX01/journey-context-lifecycle.test.ts 4862B / 276753C9F694F534D9D0782F1648B7156AD2EBF8ABE7D5ECFD4EDBFD1E804C28

## 검증 분모

- Primary014e0f 모듈부재RED exit1(행동assertion RED와구분)→516d1d 신규unit5PASS/skip0/106.35ms.101e56 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json exit0/5.9666초.7f5d2e 변경역치환부모raw동일/기존guard·음성·replay·cleanup보존/diff0.
- Primary56ceb8 공개OS경로변수만전달한child의integration기본모드 0PASS/1SKIP·NOT_RUN/exit0. 실옵트인/계획/비밀env전달0·실여정PASS아님.
- Main988277 helper/5unit·실integration diff독립읽기와fresh5PASS/skip0/116.7739ms·diff0.977f32 문서상세의영속document/body와목록observedAt을구분해재접속비교가저장값임을대조했다. 시점별목록timestamp를영속자료로비교하지않는다.
- 실제소비선:integration94~101 생성/즉시소유등록,173 종료재생성,179~183 고정조회/불변,201 최종정리. 원ApiClient/send는현재app변수를소비하며원세션은새AccessRepository의같은인증설정으로검증한다. 타입검사는이후코드변경0으로재사용/무관56·환경50·native44·회원16재실행0.
- 구현·검증준비오류Primary0. Mainc81b14의후속준비읽기는0001_auth_schema.sql경로추측으로1회부재였고49217 rg에서실0000_environment.sql의schema_migrations생성을확인했다. 파일/환경변경0·이번5unit제품실패와구분.

실제DB/SQL·권한·키·서비스·Agent·WSL·P03R3·새QA실행0/소진R9재사용0. 제품API/권한계약변경0·실키생성/보관/출력0. R9는105정의설치한정확인이고원R1~R8실패UNKNOWN·감사·전체계획미완료를보존한다. rollback은소유3파일을원부모7DB320AC와비교·복원하는범위다. 새실행준비기와실PG/자격증명·artifact·seed/ledger·재접속검증실행안은별도후속이다.
