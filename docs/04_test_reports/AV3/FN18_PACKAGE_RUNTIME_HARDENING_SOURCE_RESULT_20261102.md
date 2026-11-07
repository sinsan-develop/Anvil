# FN18 패키지 보호 source 구현·검수 결과

2026-11-02 / Main 어울 / 기존 Primary·Reviewer

## 판정

**소스 한정 검수·통합. 실제 패키징·설치·native 지원·전체 계획 완료 아님.**

기준 WI: docs/work_packages/FN18_PACKAGE_RUNTIME_HARDENING_SOURCE_IMPLEMENTATION_20261102.md, SHA256 216287E8193E6FF66D249DC790197B6D5CD08AB28042023ACB1D6BE3945283D9. 시작 HEAD 6cc2caab0249629a1488970b94fbd43d16f2d094, 기존 codex/av3-stage-b. 코드 커밋 **1d67636f50f0a8fb78bf6bdf8d72ed2ce165fd70**, 정확7파일/177추가20삭제. Main52478e가 7 SHA와 raw/index bytes 동일·staged diff0을 확인했다. 다른 담당 변경·보호 untracked3는 커밋하지 않았다.

## 변경과 소비 경계

- 공식 Forge plugin-fuses8.0.1/fuses2.1.3으로 RunAsNode/NodeOptions/NodeCliInspect=false, EmbeddedAsarIntegrityValidation/OnlyLoadAppFromAsar=true를 고정한다. 기존 SDK prePackage·asar:true·offline ZIP·이름·prune·unsafeArg/renderer IPC는 보존한다.
- postPackage와 동일 bounded Maker가 새 verifier를 소비한다. 실제 fuse wire/공식 판독값, Packager20.3.0의 INTEGRITY/ELECTRONASAR resource, ASAR4.3.1 원 header와 각 파일 block/hash를 대조한다. 형식·중복·크기/개수·경로/link·읽기 중 교체는 거절한다.
- maker의 필수 검산 결과는 검산 전후 동일한 원 tree와 exe/ASAR hash에 결박한다. 반환 snapshot을 구조 검산·복사·동결하고 복사 직전/각 파일/복사 후/최종 원본을 대조한다. 검산 뒤 바뀐 파일을 새 기준으로 채택하지 않는다.
- production verifier는 고정이다. 기존 vendor phase 시험의 명시 stub은 그 시험의 메모리 snapshot과 호출 순서만 증명한다. 새 무결성 증거로 집계하지 않는다. 기존 PE/ZIP fixture bytes·vendor 실패 기준은 보존했다.
- 기존 non-root package entry 변경/삭제0, root devDependencies 4개 명시와 새 plugin/fuses package entry2개만 추가했다. 기존 ASAR4.3.1/resedit2.0.3은 동일 버전 direct 개발 의존성으로 명시했다. SDK/archive·과거 산출물은 변경하지 않았다.

## 정확 최종 소스

| 파일 | SHA256 |
|---|---|
| apps/desktop/package.json | F21795964068338AEA8BFD811F7B6FE83B7AF35F81174387536CBF24693749DD |
| apps/desktop/package-lock.json | 544557A7849299B37EA00E6AF07E00E30DE54C51F950C64A94A050EDAC0516A8 |
| apps/desktop/forge.config.cjs | 730BDB755C805B533DD9D642C5DFD4BB93CA2FD1B2F92A354BCAF2EBD7C1B5AA |
| apps/desktop/scripts/verify-package-hardening.cjs | 7ADA62AA68044BAEBB41231C685E6A22B5778EF5A8C7C5EA586814018A4E3C32 |
| apps/desktop/scripts/make-installer-development.cjs | 5A76676052A03A49C247D768776C3C98AD3E99C26087DAE137B0F41A8385B0BC |
| tests/desktop/package-hardening.test.cjs | AAB9BFA5A9256F34DBEFC4EA21E96F3A0EB5C314B0D201B2E5746130C88B54CA |
| tests/desktop/installer-development.test.cjs | 4FD413FEB6AB4B1457E8604FA9B0465FCF2B39D74A699952163EA628269593D1 |

## 검증·오류

- Primary177153: config→공식 plugin 생산 누락 RunAsNode=49 대 기대48로 exit1. Primary b5d95c: 검산 뒤 package 변경이 새 baseline으로 채택되는 반례 exit1. 두 원본 RED를 보존한다.
- Primary be4a2e: 최종 신규13+legacy21=34 PASS/3010.8072ms·exit0. a4560e desktop type0,419549 scoped diff0.
- **Main62430d: 신규13+legacy21=34 PASS, fail0/skip0/2605.04ms·exit0, desktop type와 scoped diff exit0.** 수행자 결과와 중복 합산하지 않는다.
- 독립 Reviewer: 정확7 시작/끝 SHA 일치·C0/I0. config→실제 verifier→same Maker 소비, 원 snapshot 결박·clone/freeze, ASAR 빈 파일/중복 offset 생산형, lock 기존 entry/fixture 보존, 기본 native isolation 차단을 읽기 검토했다. Reviewer는 별도 실행 검증을 하지 않았다.
- metadata JSDoc 적용 누락의 동일 타입 오류3회는 Primary 정식 실패보고 후 Main이 해당 줄바꿈만 직접 인수했다. 역치환 전체 bytes 동일·선언/실행 본문 불변·추가 any/억제0이다. Main3776b6 TS7의 없는 JS API import는 쓰기/tsc 전 준비 오류1,9ae68e는 최소 보정/type0,독립 scoped C0/I0이다.
- TS7 API/fixture 함수·const 추출/Forge 경로 준비 오류와 QA elevation 누락 EPERM은 별도 준비·환경 오류로 기록했다. EPERM 때 실제쓰기0이며 ACL을 바꾸지 않았다. 새 시험의 마지막 CRLF만 LF로 동등 정규화했다.

정확 Main 명령:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test tests/desktop/package-hardening.test.cjs tests/desktop/installer-development.test.cjs
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p apps/desktop/tsconfig.json
git diff --check -- apps/desktop/package.json apps/desktop/package-lock.json apps/desktop/forge.config.cjs apps/desktop/scripts/verify-package-hardening.cjs apps/desktop/scripts/make-installer-development.cjs tests/desktop/package-hardening.test.cjs tests/desktop/installer-development.test.cjs
```

## 자원·미검증·복구

등록 temp2는 최초 생성2026-11-02T01:42:58.553863Z/만료02:42:58.553863Z이며 연장하지 않는다. 의존성 cache·빈 npm config와 새 합성 PE/ASAR 시험 전용이다. 실제 Electron/Anvil/Setup·installer/native/helper/C#·키/DB/권한/서비스/Agent·실자료/P03R3 실행0이다. 라이브러리가 새 합성 bytes를 생성/읽기/수정한 증거이며 실제 OS/loader 변조 거절·설치/제거/복구·사용자 인수는 NOT_RUN이다.

기본 INSTALLER_NATIVE_ISOLATION_NOT_VERIFIED는 유지한다. 이번 결과로 실제 native owner/peer admission·등록 key mapping·보호 recipient/ACK·제품 기본 등록·악성 동일 사용자 방어가 완료되었다고 주장하지 않는다. 새 trust root/서명/권한을 채택하지 않았다. 예전 source/tool pin의 실행안은 재사용하지 않는다. 소스 복구는 코드 커밋의 정상 revert 후보이며 실제 환경 rollback 발생0이다. 임시자원 회수와 Main 별도 부재 확인은 WORK_STATUS의 후속 기록을 따른다. 전체 FN18/44업무는 미완료다.