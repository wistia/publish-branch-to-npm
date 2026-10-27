import { error, setFailed } from '@actions/core';
import { expect, it, describe, vi } from 'vitest';

vi.mock(import('@actions/core'), () => ({
  error: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock(import('./helpers.mjs'), () => ({
  publishNpmPackage: vi.fn().mockRejectedValue(new Error('npm publish failed')),
}));

describe('index', () => {
  it('reports a failure once, with its message', async () => {
    // the entry point runs as soon as it is imported
    await import('../index.mjs');

    expect(setFailed).toHaveBeenCalledExactlyOnceWith('npm publish failed');
    expect(error).not.toHaveBeenCalled();
  });
});
