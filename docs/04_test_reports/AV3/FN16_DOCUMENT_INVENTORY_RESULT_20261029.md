# FN16 문서 metadata inventory 소스 검수

## 판정

문서 전체 버전·이력의 내부 조회 수집기와 입력 검사를 구현하고 집중 합성 검증했다. 공개 route·백업 job에는 연결하지 않았다. FN16 전체와 실제 백업·복원은 미완료다.

## 기준과 변경

- 문서 checkpoint: `b954806d1d09d6c25572ada730e9d31819f93fe8`, `codex/av3-stage-b`.
- 후보: `docs/contracts/FN16_DOCUMENT_INVENTORY_SOURCE_CANDIDATE_20261029.md`, SHA256 `25E4F29C7D925BABD6919DFC5C446696B3D7A0920B758C3E4C1AD759730DD17E`.
- WI: `docs/work_packages/FN16_DOCUMENT_INVENTORY_SOURCE_IMPLEMENTATION_20261029.md`, SHA256 `23FA5E0AAF87D85692005B5B346DAF9294D37417419AB45DC047DEA4C3F4F764`.
- PMO 결정: `docs/approvals/FN16_DOCUMENT_INVENTORY_INTERNAL_SCOPE_DECISION_20261029.json`, SHA256 `EC9A3C4D7865099F471ACCE398EB191C63B5D0D9D708F6DD243F87652F58C5F8`.
- 변경 전 내부 수집기 없음 → 변경 후 정확 프로젝트의 문서·버전·연결·가져오기·수정 제안·검토·확정·소스 이력과 필요한 양식·방법론 참조를 수집한다. 기존 제품 파일·공개 API·migration 변경은 없다.

| 신규 파일 | SHA256 |
|---|---|
| apps/server/modules/backups/document-inventory-input.ts | BDEE5D8147B46DF703BDC3C2D86C1F4F28162E427B5CD8C18644F978EB453B50 |
| apps/server/modules/backups/document-inventory.ts | F5C39009216E97691215B8F4E0BAA3F4803E1889F878298B223EAA1C0AEF1C11 |
| tests/unit/FN16/document-inventory-input.test.ts | DAE6217EEEB77744062C907E86A97B5C2944948407210CE191CFCE7F931B62BB |
| tests/unit/FN16/document-inventory.test.ts | 4FDAFCA5F837F2E12FD9D87789408C8DFD29ACF8FC866A113C1B738B209EB463 |
| tests/unit/FN16/document-inventory-schema.test.ts | 6676BA0941F35307AAA1188E0021DB6F46AAD5B724B1DC1C7079D2382FAC6752 |

## 실제 검증

- Main `node --test tests/unit/FN16/document-inventory-input.test.ts`: 초기 7 FAIL(1475d1), Proxy 반례 1 FAIL(7d3980) 후 최종 9 PASS / skip 0 / 174.0275ms / exit 0(e14b8f).
- Main `node --test tests/unit/FN16/document-inventory.test.ts tests/unit/FN16/document-inventory-schema.test.ts`: 초기 schema 1 PASS·미구현 12 FAIL(f5b159), 중간 16 PASS(8a3ccf), 최종 20 PASS / skip 0 / 807.1983ms / exit 0(f0a49d).
- 위 입력 9건과 수집기/schema 20건은 별도 실행이다. 29건을 한 번 실행했다고 표시하지 않는다.
- Main `npm run typecheck`와 `git diff --check`: exit 0(c9d853). 기존 불변 화면·native·키 처리·광범위 회귀는 재실행하지 않았다.
- 독립 검수: 입력 Proxy 재읽기 I1, fixture 정합 I2, collector 형식/출처/BEGIN 회수 I3를 보완했다. 최종 scoped C0/I0/M0. Main의 같은 관측을 중복 finding으로 세지 않았다.
- primary의 신규 반례 67a4b3(3 FAIL), 7df0e7(4 FAIL)과 그 후 GREEN을 보존했다. 처음 합성 행의 미선택 열·중복 command·변경 없는 제안·잘못된 diff 형식은 실제 writer와 SELECT에 맞췄으며 제품 기준을 완화하지 않았다.

## 의미와 보호 경계

시작/종료 READ COMMITTED 인증과 단일 READ ONLY REPEATABLE READ 자료 관측을 분리한다. 프로젝트·현재 소유자·세션 세대·정확 공통 참조, 자료별 해시·관계, keyset 페이지와 유한 용량을 대조한다. 자료 조회마다 남은 statement timeout을 갱신하고 BEGIN/rollback 불명 client를 정상 풀에 반환하지 않는다. 전체 연결/인증 잠금 시간을 같은 deadline 안에 강제 종료한다고 보장하지 않는다.

파일 연결 관계는 모두 보존하고 파일 수·바이트만 중복 제거한다. 원 해시와 경로를 제거한 투영 해시를 구분하며 원문 바이트·보관 경로·키·세션 token을 반환하지 않는다. 격리·불명·외부 의존은 부분 상태로 남긴다. 고정 결과는 `DOCUMENT_HISTORY_ONLY`, `blobVerification=NOT_PERFORMED`, `fullProjectCoverage=false`, `restorable=false`다.

## 미실행·남은 기능·복구

실제 PostgreSQL SQL/RLS/RR 경합·권한 회수·원문 파일·키·서비스·Agent·P03 실행은 NOT_RUN이다. 새 QA 경로·컨테이너·listener를 생성하지 않았다. 전체 자료 수집, 정책/job, 암호화 bundle, 사용자 화면 연결, 복원·사용자 인수는 미완료다. 선택 파일 프로필을 전체 백업 적합으로 승격하지 않는다.

복구는 신규 다섯 파일의 검토된 revert이며 기존 데이터·서비스·보호 미추적 자료를 수정하거나 삭제하지 않는다. WORK_STATUS와 계획에 부분 구현 상태를 누적한다. 다음은 정확 원문 참조와 실제 바이트 검증의 내부 연결을 구체화하는 작업이다.
