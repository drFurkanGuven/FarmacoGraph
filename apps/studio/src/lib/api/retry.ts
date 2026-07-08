import { ApiError } from "./errors";

export const DEFAULT_RETRIES = 2;
export const DEFAULT_RETRY_BASE_MS = 300;

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) return false;
    if (error.status === 408 || error.status === 429) return true;
    return error.status >= 500;
  }
  return error instanceof TypeError;
}

export function getRetryDelay(attempt: number, baseMs = DEFAULT_RETRY_BASE_MS): number {
  return baseMs * (attempt + 1);
}

export function defaultShouldRetry(error: unknown, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  return isRetryableError(error);
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_MS;
  const shouldRetry = options.shouldRetry ?? ((error, attempt) => defaultShouldRetry(error, attempt, retries));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error, attempt)) throw error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, getRetryDelay(attempt, baseDelayMs)));
      }
    }
  }
  throw lastError;
}
