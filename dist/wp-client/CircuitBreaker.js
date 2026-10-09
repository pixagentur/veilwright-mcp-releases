/**
 * Per-site circuit breaker: after enough consecutive failures, stop
 * attempting requests for resetTimeoutMs so an unreachable site
 * can't be hammered. A single trial request is allowed once the
 * timeout elapses (half-open); success closes the circuit, failure
 * re-opens it. Pure — clock is injectable for testing.
 */
export class CircuitBreaker {
    failureThreshold;
    resetTimeoutMs;
    now;
    state = 'closed';
    failureCount = 0;
    openedAt = 0;
    constructor(failureThreshold = 5, resetTimeoutMs = 30_000, now = () => Date.now()) {
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
        this.now = now;
    }
    canAttempt() {
        if (this.state === 'closed') {
            return true;
        }
        if (this.state === 'open' && this.now() - this.openedAt >= this.resetTimeoutMs) {
            this.state = 'half-open';
            return true;
        }
        return this.state === 'half-open';
    }
    recordSuccess() {
        this.state = 'closed';
        this.failureCount = 0;
    }
    recordFailure() {
        this.failureCount += 1;
        if (this.state === 'half-open' || this.failureCount >= this.failureThreshold) {
            this.state = 'open';
            this.openedAt = this.now();
        }
    }
    getState() {
        return this.state;
    }
}
//# sourceMappingURL=CircuitBreaker.js.map