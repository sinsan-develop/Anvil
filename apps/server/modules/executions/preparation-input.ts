import { readExecutionIntentV1, type ExecutionIntentV1 } from '../../../../contracts/runtime/execution-intent-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';

export const executionPreparationOperations = ['prepareExecution'] as const;
export function readExecutionPreparationInput(value: unknown): ExecutionIntentV1 {
  let input: ExecutionIntentV1;
  try { input=readExecutionIntentV1(value); } catch { throw new AuthFailure('EXECUTION_INTENT_INVALID',422); }
  try { assertKnowledgeTextSafe(input.reason); } catch { throw new AuthFailure('EXECUTION_PREPARATION_SENSITIVE_CONTENT',412); }
  return input;
}
