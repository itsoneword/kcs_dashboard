"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUser = checkUser;
exports.listAllUsers = listAllUsers;
const database_1 = require("../database/database");
function checkUser(email) {
    try {
        // Normalize email to lowercase for case-insensitive lookup
        const normalizedEmail = email.toLowerCase().trim();
        const user = database_1.databaseManager.getDatabase().prepare(`
            SELECT 
                id, 
                email, 
                name, 
                is_admin, 
                is_lead, 
                is_coach, 
                created_at, 
                updated_at, 
                deleted_at,
                CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END as has_password
            FROM users 
            WHERE LOWER(email) = ?
        `).get(normalizedEmail);
        return user;
    }
    catch (error) {
        console.error('Error checking user:', error);
        return null;
    }
}
function listAllUsers() {
    try {
        const users = database_1.databaseManager.getDatabase().prepare(`
            SELECT 
                id, 
                email, 
                name, 
                is_admin, 
                is_lead, 
                is_coach, 
                created_at, 
                updated_at, 
                deleted_at,
                CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 1 ELSE 0 END as has_password
            FROM users 
            ORDER BY created_at DESC
        `).all();
        return users;
    }
    catch (error) {
        console.error('Error listing users:', error);
        return [];
    }
}
// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('All users:');
        console.log('==========');
        const users = listAllUsers();
        if (users.length === 0) {
            console.log('No users found');
        }
        else {
            users.forEach(user => {
                console.log(`ID: ${user.id}`);
                console.log(`Email: ${user.email}`);
                console.log(`Name: ${user.name}`);
                console.log(`Has Password: ${user.has_password ? 'Yes' : 'No'}`);
                console.log(`Admin: ${user.is_admin ? 'Yes' : 'No'}`);
                console.log(`Lead: ${user.is_lead ? 'Yes' : 'No'}`);
                console.log(`Coach: ${user.is_coach ? 'Yes' : 'No'}`);
                console.log(`Created: ${user.created_at}`);
                console.log(`Updated: ${user.updated_at}`);
                if (user.deleted_at) {
                    console.log(`Deleted: ${user.deleted_at}`);
                }
                console.log('---');
            });
        }
    }
    else if (args.length === 1) {
        const email = args[0];
        console.log(`Checking user: ${email}`);
        console.log('=================');
        const user = checkUser(email);
        if (!user) {
            console.log('User not found');
        }
        else {
            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Name: ${user.name}`);
            console.log(`Has Password: ${user.has_password ? 'Yes' : 'No'}`);
            console.log(`Admin: ${user.is_admin ? 'Yes' : 'No'}`);
            console.log(`Lead: ${user.is_lead ? 'Yes' : 'No'}`);
            console.log(`Coach: ${user.is_coach ? 'Yes' : 'No'}`);
            console.log(`Created: ${user.created_at}`);
            console.log(`Updated: ${user.updated_at}`);
            if (user.deleted_at) {
                console.log(`Deleted: ${user.deleted_at}`);
            }
        }
    }
    else {
        console.log('Usage:');
        console.log('  npm run check-user                    # List all users');
        console.log('  npm run check-user <email>            # Check specific user');
        console.log('Example: npm run check-user user@company.com');
    }
}
//# sourceMappingURL=checkUser.js.map