# UI10 지시 부분계획 명시 조회 source 결과

## 판정 → 이유 → 조치
승인된 source/API·RAM SSR 범위 검수 완료. 실제 DOM·서비스·DB·Agent 동작은 미검증이며 전체 계획 미완료다. 기존 서버의 채택된 instruction-parts GET을 선택 지시 상세에서 명시 호출하고 원문/참조/분할을 검산하는 화면만 연결했다. 새 API·DB·권한·SEND 실행은 추가하지 않았다.

기준 main65a51ae2c09328e9021f205f52c7340ab6a34b2a, branch codex/av3-ui10-instruction-parts, 문서 baseline b43a51ee. WI UI10_INSTRUCTION_PARTS_SOURCE_20261115.md SHA2563047F28F92DE381C7F0C918A64819EA9A418EB3274AD80821EBC7BD3A6EE56F4. 계약 SHA F3243D1411C4FF434F4548904B99A9B0BBA353EA171FAC0314F7D99353DD91DF 보존. Primary 단일 제품writer·Main 검수/문서/통합, 쓰기 반환/live0.

## 변경과 근거
- conversation-api.ts: 기존 함수 유지, readInstructionParts 추가. 동일 origin 명시 GET, 원 지시 canonical/hash·원문 UTF8 bytes·최대64KiB code point 분할·부분/전체hash·closed plan 검산. 각 await 뒤 원 snapshot/current 재검사. 클라이언트 검산은 서버 권한/유효성의 대체가 아니다.
- ConversationPanel.tsx: 기존 원문 상세에 명시 조회 버튼·부분 수/bytes·접힌 참조. 원 view/epoch/request 결박, 닫기·새 조회·선택/주체 변경·unmount 후 stale 결과/401 폐기. 기존 답글/정정 흐름 보존.
- API 합성시험과 Vite write:false/envDir:false RAM SSR 시험 추가. 신규 종속성/DOM 모사기/브라우저 프로필 없음.

## 정확 검증
```
node --experimental-strip-types --test --test-reporter=tap tests/unit/UI10/instruction-parts-api.test.ts tests/browser/UI10/instruction-parts-render.test.ts
```
Primary8P0F0SKIP exit0(b6873b). Main fresh8P0F0SKIP exit0 680.5285ms(b2588b). 정상 plain/markdown/BOM/2MiB·다중바이트 경계, 재해시된 짧은 분할/offset/부분변조·다른지시·추가필드·원문변조·digest/JSON 지연·현재/늦은401 검산.
```
node --experimental-strip-types --test --test-reporter=tap tests/unit/FN05/conversation-api.test.ts tests/unit/FN05/conversation-reply.test.ts tests/unit/FN05/conversation-buffer-update.test.ts
npm run typecheck
```
인접9P0F0SKIP exit0(83afd5), typecheck exit0(52c595). 기존 unchanged 검사 중복 실행하지 않음.

Main은 SSR config envDir:false 누락을 발견해 시험 1줄만 보완 지시했다. 초기 실행에서는 환경파일 로딩이 명시 비활성화되지 않았으며 실제 env/Secret 읽기 여부는 조사·단정하지 않는다. 보완 후:
```
node --experimental-strip-types --test --test-reporter=tap tests/browser/UI10/instruction-parts-render.test.ts
```
2P0F0SKIP exit0 631.4058ms(0721ef), Main 최종설정·지문/diff exit0(903b93). 제품/단위시험 불변. 독립 spec/quality C0/I0/M0는 제품4경로 소스 검수이며 이후 단일 시험 envDir:false 추가는 Main 재대조했다.

## 실패·미검증
미구현 RED API3F/SSR2F, ApiError 시험대조 message→code 수정2F, Python cp949 읽기오류1회 UTF8명시 수정. 기존 기대값 완화 없음. WI 최초 CRLF diffcheck exit2는 LF정규화 후 문서 commit했다. 실제 React DOM parent lifecycle/클릭·레이아웃·서버 HTTP/DB 왕복·사용자 원문·SDK/Agent·키·서비스는 미실행. SSR은 Lookup/Details 출력 구조만 증명한다. 합성 active 호출은 실제 UI 효과 실행 증거가 아니다.

## 최종 SHA256
- apps/web/src/features/knowledge/conversation-api.ts
  SHA256: 254F47719BBE000A43FD86BE8304C263A61F11144AA7E6BCC2B1EA67DA503CA4
- apps/web/src/features/knowledge/ConversationPanel.tsx: 250044A2275CA69BF67C320A21C942657DEE301ECC0E5D9A5D63F3DBE03A657A
- tests/unit/UI10/instruction-parts-api.test.ts
  SHA256: 2A7EA4D48D43A58455A07B2AE336D5905C7989B21C9554942AFD9D9040D85468
- tests/browser/UI10/instruction-parts-render.test.ts: 03A021A91FB18FC49D7E1278531134AAFE3E73F7E07AD345C91E01E72B1F7449

복구: 이 source 커밋의 위4경로를 일반 revert하여 기존 UI로 복구한다. DB/서비스 복구는 필요하지 않으며 실환경 작업을 하지 않았다. 통합 SHA·병합후 검사는 후속 WORK_STATUS에 기록한다.

커밋 전 gitleaks가 결과서의 api 파일명 뒤 SHA256을 generic-api-key로2건 감지했다(af58c5/9a3e69). redacted 진단과 실제 Get-FileHash 값으로 파일 지문임을 대조했으며 시험/제품 비밀값 발견은 아니다. 파일 경로와 SHA256 레이블을 별도 줄로 명시해 오해를 제거한다. ignore/규칙완화/우회는 하지 않는다.
