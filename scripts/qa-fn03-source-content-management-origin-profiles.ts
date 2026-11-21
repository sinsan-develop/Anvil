/** 승인·runtime 신원을 발급하지 않는 두 고정 QA 조립의 내부 상수. 호출자는 profile을 전달하지 않는다. */
export const managementOriginProfile=Object.freeze({
 sourcePrefix:'anvil-fn03-management-',intentPurpose:'FN03_MANAGEMENT_ORIGIN_INTENT',
 integrated:false,purpose:'FN03_MANAGEMENT_ORIGIN_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_ENTRY_V1',
 artifactPrefix:'anvil-v3-fn03-management-',receiptPrefix:'fn03-management-',resourcePrefix:'anvil_v3_fn03_management_',owner:'FN03_MANAGEMENT_ORIGIN',
} as const);
export const managementOriginTc01Profile=Object.freeze({
 sourcePrefix:'anvil-fn03-tc01-',intentPurpose:'FN03_MANAGEMENT_ORIGIN_TC01_INTENT',
 integrated:true,purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1',
 artifactPrefix:'fn03-tc01-',receiptPrefix:'fn03-tc01-',resourcePrefix:'anvil_v3_fn03_tc01_',owner:'FN03_MANAGEMENT_ORIGIN_TC01',
} as const);
export type ManagementOriginProfile=typeof managementOriginProfile|typeof managementOriginTc01Profile;
