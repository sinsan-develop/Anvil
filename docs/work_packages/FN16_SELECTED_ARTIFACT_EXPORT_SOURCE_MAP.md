# FN16 선택 원문 반출 — 실제 소스 경로 지도

Main이 rg 실제 목록에서 존재를 확인한 참조 패킷이다. 없는 파일명을 추정해 조회하지 않는다. 현재 작업은 이 파일과 WI의 허용19경로를 따른다. 경로명은 저장소 상대경로이며 source를 다시 검수할 때 실제 Git 상태와 대조한다.

| 역할 | 실제 경로 | 확인 SHA256 |
|---|---|---|
| ProjectListCodec | apps/server/modules/projects/service.ts | BA306FE1918330FBF1AB508E7FC34E7BB6FD4E9F2E9C29DACECBB7E525FA2FAB |
| ArtifactStore | apps/server/storage/artifact-store.ts | 37695BBC4AA691CD2011DC2346F78EBA9181D1EA2BB64EF40D1DEC66274AD01D |
| 원문 격리 검사 | apps/server/storage/sensitive-inspection.ts | 3BC21E347CAA314D909756BBA30D9F8535F4F790BB42B5207BF25B0DEDE8A815 |
| 보호 파일 GET | apps/server/modules/documents/project-files.ts | 79AB7BF44B55D85D38FE59DBA3F48E39B903C0D8066C4FF721C2CAC4E46CE7D4 |
| 현재 권한/receipt | apps/server/modules/access/project-command.ts | 6BF9FC0BC777C3323296D4A5DEEBA1662B49192941A0FABC507560A989CF4F2E |
| 인증·cursor 서명 | apps/server/modules/access/repository.ts | 48ACE9A3B6BE563C7FB25A6552E3EB38E50352C6DCD3DA4FECBF56EB3FD48CC5 |
| 서버 등록 | apps/server/modules/projects/routes.ts | 6A1B5E8A0C939BE0A8541E5591438D2E1151204D036D68AF016FFC9950D8EDB9 |
| 서버 옵션 | apps/server/modules/access/routes.ts | 6CD6628C7B6EA94396AC99A8EDCC801B7D929D26FE36DC1DFC9C8F7F4F5D6D90 |
| 서버 bootstrap | apps/server/main.ts | AB0842C1B30589C83FF24FD5D8568B5A3472A800E6E505FCF451CB5C7512D8D0 |
| 서버 App | apps/server/app.ts | CEFDC345B3F3D849E5F215E02EEB9C054B654B212B0BE5AC236C240C8EB0EF71 |
| 파일 manifest | apps/server/modules/backups/file-manifest.ts | 301558A84F57D3011488FA165BD11479726C9BB4D98BD14A764C69AB9409E379 |
| 파일 builder | apps/server/modules/backups/file-bundle.ts | 973DD9B44BFF47196E05205530C9C40865362D34F6085073A93582C11042DB5B |
| 파일 검증복원 | apps/server/modules/backups/file-restore-validation.ts | A6145CB651480F930296AC497F9DE2A941473C10B6F8608D0B83A7E0640AE362 |
| 알림 서버 참조 | apps/server/modules/notifications/project-notifications.ts | 32639105513E2CAE58FB0D1EFDE8C8B982397664BA3D9C2131933E835E6A9966 |
| 알림 웹 API 참조 | apps/web/src/notifications/project-notifications-api.ts | EF03C326E8A42D9BF7AE8AC9B4B393DA8524D41E827DB5B86176CBC6D0903808 |
| 알림 웹 패널 참조 | apps/web/src/notifications/ProjectNotificationsPanel.tsx | CEC388E435586F50C206F376848051E3C4E6845E5A82DBB0B88C6FD665CBA34F |
| 알림 실제 App fixture | tests/browser/UI14/project-notifications.spec.ts | D78D9BAD0298F446AD6EDD10DB3560E766E141C82A67DC2BA913F110A1C86227 |
| 웹 ApiClient | apps/web/src/api/client.ts | 82A8EECD87E05B69F5CE32DB4CA336CA81007D7286B86537CA2552D495165DF5 |
| 설정 안내 데이터 | apps/web/src/features/settings/SettingsSourceLinks.ts | A1B777165D6B4C95F83D2B4AA3085962ACBE8EF593C1C00711764CF8F0E84071 |
| 설정 보안 슬롯 | apps/web/src/shell/AccountSecurity.tsx | 96320260EAC05F77DE935D9C1FE8CDF8CB723C56D3A9F24EAACD08A1C89491EA |
| 기존 자료정책 시험 | tests/unit/UI11/material-policy.test.ts | 4A9BF7C9E5E97467D3E6E6C5A398FA1F00A0D80136B72950D939C17081F6243E |

App import와 import 상대경로를 먼저 해석하고 존재를 확인한다. 새 파일 이름은 WI에서 정한 생성 대상에만 사용한다. 이 지도는 보호 파일 수정이나 다른 QA root 재사용을 허가하지 않는다.
