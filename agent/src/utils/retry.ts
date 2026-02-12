import { Logger } from "../logger";

interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  operationName: string;
  logger: Logger;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { attempts, baseDelayMs, operationName, logger } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === attempts) break;

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(
        {
          err,
          operationName,
          attempt,
          attempts,
          retryInMs: delayMs,
        },
        "Operation failed, retrying"
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
