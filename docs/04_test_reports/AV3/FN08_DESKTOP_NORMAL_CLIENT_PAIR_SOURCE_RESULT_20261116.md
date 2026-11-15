# 데스크톱 보호 credential 통신 쌍 연결 결과

기준 main094ff18e, branch codex/av3-normal-owner-client-pair. WI SHA256 E0AB2A40C108FC41686AA53B69013C378CB928C1C03E7B964E00B30FA0BB2C4C. Primary 구현, Main 검수·통합. 제품3/시험2경로의 기존 보호 발급·통신 계약 내부 조립이다.

기존 owner의 bootstrap API는 보존한다. 새 명시 메서드는 같은 owner가 발급한 port를 내부 보유하고 같은 번들의 factory에서 GET/POST·만료값만 반환한다. 다른 grant/CA/scope/세대/기한·번들·caller credential은 거절한다. 명시 갱신은 실제 직전 쌍의 객체 동일성을 검사하고 성공 뒤 구쌍 전송을 차단한다. dispose/invalidate 뒤에는 이미 준비된 packet도 추가 host frame을 보내지 못한다. 전송 전 갱신 거절은 유효한 원 쌍의 사용을 보존하며 전송 후 CA 불일치·진행 중 dispose는 결과 불명을 보존한다.

폐쇄 build의 실제 의존 파일을 개별 등록하고 factory1개만 export에 추가했다. port/signer를 새로 노출하지 않으며 정확 source/export·전후 검산·외부 모듈3개 제한을 유지한다. 새 IPC/서버 API/권한/원장·자동 polling·CURRENT·SDK 호출을 만들지 않았다.

## 검증

- RED faacf1: REGISTERED owner의 조립 메서드 부재, 0P/1F/exit1. GREEN 45669d 2P.
- node --test tests/desktop/native-proof-runtime-build.test.cjs tests/desktop/normal-execution-credential-owner.test.cjs — f047ba, 30P/0F/0SKIP/exit0. 실제 메모리 CJS 번들·RAM host 여정이다.
- 최종 추가 갱신 전 거절/갱신 전송 후 반환 시험 — f6d997, 2P/0F/0SKIP/exit0. 기존 등록 인접2P는 fa2f2f로 별도 확인했다.
- 루트 npm run typecheck 19c3ee exit0, 새 entry strict 타입검사65153c exit0, diffcheck f8d862 exit0.
- 데스크톱 전체 타입검사 d03329는 진단169/exit1이다. TS7로 HEAD/현재를 RAM overlay 대조한944a44는169/169·추가0/소실0·exit0이었다. 전체 타입검사를 PASS로 승격하지 않으며 기존 진단은 범위 밖 미해결로 보존한다. 최초 inner의 CLI 상대경로 검사1회는 MODULE_NOT_FOUND였고 설치된 동일 TypeScript resolve 후 검사했다. 설치/설정 변경0.
- Main 최종66d20a: 동일 번들 GET/POST 조립 핵심1P/0F/0SKIP/exit0. 독립 최종 C0/I0/M0·5지문 대조. live0.

## 동결 지문

- trust-enrollment-owner.cjs SHA256 0D3574F74753C50092592DA8BFE5FF45E60C8B1ECC27DF5F77DB5DE8E9E7956D
- native-proof-runtime-entry.mts SHA256 67BA9F30ED23B0E380D7115BD0E67CAFCA528CEB336E23509BC4C2CB6A11FE33
- native-proof-runtime-build.cjs SHA256 357E277C6D1D044E4BE4BE83D183B32B9506C01437416BA64F4279FC199C98EB
- native-proof-runtime-build.test.cjs SHA256 F086888859590C60C0C4AADEEE5F27C465479B60DEC3F0447285B3F73690DFB7
- normal-execution-credential-owner.test.cjs SHA256 E14D4EFB88119ADD02B7C24049B9EE201BD7AB30259147313C2A8566CF935516

실제 TLS/키/네이티브 host/파일 내구/DB/서비스/SDK/Agent·사용자 인수는 미검증이다. 전체 FN06/FN08·계획은 미완료이며 RAM 결과를 실제 연결 완료로 표시하지 않는다. rollback은5경로 한정 diff 역적용이다. 다음 normal 실행 세대별 root 배정 생산자는 기존 채택 근거가 확인되지 않아 별도 계약 후보로 분리한다.
