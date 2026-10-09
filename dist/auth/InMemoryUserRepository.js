/**
 * In-process UserRepository for tests/local dev — see
 * InMemorySiteRepository for why SqliteUserRepository, not Postgres,
 * is the production default.
 */
export class InMemoryUserRepository {
    users = new Map();
    async create(user) {
        this.users.set(user.id, { ...user });
    }
    async findById(id) {
        return this.users.get(id) ?? null;
    }
    async findByEmail(email) {
        return [...this.users.values()].find((user) => user.email === email) ?? null;
    }
    async updateTier(id, tier) {
        const existing = this.users.get(id);
        if (existing) {
            this.users.set(id, { ...existing, tier });
        }
    }
}
//# sourceMappingURL=InMemoryUserRepository.js.map