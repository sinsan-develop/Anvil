# IX01 수정 SQL 단발 진단 r2 소스 준비 결과
2026-11-04 · Main 어울 / 기존 Primary 구현

판정: SOURCE_PREPARED / SYNTHETIC_VERIFIED / ACTUAL_R2_NOT_RUN.

## 변경과 경계
WI436AEDDD1C980AFE995A3C70BC5FD61C81452AEA4D1D815797691CE1ACF2C93F에 따라 기존 Primary가 driver·unit·신규 index 정확3경로를 작성하고 동결했다. 기준은7e9ab984d2dad98fed208a2473853409dde927b9다. Main은 코드를 쓰지 않았으며 SQL·기존 r1 index·원장/승인 원문·보호3은 보존했다.

| 파일 | bytes | SHA256 |
|---|---:|---|
| scripts/qa-ix01-schema-closure.sh |31595|2B555A8EBA685B9C8E9D0C4B709B394C2BC9988D0F24B69F6CC0E4A4A4DF0C12|
| tests/unit/IX01/schema-closure-controller.test.ts |30377|38E7554CA70AAD8E1D1AC89154362218F9D7D81ED465ABB63C4DE5CADC2EBE4D|
| docs/04_test_reports/AV3/IX01/DDL_SOURCE_ALLOWLIST_20261104_R2.tsv |15981|11B2FA7EDD34149D609B8C837888324E77EF856E459B8F93EA5AE19BE4E3D005|

수정 SQL 기준·신규20261104-r2 자원명·새 index를 고정했다. 추가 진단은 단일 psql ERROR 접두의 안전 정수 statementEndLine뿐이다. 이 값은 문장 끝 위치이며 정확한 내부 원인 행을 증명하지 않는다. 오류문장·SQL·DETAIL/CONTEXT·Secret은 계속 버린다. 기존 SQLSTATE/UNKNOWN·role 회수·정리/다음slot 판정과 기한·권한·로그·소유·격리 기준은 유지했다. 새 제품 공개 API나 권한 계약은 없다.

## 검증
- Primary314922 최초 RED2를 보존한다. mutation 완료 전에 실행한703dae는 보완 전 RED이며,61762→4d2b76 exit0 뒤 검수와 구분한다.
- 출력 소실된 별도 병렬검사 결과/종료 상태는 UNKNOWN이다. 후속 PASS로 소급하지 않는다. fff3f2 39PASS 뒤 TS2783 시험 조립 진단1을 동일 입력의Object.assign으로 보정했고,1783ea 영향1PASS·43477→e3e3ed noEmit0·d690bf Bash-n0·494ae9 diff0을 반환했다. 현재 수거 가능한 Primary handle0이며 소실 호출 종료는 미확정이다.
- Main b06952/9a2045는 실제 diff와 frozen 지문을 읽었다. r1 baseline/cwd 재사용은 claim/create 전 거절되며, 위치 필드의 누락/모호/상한·유실에서 raw 노출0과 기존 분류를 유지한다.
- **Main9e5a8b:** node --test tests/unit/IX01/schema-closure-controller.test.ts, exit0/39PASS/0FAIL/skip0/469.4384ms. 최종 동결 source 전체에 대한 새 독립 검사다. 실제 Docker/PG 검증이 아니다.
- **Main0072d4→소유31431/cf1fac:** root tsc --noEmit -p tsconfig.base.json 및 Git Bash --noprofile --norc -n scripts/qa-ix01-schema-closure.sh, 최종 exit0.
- **Mainaedc83→소유42880/a997ce:** 고정Git raw blob106개 전부 지문/크기 일치. 기존 대비0035/0071/0072 세 파일만 각각2/2/4바이트 증가하고103개는 불변이다. 선택105/orderHash09d2e7d5cd8715a0ff02540d4397db2d4cb8dcf818d808ce328423d7583f24ef/2376115B를 독립 대조했다. 기존r1 index는DC8B5FC0 그대로이며 새 index만 정본 docs에 같은 raw로 보존했다.
- bootstrap(a1) SHA fbb2e5ea6cffd479b776bc0621404415dd7a61cad48beca37efdbf71cb415883, metadata SQL23237b193e7c863d1d2b0e1c30eb29d9c5d62fc4d93129b97e525aff499812e1, 빈 reader 회수8fc938cc834680f8b7691a1df8317eac1c2e1f74df68894aa671e668fde6f3f5를 함수의 원문에서 계산했다. 실제 실행하지 않았다.

## 미검증과 다음
새 WSL/source/원장·PG/container/role·권한/키/서비스/Agent/P03R3·실자료 조사·실행은0이다. 실제 수정 후 정의 설치·JSON연산·RLS/native·문서 여정/사용자 인수·IX01/전체 계획은 미검증/미완료다. 첫 r4/slot1의 FAILED와 정리0·감사 보존·허가 소진 상태를 유지한다.

설명은 Unix socket trust·TCP listen 비활성화 설정과networknone/port0 경계로 한정한다. initdb host reject 인자만으로 최종 HBA 전체를 reject라고 증명하지 않는다. 공식현재entrypoint는 host HBA 행을 추가하지만 고정cache이미지의실제HBA는 관측하지 않았다. [공식 entrypoint](https://raw.githubusercontent.com/docker-library/postgres/master/docker-entrypoint.sh). 이 문서 정정으로 코드/권한/격리 기준을 바꾸지 않았다.

현재 source 한정 검수의 미해결Critical/Important0이며 실제 보안 인수가 아니다. Main은 정확3+소유 문서만 private checkpoint하고 새 실제 단발 실행안에 code/index/SQL·자원/수명/정리/UNKNOWN 범위를 결박한다. 실제 실행은 새 직접 허가 전0이다. rollback은 source3만 정상Git revert하며 SQL·원장·이력/사용자 자료를 삭제하지 않는다.
