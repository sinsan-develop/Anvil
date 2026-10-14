# U-01 선택 Queue 격리 이상 연결 — 부분 결과

## 판정

격리 환경의 저장→인가 API→실제 화면 핵심 동작은 확인했다. **정식 WSL API/Web 반영은 명시적 서비스 전환 승인 경계에서 미실행**이다. 신산님이 사용하는 개발 화면의 새 기능 완료나 전체 U-01 완료로 보고하지 않는다.

- 전체: `U-01 NOT_ACCEPTED / Release DEFER`. 역사 R6/DC-U01-019 FAIL 유지.
- Queue 전체 정상 신호·Worker 생존/처리율과 다른 미연결 Health·운영 카드·필수 ID는 별도 미완료다.
- 0건은 `UNAVAILABLE / NO_QUEUE_HEALTH_SIGNAL`이며 HEALTHY가 아니다.

## 판단 이유와 범위

- 승인: `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`, SHA256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`.
- WI SHA256 `D325992DAF63D07ACA160A32727E6DF4F1935C70DC0468E9B5B87D100AD54EF0`, Invocation `139281AEA7397AF3395CCAB5DBD9F7D594B6096D6729BFBBECDB03690E656E33`.
- 시작 branch `codex/u01-dashboard-r2`, A23 `f864e0745b44a3cf3669b2cf6a4ec621e11431e8`, tracked clean 후 단일 Primary가 허용9만 수정했다. Main은 해당 제품 경로에 쓰지 않았다.
- C22 `511806ee4f8d7dcd8d08082b0d4651d7ede6d21c`는 A23 직접 자식 정확9, M22 `f3ccab1a8cb5f0422279acb2034a0d80d68ed193`는 C22 직접 자식 manifest+현황2다.
- B22 `2162a30665a08c935ffd52c37e58e5c78f913f2f` 정확5 뒤 H22 `46e3613b22754279b8d962c5289287a0f52fc095` 정확5에서 seq2448 write→2449 worker 회수, active agent/dual lease null. 각각 게시본 실제 G-05 seq2447/2449 PASS.
- 독립 코드 최초 C0/I0/M2(DEL/C1 ID와 상태 강제변환)는 좁은 RED→GREEN 후 C0/I0/M0. M22/B22/H22도 최종 C0/I0/M0이다.

변경 파일과 raw hash는 `deploy/wsl/U01ScopedQueueQuarantineReleaseManifest.json`의 source_files 정확9와 일치한다. 제품3은 `packages/api/scoped_dashboard.py`, `apps/api/anvil_api/oidc_process.py`, `apps/web/src/console/App.tsx`; 시험4와 checker/통제시험2가 나머지다. `git diff --check` exit0, checker 기존 prefix/suffix bytes 보존·새 route만 추가했다.

## 실행한 최소 검증

Python은 `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --import-mode=importlib`을 사용했다.

- Primary: reader 신규20 RED→20P; 직접 영향 reader/API/Queue read/host 합78P(경미 보강 전), Web 인접19P·typecheck/lint/build20 exit0.
- 경미 보강: reader DEL/C1 3F→최종 `tests/api/test_u01_scoped_dashboard_reader.py -k queue_quarantine` 23P; Web 신규2F→최종 `node --import tsx --test --test-name-pattern="^scoped quarantine" apps/web/tests/f15-console.test.mjs` 5P. 최신 typecheck/lint exit0.
- Main 최신: 같은 reader23P/2.19초, Web5P/512.65ms, 단일 `test_scoped_queue_quarantine_get_preserves_authorization_and_safe_shape` elevated 1P/3.96초.
- Main 신규 `U01ScopedQueueQuarantineEpoch132Tests` 7P/95.18초. Primary epoch131 인접6P/1F는 당시 A22 시험이 현재 A23 문서를 읽은 fixture 혼입이며, 해당 시험에 frozen A22 Git bytes를 공급해 기대/위조 음성을 그대로 유지한 뒤 1P를 확인했다.
- 기존 `python_multipart` PendingDeprecation warning1을 보존했다. 전체 불변 suite/모든 브라우저·기기는 반복하지 않았다.

### 실제 WSL-server 격리 실측

새 빈 PG15/비관리자 DB·role·0021, Git exact C22·branch/upstream·WSL G-05 seq2447 PASS, Node24 Web20 준비 뒤 합성 OIDC/HTTPS/Chromium151로 실행했다. 합성 Run 권위 fixture는 이 격리 DB만의 준비물이며 정식 사람 승인·Run 실행 증거가 아니다.

1. 완전한 빈 Queue: API 격리0/UNAVAILABLE 및 화면의 전체 건강 미확인 설명 확인.
2. 정상 `PostgresDagQueue.register→claim→fail(max_attempts=1)`로 실제 격리1 저장. 독립 DB 조회로 job/status/attempts와 quarantine 대응1 확인.
3. 인가 API의 LATE·count1·ID/attempts/원본/시각→실제 화면 상세 ID, 7d 전환에도 현재 관측 유지 확인.
4. client clock 301000ms 뒤 숫자/ID 소거 확인. 서버 실제5분 경과나 부하 시험으로 확대하지 않는다.
5. pair grant 철회 뒤 API403·선택 목록 없음·이전 정보 제거 확인.

선택 auth/기능 응답·DOM은 phase별 7/9/5건 host 메모리에서 서버 비밀과 재귀 대조해 CLEAR였다. 보호 비밀을 브라우저로 전달하지 않았고 원시 본문은 출력/증거 파일에 저장하지 않았다. 페이지 HTTP/S 요청은 같은 QA origin만 확인했다. 전체 background body 감사·R6 전체 PASS는 아니다.

PNG3 원격0600/owner/nonlink와 로컬 exclusive 회수본 hash 일치 후 실제 열어 empty/LATE/철회 화면을 확인했다. warning PNG는 기간 변경 뒤 상세가 접힌 상태이며 ID 상세 확인은 DOM 단언 증거다.

| PNG | SHA256 |
|---|---|
| empty | `0e72ded4e11734b23e7682844c5c0be809cafd28480fd080bd820cd9a9abf273` |
| warning | `9619152fc9c5df14c46d64415bef344e25d6f4b27e2acdddcc5c2e173c40ba25` |
| revoked | `5fb198783ba4366f768527cd1398819301cbfade34df691952a564e0ea645f65` |

### 빌드와 실제 정식 상태

Git archive SHA256 `2DB70531D06A6866BDAAEEB883A93FEFF9FA0A579CDCD383D42FB68DAA40BC0B`의 실제 Docker build exit0:

- API `sha256:6c5edefa5fc3d4038e51aa7140b4b53a9294414875af73f9d9bcd5e3aa54ac17`.
- Web `sha256:949aaeabd0daf44caa9341b1b2c8ddfb8409e4c2b3a8e1da0aeb3784bd0627fc`.
- 두 image revision C22, 신규 SHA tag, 빌드 중간 container 잔여0. Dockerfile의 고정 Node22 build와 준비용 Node24는 구분한다.

정식 Git `/srv/anvil-wsl/repo`만 M22 detached/clean으로 갱신했다. 전환 코드를 포함한 operator의 기본 preflight 실행 요청도 auto-review가 명시 서비스 전환 승인 부재로 거부하여 **서버 실행0**이다. 우회/재시도0. 이후 순수 읽기로 기존 API `a773c348…`/Web `ccaf91d5…`/issuer `e2667673…`의 full ID·image·running 불변과 신규 전환 proof4/전환 scope container0을 확인했다. 실행 source는 여전히 API/Web C20, issuer C15다. DB0021·권한·Secret·certificate·망 변경0.

## 최초 오류·미검증·조치

- 초기 npm 설치는 RO HOME cache 때문에 준비 단계 exit1, 제품/0021 migration 전이었다. 같은 browser의 기존 tmpfs에만 cache를 지정하고 완료한 clone/G05/build는 반복하지 않았다.
- warning 최초/진단 실행은 EXPIRED TimeoutError exit1. QA clock을 기존 timer 등록 뒤 설치한 차이를 기존 절차와 대조하고, page load 전 설치로만 바꾼 동일 코드의 warning/revoke 재현이 exit0이었다. 원 실패를 소급 PASS하지 않으며 제품 timer 변경0이다.
- Main sandbox TestClient 대기2회는 종료/미완료로 보존하고 동일 지정 Python의 elevated 단일 시험1P와 분리했다. tsx 옵션 누락·CIM 접근 불가·없는 보조 파일/잘못된 rg wildcard·Path 인자/patch prefix·게시 경로 오타·첫 잔여 조회의 PowerShell 치환 오류는 환경/호출 오류로 기록했다. ACL/합격 기준 변경0, 정식 Developer FAILURE_REPORT0.
- 등록된 원격 QA root1/container3/ports5545·8444·8445를 신원 확인 후 정리, 별도 Python 조회 exit0로 잔여0. local Dtmp/dist0, PNG 전용 회수본도 보고 hash 보존 뒤 정확3 hash·root/link를 확인해 해당 파일3과 빈 root만 삭제·부재를 확인했다. 재생성 가능한 QA 이미지 복사본만 제거했으며 Git·image artifact와 기존 복구 자료는 보존한다.
- 정식 C22 서비스 전환·정식 빈 Queue 브라우저 확인은 `NOT_EXECUTED_BLOCKED`. 기존 승인 요청은 원래 만료를 따르며 다시 만들지 않았다. Oracle/ysna/Production/PR/main 병합·전체 U-01 인수·예약 변경0.
- 필요한 다음 결정은 WSL API/Web 두 역할만 검증 C22 이미지로 전환하고 C20 두 container를 복구용으로 보존할지다. DB/자료/권한/Secret/issuer/망 정의 변경은 제외한다. 승인 전 실행하지 않는다.

rollback은 미실행 전환을 되돌리는 작업이 아니다. 현재 C20 서비스를 그대로 유지하며 C22는 정확9의 역변경+직접 영향 검증으로만 철회할 수 있다. 등록·요청·감사 자료를 삭제하거나 DB를 복원하지 않는다. progress/HANDOFF는 H22 회수/전체 U01 미수락으로 갱신했다.
