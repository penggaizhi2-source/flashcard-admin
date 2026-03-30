import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudBaseConfigError, getCloudBaseServerConfig } from '../../lib/cloudbase-server.ts';

const ORIGINAL_ENV = {
  TCB_ENV_ID: process.env.TCB_ENV_ID,
  TCB_SECRET_ID: process.env.TCB_SECRET_ID,
  TCB_SECRET_KEY: process.env.TCB_SECRET_KEY,
};

function restoreUploadEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === 'string') {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

test('cloudbase server config throws a typed error when required env vars are missing', (t) => {
  t.after(restoreUploadEnv);

  delete process.env.TCB_ENV_ID;
  delete process.env.TCB_SECRET_ID;
  delete process.env.TCB_SECRET_KEY;

  assert.throws(
    () => getCloudBaseServerConfig(),
    (error: unknown) => {
      assert.ok(error instanceof CloudBaseConfigError);
      assert.deepEqual(error.missingKeys, ['TCB_ENV_ID', 'TCB_SECRET_ID', 'TCB_SECRET_KEY']);
      return true;
    }
  );
});

test('cloudbase server config returns normalized values when env vars are present', (t) => {
  t.after(restoreUploadEnv);

  process.env.TCB_ENV_ID = ' cloudbase-env ';
  process.env.TCB_SECRET_ID = ' secret-id ';
  process.env.TCB_SECRET_KEY = ' secret-key ';

  assert.deepEqual(getCloudBaseServerConfig(), {
    envId: 'cloudbase-env',
    secretId: 'secret-id',
    secretKey: 'secret-key',
  });
});
