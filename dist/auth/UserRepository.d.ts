import type { LicenseTier } from '../licensing/LicenseTier.js';
import type { User } from './User.js';
export interface UserRepository {
    create(user: User): Promise<void>;
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    updateTier(id: string, tier: LicenseTier): Promise<void>;
}
