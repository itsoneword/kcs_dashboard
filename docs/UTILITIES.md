# Backend Utilities

This document describes the utility scripts available for managing users and troubleshooting authentication issues.

## User Management Utilities

### Check User Information

Use this utility to inspect user data in the database:

```bash
# List all users
npm run check-user

# Check specific user by email (case-insensitive)
npm run check-user user@company.com
```

**Output includes:**
- User ID, email, name
- Role information (admin, lead, coach)
- Whether user has a password set
- Creation and update timestamps
- Deletion status (if soft-deleted)

### Reset User Password

Use this utility to manually reset a user's password:

```bash
# Reset password for a user
npm run reset-password user@company.com newpassword123
```

**Requirements:**
- Email must exist in database
- Password must be at least 6 characters
- Email lookup is case-insensitive

## Case-Insensitive Email Support

The authentication system now supports case-insensitive email login:

- **Frontend**: Automatically converts email input to lowercase
- **Backend**: Uses `LOWER()` SQL function for email comparisons
- **Registration**: Stores emails in lowercase format
- **Login**: Accepts any case variation of registered email

### Examples

If a user registers with `John.Doe@Company.COM`, they can login with any of:
- `john.doe@company.com`
- `John.Doe@Company.COM`
- `JOHN.DOE@COMPANY.COM`
- `John.doe@company.com`

## Troubleshooting Login Issues

1. **Check if user exists:**
   ```bash
   npm run check-user user@company.com
   ```

2. **Verify user has password:**
   Look for `Has Password: Yes` in the output

3. **Reset password if needed:**
   ```bash
   npm run reset-password user@company.com newpassword123
   ```

4. **Check for case sensitivity issues:**
   The system now handles this automatically, but you can verify by checking the exact email stored in the database

## Database Schema Notes

- Emails are stored in lowercase format
- Password hashes use bcrypt with salt rounds = 12
- Email comparisons use `LOWER(email) = ?` for case-insensitivity
- Soft deletion is supported via `deleted_at` column 