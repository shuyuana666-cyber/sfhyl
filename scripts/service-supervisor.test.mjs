import assert from 'node:assert/strict';
import test from 'node:test';
import { superviseService } from './service-supervisor.mjs';

test('a stopped service retries with bounded backoff and stops retrying on shutdown', async () => {
  let stopping = false;
  let attempts = 0;
  const delays = [];
  await superviseService({
    start: async () => { attempts += 1; return 1; },
    isStopping: () => stopping,
    wait: async (delay) => { delays.push(delay); if (delays.length === 8) stopping = true; },
    onRestart: () => {},
    now: () => 0,
  });
  assert.equal(attempts, 8);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
});

test('a reused service starts only after its original listener disappears', async () => {
  let stopping = false;
  let running = true;
  let attempts = 0;
  await superviseService({
    isRunning: async () => running,
    isStopping: () => stopping,
    wait: async () => { running = false; },
    start: async () => { attempts += 1; stopping = true; return 0; },
    onRestart: () => assert.fail('Shutdown must not restart'),
  });
  assert.equal(attempts, 1);
});
