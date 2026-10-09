import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { loadDaemonConfig } from 'file:///C:/Projetos/marc/src/daemon/config.ts';
import { createDaemonServer } from 'file:///C:/Projetos/marc/src/daemon/server.ts';

const originalClose = http.Server.prototype.close;
const originalInterval = globalThis.setInterval;
let active;
http.Server.prototype.close = function (...args) {
  active?.events.push({ event: 'server.close called', ms: +(performance.now() - active.start).toFixed(2), listening: this.listening, caller: new Error().stack?.split('\n').find((line) => line.includes('leases.ts'))?.trim() });
  return originalClose.apply(this, args);
};
globalThis.setInterval = function (callback, delay, ...args) {
  return originalInterval.call(this, (...callbackArgs) => {
    active?.events.push({ event: 'idle interval', delay, ms: +(performance.now() - active.start).toFixed(2) });
    callback(...callbackArgs);
  }, delay, ...args);
};

async function trial(delayMs, autoIdleMs) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marc-idle-diagnostic-'));
  active = { start: performance.now(), delayMs, autoIdleMs, events: [] };
  const record = (event, extra = {}) => active.events.push({ event, ms: +(performance.now() - active.start).toFixed(2), ...extra });
  const config = await loadDaemonConfig({ dataDir, token: 'diagnostic-only', port: 0, mode: 'detached', autoIdleMs });
  const server = await createDaemonServer(config);
  record('create resolved');
  server.on('request', () => record('HTTP request received'));
  const closed = new Promise((resolve) => server.once('close', () => { record('close event'); resolve(); }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  record('listen resolved', { port });
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  record('fetch start');
  try {
    const pending = fetch(`http://127.0.0.1:${port}/api/status`, { headers: { authorization: 'Bearer diagnostic-only' } });
    record('fetch call returned');
    const response = await pending;
    record('fetch success', { status: response.status });
    await response.text();
    active.result = 'success';
  } catch (error) {
    active.result = 'failure';
    record('fetch failure', { message: error.message, cause: error.cause?.code ?? error.cause?.message });
  }
  await closed;
  console.log(JSON.stringify(active));
  active = undefined;
}

for (const delayMs of [0, 0, 0, 35, 35, 35]) await trial(delayMs, 20);
for (const delayMs of [35, 35, 35]) await trial(delayMs, 200);
console.log(JSON.stringify({ note: 'Harness imports only daemon config/server. The static source graph is checked separately; moduleLoadList is not an ESM import inventory.' }));

