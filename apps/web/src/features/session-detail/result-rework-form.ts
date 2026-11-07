import {ordered} from '../knowledge/review-view.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';

export interface ResultReworkFormDraft{selected:string[];files:string[];bindingId:string;reason:string}
export interface ResultReworkFormStore{drafts:Record<string,ResultReworkFormDraft|null>;onChange:(key:string,change:(current:ResultReworkFormDraft|null)=>ResultReworkFormDraft)=>void}
export function resultReworkFormKey(scope:{userId:string;clientId:string;projectId:string;assignmentRef:PlanRef;resultRef:PlanRef;reviewRef:PlanRef}):string{return ordered(scope);}
