import { randomUUID } from 'node:crypto';
import { ValidationError } from '../support/errors.js';
const MIN_PASSWORD_LENGTH = 10;
/**
 * Registration + login for veilwright.one accounts — used by the
 * website's signup form and by the OIDC provider's login interaction
 * (src/auth/oidcProvider.ts). Pure port-based logic (UserRepository,
 * PasswordHasher are both interfaces), fully unit-testable without a
 * real database or a real bcrypt run.
 */
export class UserAccountService {
    users;
    hasher;
    constructor(users, hasher) {
        this.users = users;
        this.hasher = hasher;
    }
    async register(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail.includes('@') || normalizedEmail.length < 3) {
            throw new ValidationError('A valid email is required.');
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        if (await this.users.findByEmail(normalizedEmail)) {
            throw new ValidationError('An account with this email already exists.');
        }
        const user = {
            id: randomUUID(),
            email: normalizedEmail,
            passwordHash: await this.hasher.hash(password),
            tier: 'free',
            createdAt: new Date().toISOString(),
        };
        await this.users.create(user);
        return user;
    }
    async verifyCredentials(email, password) {
        const user = await this.users.findByEmail(email.trim().toLowerCase());
        if (user === null) {
            return null;
        }
        return (await this.hasher.verify(password, user.passwordHash)) ? user : null;
    }
}
//# sourceMappingURL=UserAccountService.js.map