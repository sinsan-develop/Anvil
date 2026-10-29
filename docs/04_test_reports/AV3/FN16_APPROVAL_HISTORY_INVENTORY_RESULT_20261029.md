# FN16 승인 저장상태 내부 수집 결과 — 2026-10-29

## 판정·기준
내부 승인 저장상태 수집을 Main 신규15합성PASS/type·diff0로 검증했다. 독립최종 대조 뒤 인수하며 전체 FN16/실사용 백업·승인 복원 완료가 아니다.
branch codex/av3-stage-b, 시작73a9c6b79d3f792f24a5b55b245a9b1f2039b67c. WI docs/work_packages/FN16_APPROVAL_HISTORY_INVENTORY_IMPLEMENTATION_20261029.md SHA256 3DFB0265F1304A58939B24E077EBBF7E68333874B694ECB698A1403E90C9AA7B. 신규 approval-history-inventory.ts/행동·schema시험2만 허용. 기존source/20조합·SQL/Git개발자변경0·실제DB/키/서비스/계정·파일/Agent0. Main관리검수통합·Primary단독구현/Reviewer읽기.

## 변경·보존
승인요청17열/결정14열/소비8열의 프로젝트 전체 저장행과 해당 command20/권한영수증9/감사16열의 선택증빙만 수집한다. 원요청ref는초기불변v1/현재head1~3과구분하고,결정원hash와소비scopeDigest도구분한다. 소비에없는원bodyhash/version을발명하지않는다.
현재저장7상태를보존하며 EXPIRED/REVOKED의전이원인·현재효력을계산하지않고미판정issue를남긴다. 추가원형모두null인자료는원인/legacy단정없이refnull/derivedMetadataHash와미검증을보존하고부분null/확인가능원형불일치는503이다. 원형없는자료와연결된기본row의확인가능주체/client/세대·candidate/FK·scope관계검사는유지한다. 원형이없는hash를다른형태로발명하지않는다.
원hash검사·익명projection을분리하며 actor/client/rawJSON·명시비밀은결과/오류로반환하지않는다. 현재policy/control/users나ProjectApprovals의현재조회함수를호출하지않고과거만료·시각역전을보존한다. 전체전환이력테이블은없으므로현재storedsnapshot만수집한다.

## 검증·오류 이력
- Primary481282 RED 신규11개0PASS/11FAIL/skip0/195.9147ms:source미구현.
- 시험I1 VersionRef정상미포함을보강했다. ArtifactRef(uploadArtifact)는Main10674f 실제소비SQL/producer허용확인,추가VersionRef정상도실operation/상태/증빙에결박했다. REJECT/원requestRef/candidate·민감음성은독립재봉인해앞선hash불일치로가려지는한계를보완했다.
- 제품I1:원요청5필드null/미지원details일때소비c와결정기본row의actor/client/control 비교가빠짐. 항상검사하는3조건을추가했다. Primarya0f4c8에서3조건만제거한단발전형으로CLIENT Missing expected rejection RED1을확인하고finally정확복원했다. CP949출력오류는ascii escape로교정/복원성공과분리했다.
- Primary7edae6 신규15PASS/0FAIL/skip0/621.3875ms/type·diff0.
- Mainbac548: node --test tests/unit/FN16/approval-history-inventory.test.ts tests/unit/FN16/approval-history-inventory-schema.test.ts →15PASS/0FAIL/skip0/604.1076ms/exit0. npm run typecheck·git diff --check exit0/최종3지문일치.
- 실6표메모리SQL로전체7상태·빈/원형부재혼합·초기ref/현재head·소비시각역전·201keyset/만료PENDING보존·독립재봉인관계/민감·고아/중복/APPROVE외소비·양target형식·선택증거·rowbytes/총metadata·신원/기한·COMMIT취소/회수불명503을확인했다. 완료된20수집기전수반복0.

## 지문·미검증·복구
source DFC5E55516894F588FFDCF1009C7A20CBBB6F19860D9E895E51228AF4FDD2E86, 행동619D9DDB420EAC2B774BF70ADE8E42938965EC8247F3A843D1532A4F1FB9A415, schema8281F2E447ABB50F7813EE4C9392A02C1F38F04C7DF7176C13C356809FB20DFD.
실제PG/RLS·동시변화·키/서비스·전체상태전이/원payload·전체command/auth/audit원장·업무산출물/현재승인효력·원승인/권한복원·archive/복원/UI인수 NOT_RUN. effectiveState NOT_EVALUATED/stateTransitionHistory NOT_RECORDED_BY_CURRENT_SCHEMA/currentAuthority/requestReconstruction/domainArtifact/auditChain/blob NOT_PERFORMED,전체명령/영수증/감사/인증감사 NOT_COLLECTED. fullcoverage/restorable/approvalEffective/authorizationRestoration/executionAuthorized/dispatchPerformed/atomicfalse.
다음은이수집의정확요청/결정ref를기존조합에연결하는선행대조다. Main만신규3+WI/결과/WORK_STATUS/WORK_PLAN 정확7경로checkpoint. rollback은신규3의검토된revert/승인·자료·백업삭제0. 158E10후보미채택/API·실행허가우회0·전체WORK_PLAN미완료.

독립최종4a99ad C0/I0:제품I1 actor/client/control결박·nullable미지원요청반례/VersionRef정상·독립재봉인음성·최종3지문일치확인. Mainbac548과함께이번내부source만인수한다.
