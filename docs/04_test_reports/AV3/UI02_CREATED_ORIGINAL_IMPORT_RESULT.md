# UI02 생성 자료 → FN03 문서 가져오기 구현·합성 검증

판정: 코드 연결과 한정 검증 완료, 독립 소스 검수·실제 서비스 반영은 미완료다. 전체 UI02/FN03/Stage/작업계획서 완료 보고가 아니다.

## 사용자 동작과 변경

기존 UI02의 현재 보호된 생성귀속 자료에서 문서 가져오기 준비를 선택한다. UI06은 draftId/artifactId를 조회 힌트로만 받아 현재 초안 소유·소비 프로젝트·선택/귀속 상태와 정확한 ref를 대조하고, 기존 프로젝트 파일을 보호 조회해 bytes/hash를 확인한다. 사용자가 기존 원문으로 후보 만들기를 누르면 기존 importDocument만 전송하며 재업로드하지 않는다. 후보 확인 뒤 별도 동의·채택으로 현재 새 문서 입력에 연결하고, 저장·확정은 기존 별도 동작으로 남긴다.

새 파일과 기존 원문의 내부 상태를 구분하며 가짜 업로드 명령/receipt를 만들지 않는다. 기존 UPLOAD/PNG의 wire·동일 명령·결과 불명·재확인·대상 결박은 유지한다. 거절·주체/CSRF/클라이언트·대상/양식/세대 변경과 지연 응답에서는 오래된 표시를 무효화하고 원 입력·미확인 명령을 보존한다. 원 파일명 복원·전체 reload 후 미확인 명령 영속 복구는 구현했다고 주장하지 않는다.

부모: WORK_PLAN Stage B UI02/FN03, UI02_CREATED_ORIGINAL_IMPORT_IMPLEMENTATION.md SHA DBADEC7D26F25BF4940BD152E8915EDC8F6821EBBB1736996AD221F2736F1181. 정확 제품9/시험4 경로·working hash는 UI02_CREATED_ORIGINAL_IMPORT_SOURCE_MANIFEST.json에 보존했다. 새 API/서버/SQL/권한 변경0이다.

## 실제 확인한 증거

| 구분 | 결과와 범위 |
|---|---|
| 담당 RED | 기능/route 부재5 FAIL·기존8 PASS, 추가 양식/준비 잠금 반례1 FAIL. 이후 결과로 소급 PASS하지 않는다. |
| 담당 직접 인접 | 38 PASS/0 FAIL/0 skip, 타입 exit0, 메모리 제품 Vite437modules exit0. |
| Main fb80e9 | 동일 직접 인접38 PASS/0 FAIL/0 skip, 565.7399ms. 명령은 아래와 같다. |
| Main3d00a0 | npm run typecheck exit0. |
| Mainaebe7f | 추적된 해당 UI diffcheck exit0. 새 파일의 최종 cached 검사와 구분한다. 기존 Git 개행 경고는 억제하지 않았다. |
| Maine7da75 | 실제 Edge의 제품 컴포넌트·기본 nativefetch·same-origin 합성 응답으로1 PASS/0 FAIL/0 skip, 4995.7739ms. 첫 DOM 실행이며 RED로 소급하지 않는다. |
| 실행 제외 | 실제 DB/원문 파일 저장·정식 서비스·로그인/TLS·사용자 인수·실제 Agent는 미실행. |

Main unit 명령:

```powershell
node --test tests/unit/UI06/created-original-import.test.ts tests/unit/UI00/routes.test.ts tests/unit/UI06/import-api.test.ts tests/unit/UI06/editor-api.test.ts tests/unit/FN03/existing-png-import.test.ts tests/unit/FN03/imported-png-attachment.test.ts tests/unit/UI02/draft-artifact-api.test.ts tests/unit/FN03/forms-import.test.ts
```

DOM 명령은 node --test tests/browser/UI06/created-original-import.spec.ts다. 표시·명시 생성/채택, 결과유실 후 같은 명령 재확인, 401/403/404, remount·CSRF/ApiClient 변경, 지연 GET 중 대상/주체/기기/양식/세대/편집대상 변화·ABA와 원 입력 보존, 원문 script 비실행을 합성 화면에서 확인했다. 합성 API 응답을 실제 서버·DB 저장 증거로 사용하지 않는다.

## 임시 자원과 현재 예외

등록 전용 root는 2026-10-26T08:32:22.1768691Z 생성/09:02:22.1768691Z 만료다. d8b613에서 소유/link·관련 프로세스0 확인 뒤216파일/72디렉터리·15665175bytes를 개별 정리해08:50:41.6512034Z에 종료했다. e75460 별도08:51:39.5538157Z 관측에서 root부재·관련프로세스0을 확인했다. sandbox CIM 거부 관측4d2f61은 프로세스 UNKNOWN이며0 증거로 쓰지 않는다. 상세 UI02_CREATED_ORIGINAL_IMPORT_QA_RESOURCE.json.

독립 UI 검수 담당과 N4 보완 담당이 전역 Codex config.toml:291:15의 invalid configuration으로 종료됐다. Main은 전역 설정을 변경하지 않았고 PMO에 정확한 환경 지원을 요청했다. UI 독립 소스 검수는 미완료이며 C/I0 또는 인수 완료로 표시하지 않는다. N4 최초 후보의 Important4는 계속 열려 있고 이번 UI 검사 결과와 무관하다.

## 보존·후속·복구

UI13 source와 N44 source, 보호8·기존 자료를 보존한다. 설정 복구 뒤 독립 UI 검수와 원 N4 담당의4지적 보완을 순차 재개한다. 실제 정식 반영·검증은 기존 실행 범위를 대조하며, 이번 합성 검수를 실제 사용 가능 상태로 승격하지 않는다.

Rollback은 이 UI13 경로의 소유 변경만 되돌리는 새 commit이다. 원문·DB·후보 자료 삭제나 무관 N4/보호 자료 복구는 포함하지 않는다. 정확한 안전 checkpoint는 WORK_STATUS의 후속 Git 확인에 기록한다.
## 후속 Main 검수 — 빈 문서 첫 진입

앞선 e7da75 DOM은 미저장 입력을 가진 문서 버퍼에서 시작했다. Main은 이 결과로 빈 버퍼의 첫 진입까지 통과했다고 주장하지 않고, 추가 한 건만 검증했다. 제품·저장소 시험 파일 수정이나 이전 실패 조건 시험 재실행은 없다.

b7520b는 새 전용 Edge에서 UI02 보호 자료 링크→문서 화면의 buffer null 확인→새 문서 작성→정확 공식 양식 선택→현재 프로젝트 제어 조회→빈 초안→기존 원문 보호 재조회→importDocument만1회→후보 확인 전 본문 빈값 유지→별도 명시 채택을 확인했다. 결과1 PASS/0 FAIL/0 skip,1944.1132ms다. 원 artifact ID/bytes/hash·BOM/CRLF 보존, files POST0·자동 문서 저장/확정0·원문 script 실행0을 확인했다. 공식 양식과 기준 원문/hash는 기존 정본으로 생성했고 응답은 same-origin 합성이다. 실제 API/DB 저장 증거가 아니다.

추가 root는09:28:55.0215629Z 생성/09:58:55.0215629Z 만료,6ad9b6의 소유/link/관련프로세스0 inventory186파일/58폴더·14644612bytes 후09:31:45.0402125Z에 개별 정리했다. 53e8ed 별도09:31:52.4850847Z에 root부재/관련프로세스0을 확인했다. 상세 UI02_CREATED_ORIGINAL_FIRST_DRAFT_QA_RESOURCE.json.

Main의 읽기 검수는 새 조회 route·현재 보호 목록 링크·DocumentsPage/Editor 전달·기존 PNG 분기 보존·정확 ref/bytes/hash·현재성/WeakSet·명시 후보와 채택·미확인 명령 보존을 대조했다. 이 Main 검수와 실패한 별도 subagent 소스 검수는 구분하며, 후자는 계속 미완료다. 전역 설정 복구 없이 C/I0 또는 정식 독립 인수를 합성 시험으로 대신하지 않는다.