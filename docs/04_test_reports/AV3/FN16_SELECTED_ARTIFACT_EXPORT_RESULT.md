# FN16 선택 문서 원본 반출 — 구현·집중 검수

## 판정

2026-10-27 / Main 어울. **부분 구현**이다. 선택한 문서 고정 버전의 본문 또는 첨부 1개를 별도 보관하고 목록·고정 조회·복사본 다운로드로 연결하는 서버·화면 소스를 구현했다. DB migration은 `0043_project_artifact_exports.sql.pending`이며 일반 runner에 등록하거나 정식 DB에 적용하지 않았다. 실제 서비스에서 사용할 수 있다고 보고하지 않는다.

기준 branch는 `codex/av3-stage-b`, 부모 checkpoint는 `cfcf40af6b91a9d0131294ddd627259824fba46e`다. WI는 `docs/work_packages/FN16_SELECTED_ARTIFACT_EXPORT_IMPLEMENTATION.md`, SHA256 `94AC6CE1ABADAB9AAF42A4832FD95BB0C10E090BC007FE26681E16534CD2BF98`다. 단일 subagent가 허용 19경로를 구현했고 Main은 제품 수정 없이 검수·통합했다. 정확 소스 지문은 대응 SOURCE_MANIFEST에 기록한다.

## 구현 범위

- 기존 `exportProject` 표준 명령·현재 로그인/OWNER/controller/세대/정책/CSRF/replay/receipt/audit를 소비한다. 정책 편집의 새 선택은 기본 미선택이며 실제 정책을 부여하지 않았다.
- 문서 버전 canonical hash와 정확 BODY/첨부 ArtifactRef 귀속, 원문 및 사본의 bytes/hash·알려진 민감 표식을 검사한다. 현재 원문 격리는 사본 다운로드도 차단한다.
- 별도 target 전체 10GiB에 metadata·orphan을 합산하고 배타 reservation을 사용한다. 원본 저장소의 기존 10GiB·파일 20MiB 기준은 바꾸지 않았다. 미확인 사본/lock은 추정 삭제하지 않는다.
- 명시 선택→준비(POST 0)→별도 전송→원명령/영수증 보존→후속 조회→same-origin 사본 링크를 연결한다. 조회가 실패해도 확정 영수증을 미확인으로 되돌리지 않는다.
- DB snapshot·프로젝트 소스·다른 자료·실행 상태 복원은 포함하지 않는다. 전체 프로젝트 백업·복원 및 FN16/UI14/Stage 완료가 아니다.

## 실제 검증과 원 실패

| 검증 | 실제 결과·한계 |
|---|---|
| 원 RED | 수행자: 실제 자료 정책에 exportProject가 없는 상태에서 실패. 이후 source 구현 |
| Main 첫 집중 검사 | `node --test tests/unit/FN16/project-backups.test.ts` / exec 9ef532 / 11 PASS, 0 FAIL·SKIP, 9306.0158ms. 실제 합성 파일·Node API와 DB 대역 |
| 독립 첫 검수 | 서버 C0/I2/M0, UI C0/I2/M0. WSL 신규 디렉터리 모드, SQL NULL 귀속, UI 문맥 교체, 후속 job 원선택 대조 공백 |
| 보정 | 같은 writer가 새 소유 경로 보호, SQL NULL-safe exact 검사, 전체 UI 문맥 무효화, 원선택·작성자 대조를 보완. 기존 builder/원본·실제 root 권한 변경 0 |
| Main 최종 집중 검사 | 같은 명령 / exec c55052 / **13 PASS**, 0 FAIL·SKIP, 9555.5442ms. 원본 물리 파일 소실 후 사본 bytes·격리/교차project·replay·COMMIT 응답 불명 대역·미설정·보정 주입 반례 포함 |
| 직접 영향 회귀 | `node --test tests/unit/FN17/project-notifications.test.ts tests/unit/UI11/material-policy.test.ts` / exec 86a6dd / **21 PASS**, 0 FAIL·SKIP, 562.219ms. 수행자의 다른 조합 25개와 합산하지 않음 |
| Main type/diff | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json`, `git diff --check` / e99a6f / exit 0 |
| 첫 browser 준비 오류 | Main이 QA 환경변수 구분자를 잘못 전달해 UI 진입 전 6 FAIL. literal 경로만 교정했고 원 실패를 소급 PASS하지 않음 |
| 첫 실제 browser | wrapping label의 정확 locator timeout 2건 후 CTRL_C로 반복 중단. 나머지는 미완료. select에 명시 label을 보완했고 timeout·기대값은 유지 |
| 최종 실제 App/Edge | exec 139c78→1988c1 / **11 PASS**, 0 FAIL·SKIP, 11722.777ms. 기존 6 + 재인증 문맥 3 + 다른 선택/작성자 2. 합성 HTTP 응답이며 정식 서버/DB 증거 아님 |
| 독립 scoped 재검수 | 서버·SQL I1/I2 및 UI I1/I2 해소, 각각 **C0/I0/M0**. 읽기 검수이며 실제 POSIX·PG 통과 판정 아님 |

최종 App build는 Vite `write:false` 444모듈/406ms였다. JS `index-Bnbv--zq.js` SHA256 `CBB5A74A54D500AEB460F8F081C0DEBE276DBEEAD121A70512F3BA4A9D0FFF03`, CSS `index-BHDH6qmX.css` SHA256 `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`이다. 기존 NO_COLOR 경고는 보존했다.

## 자원·미검증·다음 조치

Windows QA owner는 `SINSAN\cyhuh`, 생성별 최대 30분이었다. unit root `D:/tmp/anvil-v3-stage-b/fn16-project-artifact-export-20261027-01`은 최종 21:21:57.081Z 생성→21:22:05.194Z 정리했다. browser root `D:/tmp/anvil-v3-stage-b/ui14-project-artifact-export-20261027-01`은 원 실패 인스턴스 289항목을 21:20:06.120Z 정리하고, 새 최종 인스턴스 23항목을 21:23:09.098Z 정리했다. owner/nonlink·정확 하위 목록·관련 프로세스 0을 확인한 대상만 제거했다. 별도 exec 235659에서 두 root 부재·관련 Node/Edge 0을 확인했다. 기존 사용자 브라우저·서비스·DB·Secret 변경 0이다.

**NOT_RUN:** 실제 PostgreSQL syntax/RLS/FK/trigger·실 COMMIT 장애, POSIX 실행, 실제 두 반출 동시 경합, target metadata/orphan 전체 합산의 독립 측정, native browser 다운로드, 정식 서비스·사용자 인수. 알려진 민감 표식 탐지는 완전한 비밀 탐지가 아니다. full reload 뒤 메모리 원명령 복구는 지원하지 않는다고 화면에 표시한다.

다음은 게시 exact SHA의 새 격리 WSL PG에서 고정 51 baseline과 후보 0043·표준 합성 업로드/문서 생성·반출/조회/사본 bytes를 확인한다. 생성 전 이름·소유·이미지·수명·정리를 별도로 등록한다. 과거 FN03의 소진된 1회 승인을 재사용하지 않으며 정식 DB/TLS/서비스 실행 경계와 분리한다. 실제 적용을 하지 않았으므로 rollback은 해당 기능의 source commit 되돌리기이며 기존 DB/자료 복구는 필요하지 않다. branch 전체나 보호 자료를 reset하지 않는다.
