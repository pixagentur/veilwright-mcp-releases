import type { SqliteDatabase } from '../db/Database.js';
import type { LicenseTier } from '../licensing/LicenseTier.js';
import type { User } from './User.js';
import type { UserRepository } from './UserRepository.js';
/** SQLite-backed UserRepository — see SqliteSiteRepository's docblock. */
export declare class SqliteUserRepository implements UserRepository {
    private readonly db;
    constructor(db: SqliteDatabase);
    create(user: User): Promise<void>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    updateTier(id: string, tier: LicenseTier): Promise<void>;
}
