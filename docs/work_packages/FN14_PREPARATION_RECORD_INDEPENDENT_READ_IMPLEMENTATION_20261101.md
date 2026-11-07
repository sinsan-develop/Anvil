# FN14 Web 독립 고정조회 소비 보완

2026-11-01 · Main 어울 · 기존 FN14 Web 직접 승인 및 WI 874FE5DF의 내부 구현 보완.

## 목적·기준
게시 기준 8a3c15377d9e6b56f43a23906f9b1b480fb979f1. 현재 Panel의 저장 영수증 조건 안에만 고정 GET 진입이 있어 새 App/다른 client에서 이미 아는 준비기록 fullref를 조회하지 못한다. 기존 계약·보호 GET를 그대로 소비하며 목록/검색/권한/API/데이터 계약을 추가하지 않는다.

## 단일 writer·정확 범위
기존 Primary만 다음 최대3을 변경한다. Main은 제품 write 없이 검수·통합한다.
- apps/web/src/features/transfers/TransferPreparationRecordPanel.tsx
- tests/unit/UI09/preparation-record-ui.test.ts
- tests/browser/UI09/preparation-record-dom-harness.tsx (필요시)

App·Page·API reader·서버·SQL·관측 HTTPS4·보호3은 불변. 코드·시험 읽기는 허용한다. 실제 DB·권한·키·서비스·Agent·사용자/백업 파일 조사·현재 프로젝트 차단 해제는 제외한다.

## 구현·검수
- 빈 버퍼/새 client에서 알려진 id/version1/hash를 명시 입력하고 현재 검산된 확정 임무와 기존 readPreparationRecord를 통해 조회한다. 쓰기 제어권이나 새 POST·원작성 client가 선행조건이 아니다. 서버 현재 AUTH/OWNER/read 정책은 그대로 따른다.
- hash/임무 불일치·현재403/401·늦은 응답과 owner/client/CSRF/transport/임무 ABA·입력 변경은 실패 또는 폐기로 처리한다. 원문 표시를 새 주체에 남기지 않는다.
- 조회 전후 POST0·부모 buffer 불변. 기존 저장 영수증·UNKNOWN 원명령/명시 재확인을 유지한다. list/ref 자동 생성·자동 새 저장·권한/이전/실행 승격은 금지한다.
- 실제 React 진입 부재 RED 1회→최소 구현→focused GREEN/type/diff·독립 C0/I0. 기존 완료 검수/전수시험을 불필요하게 반복하지 않는다. 오프라인 native QA는 Main 사전 자원 등록 후에만 수행한다.
- 반환: 시작/종료 hash·diff·정확 명령/종료코드·실반례·수정·남은 미검증·자원/실효과0. subagent commit/push0, Main은 정확 allowlist만 통합한다.