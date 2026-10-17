# N4 새 API·UI11 개발 서비스 연결 — 범위 결정안

필요결정 ID: AV3-PMO-N4-SERVICE-TRANSITION-SCOPE. **2026-10-17T18:36:50Z 신산님 직접 ‘서비스 교체 승인해’를 PMO가 수신·전달했다. 권장A와 known 9bade63e 일반 detached 복구 범위 승인이다.** 무응답 위임이 아니며 같은 범위의 중복 승인·PMO 다음 업무 배정은 기다리지 않는다. 아래 제안 당시 문구는 이력이다. Main이 준비 코드·집중 TDD·독립 검토·안전 checkpoint/private exact SHA·script/flow/probe/asset fullhash·새 고정 UTC 창·단1회 바인딩을 기록/PMO 전달한 뒤 같은 승인 범위에서 실행한다. 현재 실제 서비스 전환은 미실행이며 검토 PASS를 실제 성공으로 확대하지 않는다.

## 직접 승인 후 준비·검수와 자원 계약

- 신규 scripts/transition-ui11-development.ps1, ui11-runtime-flow.ps1, ui11-runtime-probe.mjs와 직접 시험5파일만 추가한다. 기존 launcher·실패 helper·제품 동작·DB SQL·보호 파일은 수정하지 않는다.
- 로컬 순수 흐름14건 PASS, Node entry3+probe4건 PASS(5205.3672ms), PowerShell5문법/Node문법/typecheck/diff exit0. 최초 독립 C0/I3의 receipt 실패가 복구를 막는 문제·rollback 신원/포트 검증 누락·GUID 검증 지연을 RED→GREEN 보정하고 scoped 재검토 C0/I0이다. 실제 서비스/ACL/TLS/DB/브라우저 성공은 이 검수로 주장하지 않는다.
- 새 공개 텍스트 atomic fixture와 새 Hidden Node 환경 canary fixture는 각 정상 시험 후 등록 파일/빈 폴더를 정확 제거·별도 부재 확인했다. 실제 served/계정/DB/Secret 변경0이며 불변 시험을 반복하지 않는다.
- 새 후보 D:\tmp\anvil-v3-stage-b\candidate-ui11-n4-02는 현재 부재에서 final exact SHA의 index.html·assets/index-Csxr80L5.js·assets/index-C3a7Hrx0.css만 생성한다. Main/현재 사용자 소유·부모 nonlink/부재/정확3hash를 대조한다. 수명 이번 전환 종료/최대2시간, 새 파일3/빈 폴더2만 소유·링크·실경로·목록/사용 process0을 대조해 제거하고 독립 부재를 확인한다.
- 새 D:\tmp\anvil-v3-stage-b\browser\ui11-n4-served-01/profile은 익명 Edge 1회용이다. Main/현재 사용자 소유, 생성 전 부모 nonlink/부재 확인, 로그인·변경 요청·인증 cookie/Agent0. context 종료 후 해당 profile 참조 process0·정확 경로/owner/link/목록을 재대조하여 이번 profile/root만 정리·독립 부재를 확인한다. browser 종료/소유 불명은 삭제하지 않고 보존·보고한다.
- 새 runtime-ui11-n4-01은 receipt.json/receipt.staged.json·server.out.log/server.err.log, 실패시 rollback.out.log/rollback.err.log만 쓴다. rollback도 같은 receipt의 별도 process proof/상태를 보존한다. 현재 사용자/SYSTEM ACL은 이 새 폴더에만 설정하며 성공한 개발 process/로그·원본 backup은 후속 복구용 보존이다. receipt 쓰기 실패는 최종 receiptFailure에 드러내고 소유권 gate를 건너뛰지 않는다.
- 같은 정적 dir의 index.ui11-n4-original.html·index.ui11-n4-staged.html·실패시 index.ui11-n4-failed.html만 이번 소유 파일로 관리한다. 원 asset은 보존, 새 JS만 추가하며 동명 CSS는 같은 hash만 재사용한다. 성공 backup/필요 실패 증거는 보존하고 임의 전체 dist 정리0이다.
- 기존 보호10 hash·6환경/NO_ARTIFACT_ROOT·relay/PG·DB46/81표 READ ONLY 전후 fingerprint를 유지한다. 브라우저는 index/asset/API 오류와 pageerror·off-origin·nonGET을 실패로 판정하고 favicon 등 기타 비API HTTP 오류는 별도 수치로 공개한다. 익명 기본 페이지 확인은 실제 로그인/자료 저장/새 grant 업무·Agent 확인이 아니다.
- 최종 실행은 exact SHA/3script hash/asset/UUIDv4/issuedAt/expiresAt(최대2시간)·한 번만, 원 종료 직전 최소300초 여유를 요구한다. 실패/미실행은 그대로 기록하며 자동 재시도·창 연장·다른 포트·SERVED02 재포장0이다. 새 위험이나 플랫폼 거절은 PMO에 정확 요청하고 영향 없는 계획 작업은 Main이 계속한다.

## Main 선정·현재 사실

정식 schema46은 dbbdf049에서 반영·독립 후검사를 마쳤다. 현재 PID23836/loopback3830은 이전 API/정적 index이며 새 API·화면은 사용 가능으로 판정하지 않는다. 다음 업무는 Main이 이 연결로 선정했다.

exact1756c942abdc0537026cc48bf5ea26fbda2c93c8의 신규 후보 build(122 modules/410ms/exit0)는 다음3파일이다. 기존 served4파일 hash는 전후 동일하다.

| 후보 상대파일 | SHA256 |
|---|---|
| index.html | 1AFC88C707C3678A2BD6CE849E6D4C25CE66B47B188FB05EF12DF1A269BE9216 |
| assets/index-Csxr80L5.js | 923D30230B13D436BAD57153A9E2308148686AC57F49BEBE94E1CD7C71F0B3A9 |
| assets/index-C3a7Hrx0.css | 034435504A3650CD6024E9AF5C9BE6797EFBB4CAA2C3587CC287F778DB5E9A56 |

JS/CSS는 앞선 UI11 합성 검수 asset과 같아 이를 다시 시험하지 않는다. 500k chunk 경고1은 최적화 이월이며 기준 완화/코드분할0다. 후보 경로는 D:\tmp\anvil-v3-stage-b\candidate-ui11-n4-01·Main 소유/현재 nonlink·3파일/2폴더, 수명 최대2시간/미승인 중단시 목록·owner/link/process0 대조 exact정리다. build는 서비스 배포 승인이 아니다.

후속 정리: 위 현재 표기는 build 직후 상태다. 범위 결정 전 안전 정리로 exact3파일/빈2폴더만 제거했고 별도 root 부재·기존 served index hash/listener 불변을 확인했다. 후보 원본은 Git에서 재생성 가능하며 향후 실행 준비에서 새 등록·정확 hash 대조가 필요하다. 이 임시 root를 현재 존재하는 실행 자원으로 취급하지 않는다.

## 권장A — 새 한정 서비스 전환 계약

다음은 **범위 결정 제안**이다. 실행 준비 코드를 작성·TDD·지정 검토한 뒤 최종 exact40SHA/실행 script hash/고정 절대창/단1회 바인딩을 따로 고정하기 전에는 실행하지 않는다.

- 대상은 기존 Windows Anvil 개발 Node23836(exe C:\Program Files\nodejs\node.exe·시작UTC2026-10-17T10:02:29.4487470Z)과 그 same-origin Web, 단일127.0.0.1:3830뿐이다. relay26052/PG/DB46·기존계정·정책·키·인증서·기존보호10hash는 변경0이다.
- 새 보호 폴더 D:\Project\Anvil\.av3-data\runtime-ui11-n4-01에 이번 receipt/server.out.log/server.err.log, 실패시 rollback.receipt.json/rollback.out.log/rollback.err.log만 생성한다. 새 폴더에만 현재 사용자/SYSTEM 보호 ACL을 설정하고 기존 폴더 ACL·계정/키를 변경하지 않는다. 성공 runtime은 개발용 보존·프로젝트 종료시 정확 소유 PID만 종료한다.
- 기존 실행 entry의 검증된 Git root/branch/private exact clean·현재 PID/exe/start/listener·정적 index/asset4hash·Node exe hash·보호10hash/CA유효·DB46/PGmetadata·기한을 먼저 확인한다. 다른 사용자 변경/소유 불명/원본 불일치는 종료 전 거절한다. 신규 준비 root/backup/staged/asset 이름은 기존 부재 또는 정확 동일 hash만 허용한다.
- 현재 same-origin을 유지해 새 API/화면을 함께 반영한다. 구 index 원본을 같은 volume의 index.ui11-n4-original.html로 보존하고 새 index.ui11-n4-staged.html을 같은 정적 dir에서 검증한 뒤 atomic 교체한다. 원 asset은 삭제하지 않고 새 JS만 추가·같은 CSS는 동일 hash 재사용한다. 새 backup/staged도 이번 소유/정확목록으로만 관리한다. D: 후보에서 C: 정적 root로 곧바로 cross-volume File.Replace하지 않는다.
- 기존 Node 하나를 정확 종료한 뒤 신규 Hidden Node를 기존6개 참조/host127.0.0.1/port3830으로 실행한다. auth/db/TLS 설정·인증 우회·새 tunnel·새 포트·Agent/자동작업0. 원 ANVIL_ARTIFACT_ROOT 미설정은 그대로 유지한다. 원문 저장 연결/UNC 쓰기는 이번 범위가 아니며 UI06 원문 기능 미완료로 공개한다.
- 정상 확인은 엄격 TLS health·served index/JS/CSS exact hash·새 보호 API의 무자격 거절·페이지 기본 로딩 오류만 한정한다. 합성/실제 사용자·session/project/policy/host/grant/token 생성0, DB 쓰기/원문 업로드/모바일/Agent·Oracle/main0. 실제 로그인·사용자 DB 업무를 확인한 것으로 승격하지 않는다.
- 실패하면 신규 exact PID/exe/start/receipt/listener를 재검증해 이번 Node만 종료하고 구 index/기존asset·원6환경으로 복구한다. 기존 Git branch/private checkpoint는 보존한다. 필요시 clean 검증 뒤 마지막 검증된9bade63e3d3959a16f015ff89bc0c6a0baddaa1b로 일반 detached checkout하여 알려진 API 기준선을 실행하는 복구를 허용할지 별도 결정한다. force/reset/clean/미커밋 덮기0, DB schema46은 그대로 둔다.
- 위 rollback 기준선은 원 fn08 receipt의 검증 commit이다. 이후013bdc와 server/nonvendor contracts/package 소비 파일 diff0, main/config/package는 이후1756까지도 동일임을 읽기로 확인했다. 현재 프로세스의 메모리 전체 byte 동일성은 증명하지 않았으며 **원 PID 부활·완전 동일 메모리 복원**을 보장하지 않는다. 새 PID/strict TLS/구bundle 검증 결과를 정확히 보고한다.
- 실패·rollback 불명은 증거/소유권을 보존·보고하고 자동 재시도/다른 포트/새 서비스로 우회하지 않는다. 플랫폼이 직접 사람 승인을 요구하거나 거절하면 이번 계약·PMO 위임을 반복 사용해 우회하지 않는다.

## 결정·대안

- **권장A:** 위 새 범위와 알려진 Git 기준선 rollback 방식을 수용하고 Main이 한정 실행 준비를 작성·검토한다. 장점은 이미 구현한 API/화면을 실제 개발 서비스로 연결하는 것이며 위험은 짧은 개발 서비스 중단과 복구 시 PID/메모리 동일성을 보장하지 않는 점이다. 최종 exact 실행 바인딩은 준비 검수 후 요청한다.
- 대안B: 서비스 전환을 보류해 현재 API/화면을 유지한다. 중단 위험은 없지만 새 기능 사용 불가와 실제 화면 검증 미충족은 남는다.
- 이전 SERVED02의 UNC 원문·합성 사용자/정책·실제 UI06 DB 여정을 재실행하는 요청이 아니다. 그 플랫폼 거절/원 실패는 유지하며 이름만 바꾼 retry로 사용하지 않는다.
- Main은 업무 선정·완료를 주도하고 PMO에는 이 서비스 변경 위험·rollback 범위의 필요한 결정만 요청한다.
