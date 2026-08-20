export type CircuitState = 'closed' | 'open' | 'half-open';
/**
 * Per-site circuit breaker: after enough consecutive failures, stop
 * attempting requests for resetTimeoutMs so an unreachable site
 * can't be hammered. A single trial request is allowed once the
 * timeout elapses (half-open); success closes the circuit, failure
 * re-opens it. Pure — clock is injectable for testing.
 */
export declare class CircuitBreaker {
    private readonly failureThreshold;
    private readonly resetTimeoutMs;
    private readonly now;
    private state;
    private failureCount;
    private openedAt;
    constructor(failureThreshold?: number, resetTimeoutMs?: number, now?: () => number);
    canAttempt(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getState(): CircuitState;
}
