import bcrypt from 'bcryptjs';
/**
 * Thin wrapper around bcryptjs (pure JS, no native compile step —
 * one less thing that can fail on a fresh VPS) so call sites depend
 * on this interface, not the library directly.
 */
export class PasswordHasher {
    rounds;
    constructor(rounds = 12) {
        this.rounds = rounds;
    }
    async hash(plaintext) {
        return bcrypt.hash(plaintext, this.rounds);
    }
    async verify(plaintext, hash) {
        return bcrypt.compare(plaintext, hash);
    }
}
//# sourceMappingURL=PasswordHasher.js.map