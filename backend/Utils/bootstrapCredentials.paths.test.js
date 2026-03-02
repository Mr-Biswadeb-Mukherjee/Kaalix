import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBootstrapCredentialsFilePath,
  getBootstrapSealFilePath,
  isBootstrapReseedForced,
} from './bootstrapCredentials.utils.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('backend/bootstrapCredentials path and env helpers', () => {
  it('uses default files under the project Logs directory', () => {
    const credentialsPath = getBootstrapCredentialsFilePath();
    const sealPath = getBootstrapSealFilePath();

    expect(credentialsPath).toBe(
      path.join(process.cwd(), 'Logs', 'bootstrap-sa-credentials.json')
    );
    expect(sealPath).toBe(path.join(process.cwd(), 'Logs', '.bootstrap-sa-sealed.json'));
  });

  it('maps legacy backend/Logs paths into root Logs directory', () => {
    vi.stubEnv('SA_BOOTSTRAP_CREDENTIALS_FILE', 'backend/Logs/custom-credentials.json');
    vi.stubEnv('SA_BOOTSTRAP_SEAL_FILE', 'backend/Logs/custom-seal.json');

    expect(getBootstrapCredentialsFilePath()).toBe(
      path.join(process.cwd(), 'Logs', 'custom-credentials.json')
    );
    expect(getBootstrapSealFilePath()).toBe(path.join(process.cwd(), 'Logs', 'custom-seal.json'));
  });

  it('resolves non-legacy configured relative paths from project root', () => {
    vi.stubEnv('SA_BOOTSTRAP_CREDENTIALS_FILE', 'tmp/bootstrap.json');
    vi.stubEnv('SA_BOOTSTRAP_SEAL_FILE', 'tmp/bootstrap-seal.json');

    expect(getBootstrapCredentialsFilePath()).toBe(path.join(process.cwd(), 'tmp', 'bootstrap.json'));
    expect(getBootstrapSealFilePath()).toBe(path.join(process.cwd(), 'tmp', 'bootstrap-seal.json'));
  });

  it('handles SA_BOOTSTRAP_FORCE_RESEED as truthy/falsey text', () => {
    vi.stubEnv('SA_BOOTSTRAP_FORCE_RESEED', '1');
    expect(isBootstrapReseedForced()).toBe(true);

    vi.stubEnv('SA_BOOTSTRAP_FORCE_RESEED', 'false');
    expect(isBootstrapReseedForced()).toBe(false);

    vi.stubEnv('SA_BOOTSTRAP_FORCE_RESEED', 'yes');
    expect(isBootstrapReseedForced()).toBe(true);
  });
});
