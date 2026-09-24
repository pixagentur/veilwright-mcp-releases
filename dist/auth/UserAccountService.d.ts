import type { PasswordHasher } from './PasswordHasher.js';
import type { User } from './User.js';
import type { UserRepository } from './UserRepository.js';
/**
 * Registration + login for veilwright.one accounts — used by the
 * website's signup form and by the OIDC provider's login interaction
 * (src/auth/oidcProvider.ts). Pure port-based logic (UserRepository,
 * PasswordHasher are both interfaces), fully unit-testable without a
 * real database or a real bcrypt run.
 */
export declare class UserAccountService {
    private readonly users;
    private readonly hasher;
    constructor(users: UserRepository, hasher: PasswordHasher);
    register(email: string, password: string): Promise<User>;
    verifyCredentials(email: string, password: string): Promise<User | null>;
}
