/** Inputs remain untrusted until the fixed implementation validates their descriptors and bindings. */
export declare function runTc01DependencyCli(io: unknown): Promise<string | {
  readonly status: 'UNKNOWN';
  readonly code: 'DEPENDENCY_CLI_UNKNOWN';
  readonly authority: 'NOT_ISSUED';
}>;
