# FN06 source 구현 Main 접합 기록

2026-11-04 · 기존 직접 채택과56경로를 상속 · 실제 실행 GO0

## 1. S2 N event cap과 예약 M의 구분 확인

Primary의기존 nativeLimits.event4MiB 재사용보정2PASS를수거했다. event방어cap과command2MiB를혼용하지않는것은필요하다. 다만보고된M이실제예약량인지입력최대허용검사인지는구분해야한다. 현재builder의N항목별typed max/예약bytes와방어cap을Main에게메타데이터로반환한다. 부모계상의후속5개wrapper1398/1121/1707/1539/3228B·합계8993B와달라졌으면실제source원형/escaping/projection차분을설명한다. 전역event4MiB를각항목의예약량으로무조건넣어정상입력을불필요하게거절하거나반대로과소예약하면안된다.

원기존guard가생산할수있는CONTEXT_INVALIDATED등실패분기의실제event와slot/typedM대응도확인한다. 없는정상fixture를만들거나기존cap을낮추지않으며필요한경우정확typed최대보완을Main에게반환한다. 이는확정결함판정이나S2중단지시가아니며독립quota/guard구현은계속한다.

## 2. S4 보호 current 공급의 최소 접합 방향

읽기조사결과기존HUMAN고정조회는ATTEMPTED/미CONFIRMED때DELIVERY_UNCONFIRMED상태만돌려정확current tuple을공급하지못한다. 원server의freshHost/hostCurrent→기존native Bearer전용current route는정확tuple을생산하며그경로자체에DELIVERY_CONFIRMED선행조건은없다. 실제desktop조립caller는아직없다.

Main은새public endpoint를먼저늘리는대신허용새client/HTTPS파일의별도보호closure에서기존고정Bearer current GET을실제소비하는방향을선택한다. receiver가보유한원native opaque43은closure안에서만쓰고renderer/IPC/일반JSON에반환하지않는다. 실제기존route·인증형식·authority/owner·pinned origin/CA/hostname·기한/단발예산을source상수와실제producer로검산한다. 새로운caller URL/헤더목적을일반포트로열지않는다.

이것은동일native channel.current를호출하는안이아니다. 그것을owner.read에연결하면protect→slot.readMaterial→owner.read로재귀하므로금지한다. 보호 current를원low-level HTTPS driver로직접공급하고실제slot getChannel의private생존증거와별도로검산한다. ACK전challenge/consume/sign을수용증명의전제로호출하지않는다.

profile의새purpose/prefix와기존channel profile을그냥cast하면안된다. 실제기존endpoint권위·원native authority/metadata의profile fullref·TLS자료가동일검증경계로이어지는지명시적으로대조한다. 이기존소비로닫히지않아새public응답/정책/필드가필요하다면현재부재근거와최소delta를Main에게먼저반환한다. 없는current를상태bool이나성공callback으로만들지않는다. source실제조립은아직미완료이며실제네트워크/DB/helper실행은0이다.

## 3. 불변 plan과 단계별 선예약의 경계 검산

Primary가 Window 준비 시에는 원 command/intent가 아직 없다는 점을 확인했다. 부모 계상 문서 3절은 실제 fixed intent에 따른 N 초기량과 원 native 인증 Tx 선예약을 요구하고, wire의 예약 접점은 Window 이전·Offer/ARM·native Tx로 구분한다. 이 두 사실을 함께 유지해야 한다.

현재 불변 plan의 maxBytes를 사후 덮어쓰거나 기존 source의 방어 cap을 정상 예약량으로 확정하지 않는다. Window 초기 확보량과 Offer/ARM의 실제 원문 확정 후 필요한 추가 확보량, 원 native Tx의 N 실제 전환을 각각 어느 기존 행/함수/잠금이 소유하는지 표로 제시한다. 불변 plan을 보존하면서 부모가 허용한 수치 summary 전이만으로 닫히는지, 불가능하다면 정확히 어떤 채택 조항끼리 충돌하는지 반환한다. 새 schema/plan 의미를 임의 추가하지 않는다.

이 검산 중에도 독립된 profile 보호·digest·유한 ticket/phase guard·기존 collector 접합의 구현은 계속한다. 현재 작성 중 공백은 완료나 정식 실패로 세지 않는다. 실제 DB/권한/키/서비스/Agent/컴파일 실행은 계속 0이다.

## 4. 계상 담당의 독립 읽기 지원

담당 remaining_execution_dependencies는 3절의 단계별 예약 문제만 독립 검토한다. 부모 계상 문서 3·5·11·13절, wire의 예약 접점, 채택 WI에서 Window 최초 생성 당시의 불변 plan과 원 command 확정 이후 N 예약의 관계를 대조한다. 실제 작성 중 코드를 결함으로 확정하거나 수정하지 않는다. 기존 공개 원형·일곱 표·plan 불변성을 바꾸지 않고 허용된 수치 전이만으로 닫을 수 있는지 문서 근거를 반환한다. 불가능하면 충돌 조항과 최소 결정 사항을 구분한다. Primary의 표 제출과 합쳐 Main이 판정한다. 반복 전수검사·시험 재실행·문서/제품 쓰기·실환경 실행은 0이다.

## 5. S4 current의 profile/TLS 대응 읽기 지원

담당 remaining_stage_b_dependencies는 2절에서 확인한 기존 native Bearer current GET을 새 최초 수신의 보호 closure에서 소비할 때 필요한 정확 대응만 읽기 조사한다. 기존 native HTTPS driver의 profile 목적·origin·path/prefix·CA/hostname·authority profileRef/metadata와 채택 first-receive Profile/Head 원형을 비교한다. 같은 등록/설치의 서로 다른 profile 목적을 cast하거나 caller URL을 허용하지 않고 기존 API를 소비할 수 있는지, 정확 필드와 생산자 근거를 반환한다. 가능하면 허용 파일 내 최소 조립 위치를 제시하고, 불가능하면 새 계약이 필요한 실제 차이만 보고한다. 이전 HUMAN/slot 공급선 조사 자체를 반복하지 않으며 작성 중 새 client의 부재를 결함으로 세지 않는다. 쓰기·시험·네트워크·실파일/키 조사·실환경 실행은 0이다.

## 6. S4 profile/TLS 대조 반환

기존 channel은 identity.channelProfileRef와 source CA/expiry를 묶는다(native-preparation-client.ts:6, native-preparation-https.ts:38/48). 새 Profile은 목적 NATIVE_CHANNEL_PROFILE, nativePrefix /api/v1/native-first-receive, caPem/caSha256/serverName 및 보호 HEAD/anchor를 가진다. 같은 등록/설치만으로 두 ref가 같다는 근거는 없다.

기존 current 주소는 native-preparation-https.ts:67의 고정 /api/v1/connector/native-preparations/{authorityId}/current이며 서버 project-native-preparations.ts:88/91은 hostSource origin host와 authority.channelProfileRef 일치를 검산한다. 보호 NativePreparationCurrentSource mapping의 binding.channelProfileRef가 current→authority/hostSource로 연결되는 실제 원 producer는 존재한다. 새 PROFILE/HEAD와 그 mapping의 대응은 아직 증명되지 않았다.

S4에서는 실제 보호 producer가 정한 원 channel ref/원 CA 및 새 수신 profile의 관계를 명시적으로 검산해야 한다. 새 profile의 CA나 ref를 원 native 것으로 cast하지 않는다. 기존 HTTPS의 hostname/CA/rejectUnauthorized/agent:false를 유지하고 caller URL·범용 path를 열지 않는다. 정확 대응이 없으면 공급 포트/현재 조립의 실제 차이를 반환하며 새로운 공개 권위를 임의로 만들지 않는다. 이는 작성 중 코드의 확정 결함이나 새 endpoint 추가 지시가 아니다.
