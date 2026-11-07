/** 같은 화면 인스턴스의 변경만 직렬 진입시킨다. 서버의 버전·중복 명령 검사를 대체하지 않는다. */
export function createDraftMutationGate() {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(work: () => Promise<unknown>): Promise<void> {
      if (busy) return;
      busy = true;
      try { await work(); } finally { busy = false; }
    },
  };
}
