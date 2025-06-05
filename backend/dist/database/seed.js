"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("./database");
function generatePassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
}
function parseAccounts(filePath) {
    const content = fs_1.default.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const sections = { coaches: [], leads: [], managers: [], admins: [] };
    let current = null;
    for (const line of lines) {
        const t = line.trim();
        if (/^coaches:$/i.test(t)) {
            current = 'coaches';
            continue;
        }
        if (/^leads:$/i.test(t)) {
            current = 'leads';
            continue;
        }
        if (/^managers:$/i.test(t)) {
            current = 'managers';
            continue;
        }
        if (/^admins:$/i.test(t)) {
            current = 'admins';
            continue;
        }
        if (!t) {
            current = null;
            continue;
        }
        if (current) {
            const name = t.replace(/\(.*\)/, '').trim();
            sections[current].push(name);
        }
    }
    return sections;
}
function seedUsers() {
    const filePath = path_1.default.resolve(__dirname, '../../../accounts_list.md');
    const sections = parseAccounts(filePath);
    const insert = database_1.db.prepare(`INSERT OR IGNORE INTO users 
      (email, password_hash, name, is_coach, is_lead, is_admin, is_manager) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const check = database_1.db.prepare(`SELECT id FROM users WHERE email = ?`);
    const accounts = [];
    for (const role of ['coaches', 'leads', 'managers', 'admins']) {
        for (const fullName of sections[role]) {
            const parts = fullName.split(/\s+/);
            const first = parts[0].toLowerCase();
            const last = parts[parts.length - 1].toLowerCase();
            const email = `${first}.${last}@veeam.com`;
            const existing = check.get(email);
            if (existing) {
                console.log(`Skipping existing user: ${email}`);
                continue;
            }
            const password = generatePassword(8);
            const hash = bcryptjs_1.default.hashSync(password, 12);
            const is_coach = role === 'coaches' ? 1 : 0;
            const is_lead = role === 'leads' ? 1 : 0;
            const is_manager = role === 'managers' ? 1 : 0;
            const is_admin = role === 'admins' ? 1 : 0;
            insert.run(email, hash, fullName, is_coach, is_lead, is_admin, is_manager);
            accounts.push({ email, password, role });
        }
    }
    console.log('Seeded user accounts:');
    for (const a of accounts) {
        console.log(`${a.email} | ${a.password} | role=${a.role}`);
    }
}
seedUsers();
//# sourceMappingURL=seed.js.map