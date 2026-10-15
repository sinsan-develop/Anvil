# AV3 P02 상세 계약 종료 검토

## 판정·범위

**P02 계약 산출 수용 / 제품 기능·실제 Agent·보안·DB 실행 미검증.** 담당 Main 어울, 2026-10-16. 설계 r8·계획 r7의 P02 업무 카드와 P01 직접 승인, TD-01~03을 기준으로 상세 배정 계약을 대조했다. 문서 준비 완료를 제품 개발 완료로 계산하지 않는다. 다음 업무는 승인된 P03이다.

## 대조 근거

| P02 완료 조건 | 정본·관측 |
|---|---|
| 기술·서버/파일·웹/Windows·로그인·유한 정책 | TECH_DECISIONS §3,9,11,12. TD-01 A안, TD-02 전용 로그인, TD-03 유한 기본 정책의 직접 응답/질문 식별 보존 |
| UI15/FN18의 연산·입출력/권한·오류·원자성/재전송·이벤트 | INTERFACES §6~15. 공개 사용자 명령과 서버/실행기 내부 연산 분리·기본 거절·정확 버전/권한·제어 검사 |
| 저장·원문/이력·파일/DB 실패·보호/보존 | DATA_MODEL §6~11. 같은 프로젝트 참조·불변 버전·별도 이벤트·비밀 없는 감사·실제 source 관측과 선언 구분 |
| 정확 파일·단일 writer·소유 검수 | FILE_MAP §1~10 및 말미 검토 보완. UI/FN/IX·공통 schema·migration·명령/검수 파일과 연결 |
| 후보별 필수6능력·지원/미확인·비용 경계 | CAPABILITIES §2~7의 기존 공식/설치 조사와 6×4 표. 실제 실행 미확인은 유효한 조사 결과이며 actual go 아님 |
| 양식·상태/설계 추적·위협/후속 시험 | 공식산출물_양식정의·문서작성_공통기준·TRACEABILITY·THREAT_MODEL. 작성/검토/확정·실행 승인과 실제 시험 결과를 분리 |
| 측정/단절·손실·backup 기본안 | TD-03 §12: 대표 표본/측정법·유한 크기/시간/호출·1writer·수동 backup/자동 삭제 OFF. 실제 성능·손실 측정0 |

구조 대조는 UI15/FN18의 명칭·소비 지도, 능력표6행, 상세 계약 Markdown 표37개, 혼입 문자/열수 불일치0·`git diff --check` exit0를 확인했다(검토 보완 전 관측). 이는 문서 구조 점검이지 제품 테스트가 아니다. 후속 보완 문서는 다시 diff/관계·manifest hash를 대조한다.

## 독립 검토·보완

읽기 전용 검토자는 최초 **Critical0 / Important3 / Minor0**을 보고했다. 기존 소스의 최초 참조 발급, 문서–소스 링크/드리프트 선택, 구버전 제목·출처 저장 누락이다. Main이 기존 FN01/03 안에서 INTERFACES §15.4·DATA_MODEL §11.1/문서 버전 필드·FILE_MAP 시험 소유로 보완했다.

Scoped 재검토에서 원래3건은 해소됐고 append 이력 FK가 현재 link version CAS와 충돌하는 Important1을 추가 확인했다. 권장한 최소 수정대로 event FK를 불변 `(project_id,link_id)`로 제한하고 당시 세대값을 불변 저장·현재 CAS/event append 원자 처리로 정정했다. 이 정확 보완 후 해당 검토 범위에 남은 Critical/Important0이다. 새 기능·소스 자동 쓰기 subsystem·과도한 전체 재설계는 추가하지 않았다.

## 실제 상태·미검증·오류

- 시작 branch `codex/anvil-public-ui-preview`, HEAD `ef80f61c1e82ec7a70d319efb5c76061111f9228`. staged0·기존 삭제852/수정3을 보존했다. 신규 v3 문서는 아직 commit/push 전이다.
- 지정 private main을 fetch해 `b4f9006e30e5afcf98ef8ef1f39707ecc8954feb`·현재 tree 파일0을 확인했다. 예전 로컬 추적 ref는 갱신했고 다른 원격/main 쓰기는0이다.
- 실제 제품/API·DB·브라우저·Agent·OS 소유/회수·인증/보호·패키지 실행 시험 **NOT_EXECUTED**. P03/FN/IX에서 실제 수행하며 문서 합격으로 승격하지 않는다.
- 첫 외부 registry 조회는 sandbox DNS 제한으로 같은 오류가 한 명령의 반복 내에서 발생했다. 반복 방식 중단·오류 즉시 중단 설정 후 허용된 외부 읽기로 metadata를 확인했다. 설치/ACL/네트워크 수정0이다.
- 문서 패치 문맥 불일치 시도는 적용0이었다. 원문 재독 후 정확 전체 내용 대조 패치로 수정했고 적용되지 않은 시도를 성공으로 세지 않았다.
- 고정 package 버전/lock·실제 명령·경로/이미지·DB migration 재현·합성 QA·인증서/현재 사용자 신뢰는 승인된 P03 소유다. 유료 Agent 호출·기존 서비스 교체·Oracle는 미승인/미실행이다.

## 후속·복구

P03 직접 승인 3범위를 BASELINE_MANIFEST·DEVELOPMENT_ENVIRONMENT·WORK_STATUS에 결박한다. 기존 자료를 보존하고 최신 지정 private main의 `codex/av3-stage-a`만 사용한다. 승인51파일과 새 계획 범위 파일을 실제 commit 목록/hash로 대조해 게시하며 Backup/legacy/Secret/다른 프로젝트는 제외한다. P02 문서 보완의 복구는 보존한 이전 승인본/이력과 변경 diff를 기준으로 하되 기존 dirty 자료를 reset/overwrite하지 않는다.
