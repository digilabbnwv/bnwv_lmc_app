import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { INACTIVITEIT_MS, useInactiviteit } from './useInactiviteit';

describe('useInactiviteit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('staat standaard op 30 minuten', () => {
    expect(INACTIVITEIT_MS).toBe(30 * 60 * 1000);
  });

  it('logt uit na de ingestelde tijd zonder activiteit', () => {
    const verlopen = vi.fn();
    renderHook(() => {
      useInactiviteit(true, verlopen, 1000);
    });
    vi.advanceTimersByTime(999);
    expect(verlopen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(verlopen).toHaveBeenCalledTimes(1);
  });

  it('activiteit start de tijd opnieuw', () => {
    const verlopen = vi.fn();
    renderHook(() => {
      useInactiviteit(true, verlopen, 1000);
    });
    vi.advanceTimersByTime(800);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(800);
    expect(verlopen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(verlopen).toHaveBeenCalledTimes(1);
  });

  it('doet niets als er niemand is ingelogd', () => {
    const verlopen = vi.fn();
    renderHook(() => {
      useInactiviteit(false, verlopen, 1000);
    });
    vi.advanceTimersByTime(5000);
    expect(verlopen).not.toHaveBeenCalled();
  });
});
