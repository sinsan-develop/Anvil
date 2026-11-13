import type { PoolClient } from 'pg';
import { registeredContextReadMatches } from '../executions/normal-start-context-source.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';

/**
 * 맥락 묶음 읽기 접근 판별자(D2 P-A).
 * HUMAN은 기존 회원 확인 경로를 그대로 쓰고, EXECUTION_GRANT는 호출자가 같은 snapshot에서
 * grant 현재성을 이미 검산했다는 모듈 비공개 표식만 확인한다. 표식은 HTTP 입력으로 만들 수 없다.
 */
export interface ExecutionGrantScope { readonly projectId: string; readonly executionId: string; readonly executionGeneration: number; readonly grantRef: VersionRef }
declare const executionGrantBrand: unique symbol;
export type ExecutionGrantRead = Readonly<{ kind: 'EXECUTION_GRANT' } & ExecutionGrantScope> & { readonly [executionGrantBrand]: true };
export type HumanRead = Readonly<{ kind: 'HUMAN'; actor: AuthenticatedIdentity }>;
export type ReadAccess = HumanRead | ExecutionGrantRead;

const denied = () => new AuthFailure('EXECUTION_GRANT_READ_DENIED', 403);

/** 검증된 공급자 snapshot 안에서 살아 있는 원 객체만 인정한다. */
export function isExecutionGrantRead(value: unknown): value is ExecutionGrantRead {
  return registeredContextReadMatches(value);
}

export const humanRead = (actor: AuthenticatedIdentity): HumanRead => ({ kind: 'HUMAN', actor });

/** grant 분기 진입 전 표식과 프로젝트 범위를 확인한다. SQL을 내지 않는다. */
export function assertExecutionGrantRead(access: unknown, projectId: string, db?: PoolClient, ref?: VersionRef): asserts access is ExecutionGrantRead {
  if (!registeredContextReadMatches(access, db, projectId, ref)) throw denied();
}

/**
 * HUMAN → 기존 projectMember(db, actor, projectId, lock) 그대로(같은 함수·SQL).
 * EXECUTION_GRANT → 회원 조회·잠금 없음. 표식과 projectId 일치만 확인한다.
 */
export async function assertReadAccess(db: PoolClient, access: ReadAccess, projectId: string, lock = false): Promise<void> {
  if (isExecutionGrantRead(access)) { assertExecutionGrantRead(access, projectId, db); return; }
  if (!access || typeof access !== 'object' || access.kind !== 'HUMAN') throw denied();
  await projectMember(db, access.actor, projectId, lock);
}

/** 잠금 없는 보관 여부 확인. grant 결박 공급자(P-B) 전용이며 HUMAN 경로는 부르지 않는다. */
export async function projectNotArchived(db: PoolClient, projectId: string): Promise<void> {
  const row = (await db.query('SELECT archived_at FROM anvil.projects WHERE id=$1', [projectId])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  if (row.archived_at !== null && row.archived_at !== undefined) throw new AuthFailure('PROJECT_ARCHIVED', 412);
}

/** grant 분기에서 중첩 reader의 core 메서드를 꺼낸다. 시험 대역 등 core가 없으면 닫힌 쪽으로 끝난다. */
export function grantCore<T extends object, K extends PropertyKey>(reader: T, key: K): K extends keyof T ? NonNullable<T[K]> : never {
  const method = (reader as Record<PropertyKey, unknown>)[key];
  if (typeof method !== 'function') throw new AuthFailure('CONTEXT_SOURCE_READER_NOT_CONNECTED', 412);
  return method.bind(reader) as never;
}
