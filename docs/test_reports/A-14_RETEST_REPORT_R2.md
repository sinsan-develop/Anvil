# A-14 Independent Retest Report R2

- package / revision: `A-14 / R2`
- tested HEAD: `39a7bcce246db2f33d9ac7d02c81e0d4a11892d8`
- progress: sequence `161`, `TEST_REVIEW`, worker/write lease `null`, independent Tester `R2_PENDING`
- Developer R2 evidence SHA-256: `67AD9BD4AC3203900B97074B233DA751DC4FD75F7C772F955CA00BB2665EE58D`
- Main R2 completion evidence SHA-256: `978F63CD470F92288214A4E1CC42E5BA04E94DDB504C6E206047257AE16CDFDC`
- completion target: `sha256:EDB80314FB96B215BBD59CB29E15CB0BEEEDCBBD28E37BBAA55367E3152A93A9`
- verdict: `BLOCKED / NOT_READY_FOR_MAIN_ACCEPTANCE`

## 판정 -> 판단 이유 -> 조치

### 판정

`BLK-A14-002`는 `CLOSED`다. 그러나 `BLK-A14-001`이 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`로 남아 있으므로 A-14 전체 판정은 `BLOCKED / NOT_READY_FOR_MAIN_ACCEPTANCE`다. A-15를 시작하면 안 된다.

### 판단 이유

1. clean checkout successor raw-byte 검증과 hostile tamper가 포함된 A-13+A-14 targeted Python 26/26가 PASS했다.
2. full tooling 268/268가 fresh PASS했고 이전 `EVIDENCE_CONTENT_BYTES_MISMATCH`, `EVIDENCE_RAW_BYTES_MISMATCH`, `EVIDENCE_RAW_HASH_MISMATCH`는 재현되지 않았다.
3. 지정 in-app browser fresh 연결은 다시 `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`로 kernel exit 1이었다. Browser skill 경계에 따라 다른 surface로 대체하지 않았다. 실제 1920×1080 클릭, screenshot, console/storage/source, 전체 Network URL/method/status 증거는 여전히 `NOT_EXECUTED`다.
4. 따라서 `AV-UI-004` L7와 `AV-UI-010` E-NET, `AV-GATE-005` E-SHOT 최종 판정에 필요한 실제 browser evidence가 없다.

### 조치

- in-app browser ACL 차단이 해소된 환경에서 등록/fixture 선택 → scan → canonical Provider 선택 → 상태/evidence를 1920×1080 실제 클릭으로 검증한다.
- 전체 Network URL/method/status를 캡처해 페이지 local origin과 브라우저 코드 API 요청을 구분하고, 상대 `/api/...` same-origin만 존재하며 direct internal API/localhost/container port 호출이 0건임을 판정한다.
- 위 증거 전에는 A-14 acceptance와 A-15 시작을 차단한다.

## 독립 재검증 증거

- Node runtime/unit: `node --test apps/web/tests/workbench.test.mjs tests/browser/a14/workbench-runtime.test.mjs` -> exit 0, 6/6 PASS.
- Targeted Python: `python -m unittest tests.tooling.test_a13_repository_scan tests.tooling.test_a14_workbench_prototype -v` -> exit 0, 26/26 PASS, clean checkout successor와 hostile integrity tamper 포함.
- Full tooling: `python -m unittest discover -s tests/tooling -p 'test_*.py' -v` -> exit 0, 268/268 PASS, 137.796초.
- A-14 checker: PASS, paths 17, self-reference false.
- A-13 checker: fixtures 8, zero delta 8, hostile 15.
- Project progress: PASS, sequence 161, reporting AUTO_CONTINUE.
- G-07: PASS, packages 97, AV 255, uncovered 0, scenarios 20.
- Phase G: PASS, accepted 7, decisions 10, packages 97, AV 255, scenarios 20, sync 7.
- G-06: fixtures 8, golden 8, scenarios 20, fault injections 8.
- Repository projection: actual Git porcelain paths 39, expected exact paths 39, mismatch 0.
- Fixture/A-13 no-write: `tests/fixtures/repositories`와 `packages/repository_intelligence`에 status/diff/cached diff 0건. 54개 fixture source inventory SHA-256은 R1 pre/post 및 R2 post와 동일하다.

## 상태 경계

- `BLK-A14-002`: `CLOSED`.
- `BLK-A14-001`: `ENVIRONMENT_BLOCKED / ACCEPTANCE_BLOCKER`.
- actual browser click/screenshot/console/storage/full Network: `NOT_EXECUTED`.
- production API/DB/SSE, real Provider/Secret/Egress, user repository, WSL/ysna deployment, DIR: `NOT_EXECUTED`.

Tester는 이 보고서 외 제품·progress·acceptance 파일을 수정하지 않았다. R2 재검증에서 별도 서버를 시작하지 않았으며, 종료 시 4173 Workbench server가 실행 중이지 않음을 확인한다.
