export interface RetryOptions {
    attempts: number;
    baseDelayMs: number;
    isRetryable: (error: unknown) => boolean;
    /** Injectable for testing so retry tests don't actually wait. */
    sleep?: (ms: number) => Promise<void>;
}
/** Retries fn with exponential backoff, stopping early for non-retryable errors. */
export declare function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>;
