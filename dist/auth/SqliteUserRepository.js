function toUser(row) {
    return { id: row.id, email: row.email, passwordHash: row.password_hash, tier: row.tier, createdAt: row.created_at };
}
/** SQLite-backed UserRepository — see SqliteSiteRepository's docblock. */
export class SqliteUserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(user) {
        this.db
            .prepare('INSERT INTO users (id, email, password_hash, tier, created_at) VALUES (@id, @email, @passwordHash, @tier, @createdAt)')
            .run({ id: user.id, email: user.email, passwordHash: user.passwordHash, tier: user.tier, createdAt: user.createdAt });
    }
    async findById(id) {
        const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        return row ? toUser(row) : null;
    }
    async findByEmail(email) {
        const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        return row ? toUser(row) : null;
    }
    async updateTier(id, tier) {
        this.db.prepare('UPDATE users SET tier = ? WHERE id = ?').run(tier, id);
    }
}
//# sourceMappingURL=SqliteUserRepository.js.map