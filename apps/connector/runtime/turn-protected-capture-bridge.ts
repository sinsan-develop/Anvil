import {SyntheticStartProtectedCaptureBridge} from './start-protected-capture-bridge.ts';
import type {SyntheticInstructionResponseBarrier} from '../adapters/primary/instruction-transport.ts';
/** Explicit TURN-only source adapter. Shares bounded capture mechanics without
 * changing the existing THREAD default. Parent verification, immutable prepare
 * and metadata receipts remain claims, not actual native/Agent authority. */
export class SyntheticTurnProtectedCaptureBridge extends SyntheticStartProtectedCaptureBridge implements SyntheticInstructionResponseBarrier{
 constructor(ports:ConstructorParameters<typeof SyntheticStartProtectedCaptureBridge>[0],options:Omit<ConstructorParameters<typeof SyntheticStartProtectedCaptureBridge>[1],'captureKind'>){
  super(ports,{...options,captureKind:'TURN'});
 }
}
