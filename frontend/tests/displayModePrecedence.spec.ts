import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LS_DISPLAY_MODE_KEY,
  resolveDisplayMode
} from '../../libs/copilot/src/resolveDisplayMode';

describe('resolveDisplayMode – config vs localStorage precedence', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explicit config wins over localStorage', () => {
    localStorage.setItem(LS_DISPLAY_MODE_KEY, 'floating');
    expect(resolveDisplayMode('sidebar')).toBe('sidebar');
  });

  it('falls back to localStorage when config omits displayMode', () => {
    localStorage.setItem(LS_DISPLAY_MODE_KEY, 'sidebar');
    expect(resolveDisplayMode(undefined)).toBe('sidebar');
  });

  it('defaults to floating when neither config nor localStorage is set', () => {
    expect(resolveDisplayMode(undefined)).toBe('floating');
  });
});
