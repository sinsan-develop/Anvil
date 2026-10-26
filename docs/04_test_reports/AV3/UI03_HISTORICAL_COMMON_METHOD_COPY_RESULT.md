# FN02/UI03 과거 공통 방법론 복사·편집·저장 — 소스 검수

2026-10-27 / Main 어울. **소스 구현·합성 App 핵심 동작 확인, 실제 DB/served는 미확인**이다. 전체 FN02/UI03·Stage 또는 작업계획 완료가 아니다.

## 범위

기준 branch `codex/av3-stage-b`, 부모 checkpoint `c8765d5265416c53285b2b70cd92842ea2ff08c1`. WI SHA256은 `C437F9018E8F88A07BFAD1BBC420607D55C4F3AAC4F65F1E89495C98E369E8C0`다. 단일 구현 담당이 허용 제품3경로와 신규 App spec1개를 변경했고 Main은 제품 수정 없이 관리·검수·통합했다.

기존 과거 조회·비교는 유지하고, hash 검증된 과거 USER_COMMON 버전을 복사 전용 snapshot으로 명시 선택한다. 선택 자체는 POST0이고 기존 이름·별도 복사 명령으로 새 ID/v1을 만든다. 이후 기존 편집·저장·고정 재조회를 사용한다. 현재본 편집/검토 source와 프로젝트 gateway는 유지하며 서버의 기존 exact sourceRef 복사 계약을 재사용했다. 새 API/SQL/권한·정식 DB/서비스·Secret·Agent 변경은 없다.

## 증거

- 원 spec SHA256 `622E583C06712631A84522107E144927967F96D17BBE9CB82DF794426C907C0F`. 제품3경로가 변경되기 전 Main exec03ca26의 실제 App에서 과거 비교·graph 표시는 정상이고 ‘이 버전을 복사 원본으로 선택’ 버튼 부재로 **RED1/exit1**을 확인했다. 환경 오류나 다른 선행 실패가 아니다.
- 최종 source4 지문은 대응 `UI03_HISTORICAL_COMMON_METHOD_COPY_SOURCE_MANIFEST.json`에 보존한다. Main af852b에서 제출값과 일치, fresh `tsc --noEmit -p tsconfig.base.json`·`git diff --check` exit0을 확인했다.
- Main 실제 App/Edge exec8c0359→73206→06bad8: **9 PASS, FAIL/SKIP0, 16308.569ms**. 현재 v2와 다른 과거 v1 선택→POST0→복사→새 ID/v1의 과거 graph→편집·저장/v2 재조회를 확인했다. 현재본 저장 분리·dirty 확인 거절·입력/명시 해제·hash/403 실패·늦은 비교 ABA·응답 유실 원명령 재확인·동일 사용자 재인증 왕복 뒤 늦은 복사 결과를 포함한다.
- Vite `write:false` 444모듈/718ms. JS `index-BJWhbaV8.js` SHA256 `FA88549C570D5C4E9BC1B63C3AF372613C758DD21D9ECDD2C74D3CD3CE9DA22D`, CSS `index-BHDH6qmX.css` SHA256 `BC67262F3704E1FC62ECC0F21B976BDD60A84893B25206197DA7D60E2B015E87`. 기존 NO_COLOR 경고는 보존했다.
- 독립 읽기 검수: **Critical0 / Important0 / Minor1**, 지정4경로 소스 한정 합격. 수행자 보고와 Main 실행을 구별했고 실제 DB/served나 전체 Stage 판정은 하지 않았다. 검토자의 sandbox Git diff는 환경 오류로 실패했으며 실제 소스 직접 열람·지문으로 대조한 한계가 있다.

## 남은 검증과 Minor

Minor1은 유효 POST 응답 뒤 새 사본 GET만 실패하는 별도 회귀 사례가 없다는 점이다. 검토자는 기존 `applied=true` 이후 pending 보존을 소스상 확인했고 제품 결함은 발견하지 않았다. **미실행 사례로 남기며 PASS로 계산하지 않는다.** 향후 같은 저장 후 조회 경계를 수정할 때 보강한다. 기존 9개 통과를 이유로 이 사례를 검증했다고 보고하지 않는다.

실제 DB·정식 서비스·사용자 인수, 사용자/client 직접 교체 및 API/transport 직접 교체 DOM은 미확인이다. 합성 API 저장/재조회는 실제 지속 DB 증거가 아니다. FN16의 새 Docker bridge TCP 문제와 별도로 이 승인 소스 기능을 구현했으며, 그 인프라 문제는 해결됐다고 주장하지 않는다.

## 일회 자원과 복구

등록 root `D:/tmp/anvil-v3-stage-b/ui03-historical-method-copy-20261027-01`, owner `SINSAN\cyhuh`, 생성별 최대30분이었다. RED 인스턴스는22:09:13.645Z 생성→22:10:03.926Z 소유38항목을 정리하고 별도6f6cc2에서 부재를 확인했다. 최종 인스턴스는22:18:07.034Z 생성→22:19:40.670Z 소유35항목을 정리했다. 정확 root·하위 dist/results/temp/config·owner/nonlink·관련 Node/Edge0을 확인한 파일/빈dir만 제거했다. 기존 사용자 브라우저·DB·서비스는 변경하지 않았다.

복구는 이 소스 변경 commit만 되돌리는 범위이며 기존 원본·저장본·보호 자료를 reset/삭제하지 않는다. DB 변경이 없으므로 DB rollback은 없다. 다음 미완료 업무는 계획 순서와 실제 구현 상태를 대조해 Main이 선정하며 PMO의 다음 배정을 기다리지 않는다.
