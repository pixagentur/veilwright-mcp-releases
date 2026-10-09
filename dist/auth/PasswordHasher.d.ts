/**
 * Thin wrapper around bcryptjs (pure JS, no native compile step —
 * one less thing that can fail on a fresh VPS) so call sites depend
 * on this interface, not the library directly.
 */
export declare class PasswordHasher {
    private readonly rounds;
    constructor(rounds?: number);
    hash(plaintext: string): Promise<string>;
    verify(plaintext: string, hash: string): Promise<boolean>;
}
