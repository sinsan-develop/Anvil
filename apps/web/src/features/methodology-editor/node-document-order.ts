import {ApiError} from '../../api/client.ts';
import type {MethodologyNode} from '../../../../../contracts/methodologies.ts';
/** 초안의 문서 표시·저장 배열만 이동한다. 항목 참조·실행 의미는 변경하지 않는다. */
export function moveNodeDocument(node:MethodologyNode,side:'inputs'|'outputs',index:number,direction:number):MethodologyNode{
 if(!['inputs','outputs'].includes(side)||!Number.isSafeInteger(index)||index<0||index>=node[side].length||(direction!==-1&&direction!==1))throw new ApiError('METHOD_DOCUMENT_MOVE_INVALID');
 const to=index+direction;if(to<0||to>=node[side].length)return node;
 const items=[...node[side]];[items[index],items[to]]=[items[to]!,items[index]!];return{...node,[side]:items};
}
