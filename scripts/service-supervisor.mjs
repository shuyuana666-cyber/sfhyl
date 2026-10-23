// Recover one development service without taking down its peers.
export async function superviseService({ start, isStopping, wait, onRestart, isRunning, now = Date.now }) {
  let failures = 0;
  while (!isStopping()) {
    // An existing server belongs to its original launcher. Reuse it until its
    // listener disappears, then start a replacement owned by this launcher.
    if (isRunning && await isRunning()) {
      await wait(2_000);
      continue;
    }
    if (isStopping()) break;
    const started = now();
    const result = await start();
    if (isStopping()) break;
    failures = now() - started >= 60_000 ? 1 : failures + 1;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(failures - 1, 5));
    onRestart(result, delay);
    await wait(delay);
  }
}
