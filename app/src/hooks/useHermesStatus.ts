import { useEffect, useState } from 'react';
import { assistantApi } from '@/api/assistant';
import type { HermesMode, HermesProvider, HermesSupports } from '@/types/hermes';

const HERMES_STATUS_CACHE_KEY = 'insightease_hermes_status_cache';
const HERMES_STATUS_TTL_MS = 5 * 60 * 1000;

export interface HermesStatusState {
  status: 'unknown' | 'disabled' | 'dry_run' | 'live' | 'unavailable';
  enabled: boolean;
  mode?: HermesMode;
  provider?: HermesProvider;
  supports?: HermesSupports;
  message?: string;
  checked_at?: string;
  error?: string;
}

const INITIAL_STATUS: HermesStatusState = {
  status: 'unknown',
  enabled: false,
};

function readCachedStatus(): HermesStatusState | null {
  try {
    const raw = sessionStorage.getItem(HERMES_STATUS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<HermesStatusState>;
    if (!parsed.checked_at || typeof parsed.checked_at !== 'string') return null;
    const checkedAt = new Date(parsed.checked_at).getTime();
    if (Number.isNaN(checkedAt) || Date.now() - checkedAt > HERMES_STATUS_TTL_MS) {
      return null;
    }

    if (
      parsed.status !== 'disabled' &&
      parsed.status !== 'dry_run' &&
      parsed.status !== 'live' &&
      parsed.status !== 'unavailable'
    ) {
      return null;
    }

    return {
      status: parsed.status,
      enabled: Boolean(parsed.enabled),
      mode: parsed.mode,
      provider: parsed.provider,
      supports: parsed.supports,
      message: parsed.message,
      checked_at: parsed.checked_at,
      error: parsed.error,
    };
  } catch {
    return null;
  }
}

function writeCachedStatus(status: HermesStatusState): void {
  try {
    sessionStorage.setItem(HERMES_STATUS_CACHE_KEY, JSON.stringify(status));
  } catch {
    // Diagnostic cache only; ignore storage failures.
  }
}

function normalizeStatusResponse(response: Awaited<ReturnType<typeof assistantApi.getHermesStatus>>): HermesStatusState {
  const data = response.data.data;
  const checkedAt = new Date().toISOString();

  if (!data.enabled) {
    return {
      status: 'disabled',
      enabled: false,
      mode: data.mode,
      provider: data.provider,
      supports: data.supports,
      message: data.message,
      checked_at: checkedAt,
    };
  }

  return {
    status: data.mode === 'live' ? 'live' : data.mode === 'dry_run' ? 'dry_run' : 'disabled',
    enabled: data.enabled,
    mode: data.mode,
    provider: data.provider,
    supports: data.supports,
    message: data.message,
    checked_at: checkedAt,
  };
}

async function fetchHermesStatus(): Promise<HermesStatusState> {
  try {
    const response = await assistantApi.getHermesStatus();
    const status = normalizeStatusResponse(response);
    writeCachedStatus(status);
    return status;
  } catch (error) {
    const status: HermesStatusState = {
      status: 'unavailable',
      enabled: false,
      checked_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Hermes status unavailable',
    };
    writeCachedStatus(status);
    return status;
  }
}

export function useHermesStatus(shouldProbe: boolean): HermesStatusState {
  const [status, setStatus] = useState<HermesStatusState>(() => readCachedStatus() ?? INITIAL_STATUS);

  useEffect(() => {
    if (!shouldProbe) return;

    const cached = readCachedStatus();
    if (cached) {
      setStatus(cached);
      return;
    }

    let cancelled = false;
    void fetchHermesStatus().then((nextStatus) => {
      if (!cancelled) {
        setStatus(nextStatus);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldProbe]);

  return status;
}
