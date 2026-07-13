const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Retries fn with exponential backoff, stopping early for non-retryable errors. */
export async function withRetry(fn, options) {
    const sleep = options.sleep ?? defaultSleep;
    let lastError;
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === options.attempts || !options.isRetryable(error)) {
                throw error;
            }
            await sleep(options.baseDelayMs * 2 ** (attempt - 1));
        }
    }
    throw lastError;
}
//# sourceMappingURL=retry.js.map