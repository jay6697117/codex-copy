import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const projectPath = fileURLToPath(new URL('../', import.meta.url));

async function loadClient(publicSite) {
  const result = await build({
    stdin: {
      contents: `
        export * from './src/services/appServerClient';
        export * from './src/services/runtimeConfig';
        export { INITIAL_THREADS, INITIAL_PROJECTS } from './src/data/initialCodexData';
      `,
      resolveDir: projectPath,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    define: { 'import.meta.env.VITE_PUBLIC_SITE': JSON.stringify(String(publicSite)) },
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('public Site makes no backend requests until consent and stops after revocation', async (t) => {
  const client = await loadClient(true);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    return Response.json({ workspaces: [{ id: 'local', repoPath: '/test/project' }] });
  });

  assert.equal(await client.fetchWorkspaces(), null);
  assert.deepEqual(requests, []);
  assert.equal(client.INITIAL_THREADS.length, 1);
  assert.deepEqual(client.INITIAL_THREADS[0].turns, []);
  assert.equal(client.INITIAL_PROJECTS[0].repoPath, '');

  client.setLocalBridgeAccess(true);
  const response = await client.fetchWorkspaces();
  assert.equal(response.workspaces[0].repoPath, '/test/project');
  assert.deepEqual(requests, ['http://127.0.0.1:4500/api/workspaces']);

  client.setLocalBridgeAccess(false);
  assert.equal(await client.fetchWorkspaces(), null);
  assert.equal(requests.length, 1);
});

test('desktop build retains automatic same-origin service access', async (t) => {
  const client = await loadClient(false);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests.push(String(url));
    return Response.json({ workspaces: [] });
  });

  assert.equal(client.canUseLocalBridge(), true);
  await client.fetchWorkspaces();
  assert.deepEqual(requests, ['/api/workspaces']);
});
