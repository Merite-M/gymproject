/**
 * GymPartner Resilient API Client
 * Provides timeout handling, safe idempotency-aware retries, user-friendly error mapping,
 * and offline detection across all frontend API service calls.
 */

export class APIError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_IDEMPOTENT_RETRIES = 2;

// User-friendly error message dictionary
const ERROR_CODE_MESSAGES: Record<string, string> = {
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again in a few minutes.',
  CHECKIN_RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait a moment before trying again.',
  AUTH_MISSING_HEADER: 'Authentication is required. Please log in.',
  AUTH_INVALID_TOKEN: 'Your session has expired. Please log in again.',
  AUTH_SERVICE_UNAVAILABLE: 'Authentication service is temporarily unavailable.',
  NETWORK_OFFLINE: 'You are currently offline. Please check your internet connection.',
  TIMEOUT: 'The server took too long to respond. Please try again.',
};

export async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = ['GET', 'HEAD', 'OPTIONS'].includes(method);

  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    // By default, only retry idempotent read operations (GET/HEAD).
    // Mutating write operations (POST/PUT/PATCH/DELETE) default to 0 retries to prevent duplicate financial or state transactions.
    retries = isIdempotent ? DEFAULT_IDEMPOTENT_RETRIES : 0,
    retryDelayMs = 800,
    ...fetchOptions
  } = options;

  if (typeof window !== 'undefined' && !navigator.onLine) {
    throw new APIError(
      ERROR_CODE_MESSAGES.NETWORK_OFFLINE,
      0,
      'NETWORK_OFFLINE'
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        method,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorPayload: any = {};
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorPayload = await response.json();
          } else {
            errorPayload = { error: await response.text() };
          }
        } catch {
          errorPayload = { error: response.statusText };
        }

        const rawMsg = errorPayload.error || errorPayload.message || `Request failed with status ${response.status}`;
        const code = errorPayload.code;
        const friendlyMessage = (code && ERROR_CODE_MESSAGES[code]) || rawMsg;

        // Only retry transient gateway errors (502, 503, 504) if the method is idempotent and retries remain
        if (
          isIdempotent &&
          (response.status === 502 || response.status === 503 || response.status === 504) &&
          attempt < retries
        ) {
          console.warn(`[apiFetch] Server error ${response.status} on ${method} ${url}, retrying attempt ${attempt + 1}/${retries}...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
          continue;
        }

        throw new APIError(friendlyMessage, response.status, code, errorPayload.details);
      }

      // Check if response has content
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (err: any) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        lastError = new APIError(
          ERROR_CODE_MESSAGES.TIMEOUT,
          408,
          'TIMEOUT'
        );
        // Never retry timeouts on non-idempotent operations, as the server may still be processing the write
        if (!isIdempotent) {
          throw lastError;
        }
      } else if (err instanceof APIError) {
        lastError = err;
        // Never retry client errors (4xx)
        if (err.status >= 400 && err.status < 500) {
          throw err;
        }
        // Non-idempotent requests should not retry on server errors
        if (!isIdempotent) {
          throw err;
        }
      } else {
        lastError = new APIError(
          err.message || 'Network connection error occurred',
          0,
          'NETWORK_ERROR'
        );
        // Non-idempotent operations should not retry blindly on network drops after dispatch
        if (!isIdempotent) {
          throw lastError;
        }
      }

      // If we have retries left for transient idempotent errors, wait and retry
      if (isIdempotent && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new APIError('Request failed after retries', 500);
}
