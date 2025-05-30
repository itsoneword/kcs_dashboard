import bcrypt from 'bcryptjs';
import { db } from '../database/database';

interface ResetPasswordOptions {
    email: string;
    newPassword: string;
}

export async function resetUserPassword(options: ResetPasswordOptions): Promise<boolean> {
    try {
        const { email, newPassword } = options;

        // Normalize email to lowercase for case-insensitive lookup
        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists
        const user = db.prepare('SELECT id, email FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL').get(normalizedEmail) as { id: number; email: string } | undefined;

        if (!user) {
            console.error(`User with email ${email} not found`);
            return false;
        }

        // Hash the new password
        const passwordHash = bcrypt.hashSync(newPassword, 12);

        // Update the password using the actual email from database
        const updateStmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const result = updateStmt.run(passwordHash, user.id);

        if (result.changes > 0) {
            console.log(`Password successfully updated for user: ${email}`);
            return true;
        } else {
            console.error(`Failed to update password for user: ${email}`);
            return false;
        }

    } catch (error) {
        console.error('Error resetting password:', error);
        return false;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.log('Usage: npm run reset-password <email> <new-password>');
        console.log('Example: npm run reset-password user@company.com newpassword123');
        process.exit(1);
    }

    const [email, newPassword] = args;

    if (newPassword.length < 6) {
        console.error('Password must be at least 6 characters long');
        process.exit(1);
    }

    resetUserPassword({ email, newPassword })
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
} 