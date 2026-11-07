# UI02 생성 귀속 원문 → FN03 문서 가져오기 연결

## 기존 승인·목표

WORK_PLAN Stage B UI02/FN03, SCREEN_WORK UI02의 문서 가져오기와 FUNCTION_WORK FN03의 기존 importDocument(context,fileRef), 직접 승인 FN01 r3 F4E734B396485E574A8119AECA1731D4F38C2114B15AB285EF18DA1EABC584D0 §1·3을 소비하는 화면·클라이언트 구현이다. 새 공개 API/SQL/권한 계약이 아니다. e2848e9f 원문 업로드/초안/귀속/보호 조회는 재작성하지 않는다.

현재 서버는 READY fileRef를 보호 조회해 기존 가져오기 후보를 만들지만 화면은 새 File 업로드만 제공한다. 원 artifact ID/bytes/hash를 유지하며 재업로드 없이 후보 생성→별도 명시 채택→기존 별도 저장으로 연결한다. 자동 실행/문서 확정은 없다.

## 단일 writer와 경로

구현 담당 ui02_existing_original_import, Main 어울 관리·검수·통합. N4 source4는 동결/읽기 검수 중이며 수정 금지다. 기준 d938c00e5c18e55810c74cbb1eb11c6fda2f8b85, 현재 Main 문서/N4 dirty·보호8 보존.

허용 제품 경로:
- apps/web/src/shell/routes.ts
- apps/web/src/App.tsx
- apps/web/src/features/project-create/DraftArtifactsPanel.tsx
- apps/web/src/features/design-trace/DocumentsPage.tsx
- apps/web/src/features/design-trace/DocumentEditor.tsx
- apps/web/src/features/design-trace/DocumentImport.tsx
- apps/web/src/features/design-trace/import-api.ts
- apps/web/src/features/design-trace/imported-png-attachment.ts
- 신규 apps/web/src/features/design-trace/created-original-import.ts

허용 시험은 신규 tests/unit/UI06/created-original-import.test.ts, tests/browser/UI06/created-original-import.spec.ts 및 동명 harness, 기존 tests/unit/UI00/routes.test.ts다. 기존 직접 인접 시험은 읽기/실행만 하고 기대값을 바꾸지 않는다. 서버/계약/SQL/정식DB·권한·Secret·서비스·Agent/다른 파일은 변경하지 않는다. 추가 경로 필요 시 Main에게 실제 소비 근거를 제시하고 한정한다.

## 화면·처리 경계

1. 현재 보호 record FINALIZED/READY/projectId 일치에서 가져오기 준비를 명시 선택. URL은 정확 draftId/artifactId 조회 hint만, 본문/hash/파일명/권위 없음.
2. UI06 현재 readProjectDraft의 소비 프로젝트/저장 선택 ref/귀속 record 대조→보호 project file GET→정확 bytes/hash를 확인. 다른 사용자/기기로 초안 조회 권한을 확대하지 않는다.
3. 양식·대상 확인 뒤 명시 importDocument만 전송. source 내부 구별은 UPLOAD/기존 원문으로 하며 가짜 upload 명령/receipt 금지. 공통 recordCommandId와 기존 업로드/PNG frozen 명령·uncertain/replay 의미를 보존한다.
4. 후보 READY에서만 별도 동의·명시 채택. UNSUPPORTED/FAILED는 사실대로 표시. 기존 원문/초안 입력·pending/history 자동 삭제/교체 금지. 표시명은 명시 표시명이며 원 파일명 복원으로 꾸미지 않는다.
5. 표시 snapshot을 user/client/CSRF/ApiClient/project/draft/artifact/양식/제어세대/편집대상/단조 시도에 결박. 지연·ABA/401/403/404/격리/변조는 옛 metadata·본문/다운로드 표시를 무효화하고 원 버퍼/미확인 명령은 보존. 새 보호 GET 성공 전에 복원하지 않는다.
6. 기존 App 버퍼가 남은 이동/재진입과 전체 reload를 구분한다. reload 후 잃은 미확인 명령을 영속 복구했다고 주장하지 않으며 자동 후보 생성 금지·기존 보관 후보 조회 안내. 이번에 영속 명령 저장 계약을 추가하지 않는다.

## 검수·인계

- unit RED→GREEN: 현재 없는 기존원문 준비/직접 후보 생성, exactref/bytes/hash·귀속 실패·현재성·same-command uncertain 재확인. 기존 File/PNG wire·target 불변.
- 정상: 보호 GET→후보 POST→명시 채택, 동일 artifact ID/bytes/hash, file POST/자동 저장·확정0.
- 중요한 실패: 다른 draft/project·미선택/UNKNOWN/격리/위변조·지연/ABA/주체변경에서 후보 POST/자동 입력변경0; 단절 후 새 command/재업로드0.
- 직접 인접 unit와 타입/제품 빌드. 새 DOM은 Main 사전등록 자원 후 실제 RED/GREEN, 담당이 임의 자원 생성하지 않는다. 실제DB/served/TLS/사용자 인수·실Agent 실행은 이번 범위에 포함하지 않는다.
- 작업 후 정확 허용 diff/working SHA, 명령/exit/결과, 미검증·회귀·rollback, writer 해제를 제출. Main 독립 검수·실행을 거쳐 기존 branch에 안전 보존한다. 전체 UI02/FN03/Stage/계획 완료로 승격하지 않는다.