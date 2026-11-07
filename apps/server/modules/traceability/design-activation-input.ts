import {AuthFailure} from '../access/repository.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {exactKeys,planText} from './work-plan-card.ts';

export interface DesignActivationInput {
  changeRef:VersionRef;
  impactRef:VersionRef;
  approvedDesignRef:VersionRef;
  confirmedPlanRef:VersionRef;
  reason:string;
}

// approvalRef는 기존 공통 봉투/context의 인자다. payload에 없다고 승인 생략이나 적용 허가를 뜻하지 않는다.
export function readDesignActivationInput(value:unknown):DesignActivationInput {
  if(!exactKeys(value,['changeRef','impactRef','approvedDesignRef','confirmedPlanRef','reason'])
    ||!isVersionRef(value.changeRef)||!isVersionRef(value.impactRef)
    ||!isVersionRef(value.approvedDesignRef)||!isVersionRef(value.confirmedPlanRef)
    ||!planText(value.reason)||!value.reason.trim())throw new AuthFailure('DESIGN_ACTIVATION_INPUT_INVALID',422);
  return structuredClone(value) as DesignActivationInput;
}

export function assertDesignActivationTarget(input:DesignActivationInput,targetId:string|null,expectedVersion:number):void {
  if(targetId!==input.changeRef.id||expectedVersion!==input.changeRef.version)
    throw new AuthFailure('DESIGN_ACTIVATION_INPUT_INVALID',422);
}
