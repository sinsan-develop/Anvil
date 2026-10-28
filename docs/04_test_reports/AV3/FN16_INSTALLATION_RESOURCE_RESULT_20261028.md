# FN16 설치 자원·이식키 source-only 구현 결과

2026-10-28 · Primary fn16_primary · Main 최종 검수·QA 회수 기록 추가 전

## 판정

승인된 계약의 서버·미적용 SQL·웹 metadata/승인 연결 및 합성 전용 Secret 화면을 구현했다. 현재 제출은 **source-only 검수 후보**다. 실제 설치 adapter·키·DB·TLS 검증 및 전체 FN16/작업계획서 완료를 뜻하지 않는다. Secret 입력은 실제 App에 제공하지 않으며 별도 합성 컴포넌트로만 시험한다.

## 기준과 변경 범위

- branch: `codex/av3-stage-b`; 최초 승인 baseline `282e2d15b5af359323ba2db02ce3b9ba72dd9704`.
- 직접 승인: `docs/approvals/FN16_INSTALLATION_RESOURCE_DIRECT_APPROVAL_20261028.json`, SHA256 `3FAD0CE959F9972E0DA1C131FFA5FB07521B2381343D3D590A6957BCFE33CBDF`.
- 계약: `docs/contracts/FN16_INSTALLATION_RESOURCE_PORTABLE_KEY_CANDIDATE.md`, SHA256 `5A6819E626F2FF4104862988C07230A00676D07F06A25658BC9344746335D053`.
- 지시서 `docs/work_packages/FN16_INSTALLATION_RESOURCE_IMPLEMENTATION.md` r5 및 동명 SOURCE_MANIFEST의 허용28경로. Main이 관리하며 사용자 자료·보호8경로를 수정하지 않았다.
- 단일 writer가 DTO/codec/provider/store/route, 기존 auth·명령·R2 소비선, 미적용0054, UI14·App·승인 화면과 정확 시험을 연결했다. 기존 export/retention, 원 ENROLL 귀속과 과거 envelope/receipt를 보존했다.

## 구현 내용과 검수된 checkpoint

| 단위 | 구현·핵심 조건 | 검수 checkpoint |
|---|---|---|
| 키 상태·보관 확인·해제·자기 재잠금 | 원 승인 소비 귀속, 현재 인증/제어/정책·최단기한, cold restart LOCKED, 실제 메모리 lease 1개, 먼저 평문 소거·감사 불명 구분 | `ea883146685b7b53e012a955be43fe60b1e0c1db` |
| 이식 | 같은 origin/key 정체성, 새 설치 descriptor LOCKED·복사 미확인, 첫 제출 소진·원 intent 재실행 금지, 파일 효과 불명 UNKNOWN | `2b49bd9688e90a7a5faf10bf4d7131d3caef828d` |
| 비밀번호 변경·자료 키 교체 | 불변 최대 version+1, 기존 envelope 보존, wrapping별 상태·프로젝트 단일 lease, 정확 보관 확인 후 head 전진·역행 금지, R2 자동 선택 금지 | `cba813e5bb8fe23543c17fca71e873e16d28fe89` |
| UI14·R2 | metadata 작성→원명령→별도 일회 승인→원명령 복귀·명시 실행, 조회/암호문 다운로드/자기 재잠금, 고정 R2 ref 명시 선택 | 현재 미커밋 검수 후보 |
| 합성 Secret 컴포넌트 | 6개 action 계약 필드, 제출 전 입력 제거·이탈/transport 변경 제거, 파일 16KiB·fatal UTF8·canonical/hash·owner/선택 세대 검사 | 실제 App 미연결, 최종 DOM 검수 진행 중 |

## 실제 확인한 증거

아래 Main 수치는 독립 실행 회신이며 Primary의 재실행으로 중복 주장하지 않는다. 명령·상세 이력은 `WORK_STATUS.md` 및 각 Main 실행 기록에 누적했다.

- lifecycle: Main226707 keyLife22 PASS, type/diff0. IMPORT: Main19d4da9 PASS1736.9695ms, 공통 ENROLL 직접3 PASS1454.0111ms. 각 독립 C0/I0.
- evolution: Main0752b0 신규7 PASS1774ms/type/diff0, Main7a262d 직접34 PASS5943ms + 기존 R2 server16 PASS1566ms. 동결 backend 독립 C0/I0. 실제 PG/trigger 검증은 아니다.
- UI client: `node --test tests/unit/UI14/installation-resource-api.test.ts` 7 PASS360.1021ms(2717b8). 원 정책29개 + 승인 연산1개를 검사하는 기존 R2 시험9 PASS202.1183ms(f6ac24), 독립 Mainb764b9 9 PASS194.0256ms.
- 실제 App 합성 browser: Mainf7550f 3 PASS5.8s. 승인 왕복·원명령 결박/별도 TARGET 실행, 자기 재잠금 감사 UNKNOWN/암호문 다운로드, 화면 ABA 후 원 UNKNOWN 보존. route.fulfill 기반이므로 실제 서버/DB/키 성공을 뜻하지 않는다.
- 재인증 수정: Main44ae6f RED 후 현재 csrf별 메모리 slot을 분리하여 옛 UNKNOWN을 보존했다. 독립 C0/I0; Mainf0543f 재인증과 Secret 제출 소거/이탈2 PASS.
- 최신 제품 타입: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json` exit0(72c904). Panel SHA256 `60E527C224EE5009F8234F63761CF3E06211CAD23DB76E94DCA6220E502A3E86`; browser spec `9431B44CBB718AB1F7FC10312CA042684829B2AFEC5CA6AEA15BB68984389370`.
- 최종 6개 action·늦은 A/B·transport 소거 브라우저, 최종 diff/통합, QA 정리·독립 잔여0는 Main 확인 예정이다. 미실행을 PASS에 포함하지 않는다.

## 실패와 보완 구분

1. 제품: 첫 IMPORT의 hash/origin 검사가 claim 전이라 READY 재사용 가능 → 유효 귀속 확인 후 첫 제출 소진으로 보완. 틀린 envelope 뒤 같은 intent 재제출 반례 포함.
2. 제품: 재인증 csrf 교체 뒤 옛 UI buffer 때문에 새 작성 차단 → 인증 세대별 내부 slot으로 분리. 옛 원명령 보존·자동 재전송0.
3. 제품: Secret A 늦은 finally가 새 B 입력 ref를 지움, 동일 client transport 교체에서 effect 소거 누락 → captured secret만 해제하고 owner revision별 소거. Main3107d0/07b409/dbd188에서 각 RED 확인 후 보완했다.
4. 제품 미구현: 파일 입력 부재 → 승인 hash에 결박된 bounded 파일 선택 연결. 대표 IMPORT RED 뒤 3개 action 공통 경로 구현.
5. 시험/환경: 최초 재인증 posts[0] 관측 경쟁, component React alias 누락, action query route 누락으로 ERR_CONNECTION_REFUSED는 제품 원인과 별개다. 관측 poll·정확 alias·등록 URL route/미등록 abort로 보완했다. timeout·retry·기대값 완화는 하지 않았다.
6. 원 테스트 bytes의 Windows 줄바꿈, 편집 script 오류는 실제 기능 오류와 구분했다. LF 복구 및 기존 prefix 보존을 Main이 확인했고 Git config는 변경하지 않았다.

## 미검증·남은 작업

- native 안전 handle adapter 및 실제 설치 catalog 연결 미구현. 실제 파일·Secret 작업은 UNCONFIGURED/UNVERIFIED 경계를 유지한다.
- 실제 App Secret 입력은 미제공. TLS·서버/프록시 로그 보호 검증 없이 활성화하지 않았다.
- 실제 키 생성/이식/해제, DB migration/RLS/trigger·실 COMMIT, 실제 backup/restore, 권한 부여, 서비스/Agent/Oracle 실행: **NOT_RUN / 승인 제외**.
- 합성 codec·DB facade·DOM 성공을 실제 설치·사용자 인수 성공으로 승격하지 않는다.
- Main은 최종 UI 증거·자원 회수·정확 Git 통합을 덧붙인다. 이후 실제 연결 선행은 별도 계획 상태와 대조한다.

## 복구·기록

소스 rollback은 해당 허용 변경만 검토하여 revert한다. 기존 키·DB·원문·과거 이력 삭제/초기화는 없다. Primary는 commit/push/관리 문서를 변경하지 않았고 Main이 WORK_STATUS 및 checkpoint를 소유한다. 전용 QA root는 Main 등록 `D:/Project/Anvil/.av3-data/ui14-installation-resource-20261028-01`, 기한23:08:43 KST이며 최종 정리 판정은 아직 기재하지 않았다.

## 제출 후 집중 보완 이력

- Main9a4a0b 합성 Secret9 PASS6.1s 및 aa4363/107198 실제 App 합성3 PASS5.8s/type/build/diff0, 비밀 없는 화면 screenshot 시각 확인을 회신받았다. 실제 서비스 연결 증거는 아니다.
- 파일 입력 독립 I1: 기본 TextDecoder가 UTF8 BOM을 제거하여 원 선택 파일과 다른 canonical bytes의 hash를 표시할 수 있었다. 새 BOM 반례9830E070에서 Main59cefe 1 RED7.39s(기대 INPUT_INVALID 없음) 후 decoder의 `ignoreBOM:true` 1줄로 원 BOM을 보존하고 기존 JSON/canonical 검사가 거절하도록 수정했다. 정상 파일 검사·기대값 완화0.
- 최신 Panel SHA256 `AC55CB58FBC1B453FF7CA6A19845E7DE578241DF86A1C8456397EAD62F4BF1EB`, spec SHA256 `9830E0706CAD6A936821B980805D8738BCD8A758CA57C995696E271122E23DF5`. `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.base.json` 및 `git diff --check` exit0(d518c3).
- BOM와 IMPORT/VERIFY/UNLOCK 파일 입력3개 합계4개의 최종 Main DOM 검증 및 QA 회수는 기록 시점에 진행 예정이다. 나머지 불변 성공 검사를 다시 실행하지 않았다.


## 2026-10-28 FN16/UI14 설치 자원 source 최종 검수

- 판정: 직접 승인 3FAD0CE9 / 계약 5A6819E6 / WI r5 허용28경로의 서버·화면·미적용 SQL·합성검증 단위를 검수했다. 전체 FN16 또는 작업계획서 완료 판정은 아니다. 구현 담당 fn16_primary, 독립 검토 fn16_review, 관리·검수·통합 Main 어울.
- UI14 metadata→원명령→별도 일회 승인→원명령 복귀·명시 실행, 보호 조회/암호문 다운로드/자기 재잠금, 기존 R2의 정확 TARGET/KEY 선택을 연결했다. 실제 App에서는 검증되지 않은 TLS/로그 경계 때문에 Secret 입력을 제공하지 않는다. 합성 전용 Secret 컴포넌트는 6 action과 원 파일 bounded/canonical 검사를 구현했다.
- Main 최종 영향 검증: aa4363/107198 실제 App 합성 API 3 PASS(5.8초), type/build/diff exit0; 동일 App 재인증 증거 599adc/f0543f 보존. 9a4a0b 합성 Secret 9 PASS(6.1초), 이후 BOM 반례 59cefe RED 후 1c8405 BOM·IMPORT/VERIFY/UNLOCK 4 PASS(3.3초), build0. 이는 범위별 실행 증거이며 한 번에 전체14건을 실행했다고 주장하지 않는다. 기존 R2 unit9 PASS(b764b9), 새 client7 PASS(2717b8). 변경 없는 전체 회귀를 반복하지 않았다.
- 독립 검토의 재인증, 지연 응답/transport 소거, UTF8 BOM 지적은 각각 반례와 최소 수정 후 ADDRESSED/C0I0. 최종 Panel AC55CB58FBC1B453FF7CA6A19845E7DE578241DF86A1C8456397EAD62F4BF1EB, browser9830E0706CAD6A936821B980805D8738BCD8A758CA57C995696E271122E23DF5, App EC383A2650D681E4E20B750768C07E3F73F1521427F5D1C93784B8DD71FFD96D. 최종 author type/diff0 d518c3. 실패 원인·환경 오류는 앞선 기록을 보존하며 같은 정식 실패3회에 따른 인수는 없었다.
- QA: 등록 root D:/Project/Anvil/.av3-data/ui14-installation-resource-20261028-01, SINSAN\cyhuh 소유. 22:38:43 생성→23:03:58 KST 정확 realpath/link0/process0 확인 후 파일11·디렉터리7 정리(c7ac57), 약25분15초로30분 이내. 별도 Main9676c7 Test-Path=False로 잔여0 확인. 서버 listener/실제키·DB·서비스 생성0. 화면 시각 확인은 앞선 PNG 관측 기록이며 QA 이미지도 등록 범위와 함께 회수했다.
- 남은 구현: 실제 native 안전 handle adapter/설치 catalog 공급자와 실제 App Secret 활성화 연결. 기본 UNCONFIGURED/UNVERIFIED로 닫는다. 실제 DB migration/RLS/trigger/COMMIT, OS 파일 내구성/TLS/로그, 실제 키·백업/복원·서비스·사용자 인수는 NOT_RUN 또는 승인 제외이며 합성 성공으로 대체하지 않는다.
- 기존 보호14경로는5485c4 raw 불변 확인. 원 승인·계약과 기존 검사 기준 보존. rollback은 이번 source 변경의 검토된 revert이며 기존 자료/키/DB 삭제·초기화는 없다. 정확 허용 파일만 기존 branch checkpoint로 보존하고 PMO에 source 한정 결과·남은 선행을 전달한다.
