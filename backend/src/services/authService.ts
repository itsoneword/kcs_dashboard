import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import databaseManager from '../database/database';
import type { User, LoginRequest, CreateUserRequest } from '../types';
import logger, { logUserAction } from '../utils/logger';

export class AuthService {
    private jwtSecret: string;
    private jwtExpiresIn: string;

    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    }

    // Mock authentication - will be replaced with MS SSO
    async login(credentials: LoginRequest): Promise<{ user: User; token: string }> {
        try {
            const { email, password } = credentials;

            // Normalize email to lowercase for case-insensitive comparison
            const normalizedEmail = email.toLowerCase().trim();

            // Use retry logic for database operations
            const user = databaseManager.executeWithRetry(() => {
                const stmt = databaseManager.getDatabase().prepare('SELECT * FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL');
                return stmt.get(normalizedEmail) as User | undefined;
            });

            if (!user) {
                logger.warn(`Login attempt with invalid email: ${email}`);
                throw new Error('Invalid credentials');
            }

            // Verify password (for mock auth)
            if (user.password_hash) {
                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                if (!isValidPassword) {
                    logger.warn(`Login attempt with invalid password for email: ${email}`);
                    throw new Error('Invalid credentials');
                }
            }

            // Generate JWT token
            const token = this.generateToken(user);

            // Log successful login with retry logic
            databaseManager.executeWithRetry(() => {
                logUserAction.login(user.id, user.email);
            });

            // Remove password hash from response
            const { password_hash, ...userWithoutPassword } = user as any;

            logger.info(`Successful login for user: ${email}`);

            return {
                user: userWithoutPassword,
                token
            };

        } catch (error) {
            logger.error('Login failed:', error);
            throw error;
        }
    }

    // Register new user (mock auth)
    async register(userData: CreateUserRequest): Promise<{ user: User; token: string }> {
        try {
            const { email, password, name, role } = userData;

            // Normalize email to lowercase for consistency
            const normalizedEmail = email.toLowerCase().trim();

            // Use retry logic for database operations
            const result = databaseManager.executeWithRetry(() => {
                // Check if user already exists (case-insensitive)
                const existingUser = databaseManager.getDatabase().prepare('SELECT id FROM users WHERE LOWER(email) = ? AND deleted_at IS NULL').get(normalizedEmail);
                if (existingUser) {
                    throw new Error('User already exists');
                }

                // Hash password
                const passwordHash = bcrypt.hashSync(password, 12);

                // Check if this is the first user (make them admin)
                const userCount = databaseManager.getDatabase().prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get() as { count: number };
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
                } else if (role === 'lead') {
                    is_lead = 1;
                } else if (role === 'manager') {
                    is_manager = 1;
                }

                // Insert new user
                const insertStmt = databaseManager.getDatabase().prepare(`
                    INSERT INTO users (email, password_hash, name, is_admin, is_coach, is_lead, is_manager)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                const insertResult = insertStmt.run(normalizedEmail, passwordHash, name, is_admin, is_coach, is_lead, is_manager);

                // Get the created user
                const newUser = databaseManager.getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(insertResult.lastInsertRowid) as User;

                return newUser;
            });

            // Generate token
            const token = this.generateToken(result);

            // Log user creation with role information
            logger.info(`New user registered: ${normalizedEmail} with role ${role || 'undefined'} | Flags: is_admin=${result.is_admin}, is_coach=${result.is_coach}, is_lead=${result.is_lead}, is_manager=${result.is_manager}`);

            // Remove password hash from response
            const { password_hash, ...userWithoutPassword } = result as any;

            return {
                user: userWithoutPassword,
                token
            };

        } catch (error) {
            logger.error('Registration failed:', error);
            throw error;
        }
    }

    // Verify JWT token
    verifyToken(token: string): User {
        try {
            const decoded = jwt.verify(token, this.jwtSecret) as any;

            // Get fresh user data from database with retry logic
            const user = databaseManager.executeWithRetry(() => {
                const stmt = databaseManager.getDatabase().prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL');
                return stmt.get(decoded.userId) as User | undefined;
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Remove password hash
            const { password_hash, ...userWithoutPassword } = user as any;
            return userWithoutPassword;

        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    // Generate JWT token
    private generateToken(user: User): string {
        const payload = {
            userId: user.id,
            email: user.email,
            roles: {
                isAdmin: user.is_admin,
                isLead: user.is_lead,
                isCoach: user.is_coach
            }
        };

        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as jwt.SignOptions);
    }

    // Get user by ID
    getUserById(id: number): User | null {
        try {
            const user = databaseManager.getDatabase().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
            if (!user) return null;

            // Remove password hash
            const { password_hash, ...userWithoutPassword } = user as any;
            return userWithoutPassword;
        } catch (error) {
            logger.error('Failed to get user by ID:', error);
            return null;
        }
    }

    // Update user roles (admin only)
    async updateUserRoles(adminId: number, targetUserId: number, roles: { is_coach?: boolean; is_lead?: boolean; is_admin?: boolean; is_manager?: boolean }): Promise<User> {
        try {
            // Get current user data for logging
            const currentUser = databaseManager.getDatabase().prepare('SELECT is_coach, is_lead, is_admin, is_manager FROM users WHERE id = ?').get(targetUserId);

            // Prevent admin from removing their own admin permissions
            if (adminId === targetUserId && roles.is_admin === false) {
                throw new Error('Cannot remove your own admin permissions');
            }

            // Build update query dynamically
            const updates: string[] = [];
            const values: any[] = [];

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

            const updateStmt = databaseManager.getDatabase().prepare(`
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
            logUserAction.roleChange(adminId, targetUserId, currentUser, roles);

            return updatedUser;

        } catch (error) {
            logger.error('Failed to update user roles:', error);
            throw error;
        }
    }

    // Get all users (admin only) - excludes soft deleted users
    getAllUsers(): User[] {
        try {
            const users = databaseManager.getDatabase().prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as User[];

            // Remove password hashes
            return users.map(user => {
                const { password_hash, ...userWithoutPassword } = user as any;
                return userWithoutPassword;
            });

        } catch (error) {
            logger.error('Failed to get all users:', error);
            throw error;
        }
    }

    // Soft delete user (admin only)
    async deleteUser(adminId: number, targetUserId: number): Promise<void> {
        try {
            // Prevent admin from deleting themselves
            if (adminId === targetUserId) {
                throw new Error('Cannot delete your own account');
            }

            // Check if user exists and is not already deleted
            const user = databaseManager.getDatabase().prepare('SELECT id, name, email, deleted_at FROM users WHERE id = ?').get(targetUserId) as any;
            if (!user) {
                throw new Error('User not found');
            }
            if (user.deleted_at) {
                throw new Error('User is already deleted');
            }

            // Soft delete the user
            const deleteStmt = databaseManager.getDatabase().prepare('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?');
            deleteStmt.run(targetUserId);

            // Log user deletion
            logger.info(`User soft deleted by admin ${adminId}: ${user.email} (ID: ${targetUserId})`);

        } catch (error) {
            logger.error('Failed to delete user:', error);
            throw error;
        }
    }
}

export default new AuthService(); 