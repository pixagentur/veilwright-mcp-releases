import type { LicenseTier } from '../licensing/LicenseTier.js';
import type { User } from './User.js';
import type { UserRepository } from './UserRepository.js';
/**
 * In-process UserRepository for tests/local dev — see
 * InMemorySiteRepository for why SqliteUserRepository, not Postgres,
 * is the production default.
 */
export declare class InMemoryUserRepository implements UserRepository {
    private readonly users;
    create(user: User): Promise<void>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    updateTier(id: string, tier: LicenseTier): Promise<void>;
}
