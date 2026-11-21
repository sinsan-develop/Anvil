import schema from './common/refs.schema.json' with { type: 'json' };
import { Ajv } from 'ajv';
import type { VersionRef } from './generated-types.ts';

const validate = new Ajv({ strict: true, allErrors: false }).compile(schema);
export function isVersionRef(value: unknown): value is VersionRef { return validate(value) === true; }
