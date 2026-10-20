/** 한정 정책 QA 전용 시간 배분. 실제 원격 query 취소/프로세스 종료를 증명하지는 않는다. */
export function policyQaWorkBudget(until:number,now=Date.now()){const left=until-now-120000;if(!Number.isFinite(left)||left<=1000)throw Error('POLICY_QA_WORK_WINDOW_TOO_SHORT');return Math.min(90000,left);}
export function policyQaCleanupDeadline(now=Date.now()){if(!Number.isFinite(now))throw Error('POLICY_QA_CLOCK_INVALID');return now+60000;}
export function policyQaCallBudget(until:number,now=Date.now()){const left=until-now;if(!Number.isFinite(left)||left<=0)throw Error('POLICY_QA_CALL_EXPIRED');return Math.min(30000,left);}
