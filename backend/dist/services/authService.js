"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importStar(require("../database/database"));
const logger_1 = __importStar(require("../utils/logger"));
class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    }
    // Mock authentication - will be replaced with MS SSO
    async login(credentials) {
        try {
            const { email, password } = credentials;
            // Normalize email to lowercase for case-insensitive comparison
            const normalizedEmail = email.toLowerCase().trim();
            // Use retry logic for database operations
            const user = database_1.default.executeWithRetry(() => {
                const stmt = database_1.db.prepare('SELECT * FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL');
                return stmt.get(normalizedEmail);
            });
            if (!user) {
                logger_1.default.warn(`Login attempt with invalid email: ${email}`);
                throw new Error('Invalid credentials');
            }
            // Verify password (for mock auth)
            if (user.password_hash) {
                const isValidPassword = await bcryptjs_1.default.compare(password, user.password_hash);
                if (!isValidPassword) {
                    logger_1.default.warn(`Login attempt with invalid password for email: ${email}`);
                    throw new Error('Invalid credentials');
                }
            }
            // Generate JWT token
            const token = this.generateToken(user);
            // Log successful login with retry logic
            database_1.default.executeWithRetry(() => {
                logger_1.logUserAction.login(user.id, user.email);
            });
            // Remove password hash from response
            const { password_hash, ...userWithoutPassword } = user;
            logger_1.default.info(`Successful login for user: ${email}`);
            return {
                user: userWithoutPassword,
                token
            };
        }
        catch (error) {
            logger_1.default.error('Login failed:', error);
            throw error;
        }
    }
    // Register new user (mock auth)
    async register(userData) {
        try {
            const { email, password, name, role } = userData;
            // Normalize email to lowercase for consistency
            const normalizedEmail = email.toLowerCase().trim();
            // Use retry logic for database operations
            const result = database_1.default.executeWithRetry(() => {
                // Check if user already exists (case-insensitive)
                const existingUser = database_1.db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL').get(normalizedEmail);
                if (existingUser) {
                    throw new Error('User already exists');
                }
                // Hash password
                const passwordHash = bcryptjs_1.default.hashSync(password, 12);
                // Check if this is the first user (make them admin)
                const userCount = database_1.db.prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get();
                const isFirstUser = userCount.count === 0;
                // Set role flags based on the role parameter
                let is_coach = 0;
                let is_lead = 0;
                let is_manager = 0;
                let is_admin = 0;
                // First user is always admin regardless of selected role
                if (isFirstUser) {
                    is_admin = 1;
                }
                // Set appropriate role flag based on selected role
                if (role === 'coach') {
                    is_coach = 1;
                }
                else if (role === 'lead') {
                    is_lead = 1;
                }
                else if (role === 'manager') {
                    is_manager = 1;
                }
                // Insert new user
                const insertStmt = database_1.db.prepare(`
                    INSERT INTO users (email, password_hash, name, is_admin, is_coach, is_lead, is_manager)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                const insertResult = insertStmt.run(normalizedEmail, passwordHash, name, is_admin, is_coach, is_lead, is_manager);
                // Get the created user
                const newUser = database_1.db.prepare('SELECT * FROM users WHERE id = ?').get(insertResult.lastInsertRowid);
                return newUser;
            });
            // Generate token
            const token = this.generateToken(result);
            // Log user creation with role information
            logger_1.default.info(`New user registered: ${normalizedEmail} with role ${role || 'undefined'} | Flags: is_admin=${result.is_admin}, is_coach=${result.is_coach}, is_lead=${result.is_lead}, is_manager=${result.is_manager}`);
            // Remove password hash from response
            const { password_hash, ...userWithoutPassword } = result;
            return {
                user: userWithoutPassword,
                token
            };
        }
        catch (error) {
            logger_1.default.error('Registration failed:', error);
            throw error;
        }
    }
    // Verify JWT token
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            // Get fresh user data from database with retry logic
            const user = database_1.default.executeWithRetry(() => {
                const stmt = database_1.db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL');
                return stmt.get(decoded.userId);
            });
            if (!user) {
                throw new Error('User not found');
            }
            // Remove password hash
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }
    // Generate JWT token
    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            roles: {
                isAdmin: user.is_admin,
                isLead: user.is_lead,
                isCoach: user.is_coach
            }
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }
    // Get user by ID
    getUserById(id) {
        try {
            const user = database_1.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
            if (!user)
                return null;
            // Remove password hash
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        catch (error) {
            logger_1.default.error('Failed to get user by ID:', error);
            return null;
        }
    }
    // Update user roles (admin only)
    async updateUserRoles(adminId, targetUserId, roles) {
        try {
            // Get current user data for logging
            const currentUser = database_1.db.prepare('SELECT is_coach, is_lead, is_admin, is_manager FROM users WHERE id = ?').get(targetUserId);
            // Prevent admin from removing their own admin permissions
            if (adminId === targetUserId && roles.is_admin === false) {
                throw new Error('Cannot remove your own admin permissions');
            }
            // Build update query dynamically
            const updates = [];
            const values = [];
            if (roles.is_coach !== undefined) {
                updates.push('is_coach = ?');
                values.push(roles.is_coach ? 1 : 0);
            }
            if (roles.is_lead !== undefined) {
                updates.push('is_lead = ?');
                values.push(roles.is_lead ? 1 : 0);
            }
            if (roles.is_admin !== undefined) {
                updates.push('is_admin = ?');
                values.push(roles.is_admin ? 1 : 0);
            }
            if (roles.is_manager !== undefined) {
                updates.push('is_manager = ?');
                values.push(roles.is_manager ? 1 : 0);
            }
            if (updates.length === 0) {
                throw new Error('No role updates provided');
            }
            values.push(targetUserId);
            const updateStmt = database_1.db.prepare(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = ?
      `);
            updateStmt.run(...values);
            // Get updated user
            const updatedUser = this.getUserById(targetUserId);
            if (!updatedUser) {
                throw new Error('User not found after update');
            }
            // Log role change
            logger_1.logUserAction.roleChange(adminId, targetUserId, currentUser, roles);
            return updatedUser;
        }
        catch (error) {
            logger_1.default.error('Failed to update user roles:', error);
            throw error;
        }
    }
    // Get all users (admin only) - excludes soft deleted users
    getAllUsers() {
        try {
            const users = database_1.db.prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
            // Remove password hashes
            return users.map(user => {
                const { password_hash, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });
        }
        catch (error) {
            logger_1.default.error('Failed to get all users:', error);
            throw error;
        }
    }
    // Soft delete user (admin only)
    async deleteUser(adminId, targetUserId) {
        try {
            // Prevent admin from deleting themselves
            if (adminId === targetUserId) {
                throw new Error('Cannot delete your own account');
            }
            // Check if user exists and is not already deleted
            const user = database_1.db.prepare('SELECT id, name, email, deleted_at FROM users WHERE id = ?').get(targetUserId);
            if (!user) {
                throw new Error('User not found');
            }
            if (user.deleted_at) {
                throw new Error('User is already deleted');
            }
            // Soft delete the user
            const deleteStmt = database_1.db.prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
            deleteStmt.run(targetUserId);
            // Log user deletion
            logger_1.default.info(`User soft deleted by admin ${adminId}: ${user.email} (ID: ${targetUserId})`);
        }
        catch (error) {
            logger_1.default.error('Failed to delete user:', error);
            throw error;
        }
    }
}
exports.AuthService = AuthService;
exports.default = new AuthService();
//# sourceMappingURL=authService.js.map