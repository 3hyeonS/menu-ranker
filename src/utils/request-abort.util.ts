import { AsyncLocalStorage } from 'async_hooks';

const requestAbortStorage = new AsyncLocalStorage<AbortSignal>();

export function runWithRequestAbortSignal<T>(
  signal: AbortSignal,
  callback: () => T,
): T {
  return requestAbortStorage.run(signal, callback);
}

export function getRequestAbortSignal(): AbortSignal | undefined {
  return requestAbortStorage.getStore();
}

export function throwIfRequestAborted(): void {
  getRequestAbortSignal()?.throwIfAborted();
}

export function isRequestCancellationError(error: unknown): boolean {
  const candidate = error as { name?: string; code?: string } | null;

  return (
    getRequestAbortSignal()?.aborted === true ||
    candidate?.name === 'AbortError' ||
    candidate?.name === 'CanceledError' ||
    candidate?.code === 'ABORT_ERR' ||
    candidate?.code === 'ERR_CANCELED'
  );
}
