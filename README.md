# KCS Performance Tracking Portal

A web-based performance tracking system for Knowledge-Centered Service (KCS) evaluation, replacing individual Excel sheets with a centralized solution. Features comprehensive evaluation management with role-based access control.

## 🚀 Current Implementation Status

### ✅ Fully Implemented Features
- **User Management**: Admin portal with user creation, role assignment, and user maintenance.
- **Evaluation Uploading & Creation**: Ability to upload and manage performance evaluations.
- **Reporting**: Generate customized reports for different roles (admins, managers, coaches, engineers).

### 🔄 Ready for Enhancement
- **Microsoft SSO Integration**: Architecture ready for MS SSO replacement
- **Export Functionality**: Excel/PDF export capabilities
- **Performance Optimization**: Caching and advanced filtering
- **Email Notifications**: Evaluation reminders and updates

## 🏗️ Project Structure

```
.
├── docker-compose.yml       # Docker Compose configuration
├── deploy.sh                # Deployment script
├── kcs-portal/              # Application source code
│   ├── backend/             # Node.js/Express API Server
│   ├── frontend/            # SvelteKit Application
│   ├── database/            # SQLite database files
│   ├── logs/                # Application logs
│   └── docs/                # Documentation
├── package.json             # Root project metadata and scripts
└── README.md                # Project documentation
```

## 📡 API Endpoints
Backend route handlers live in `backend/src/routes`, and frontend API calls are located in `frontend/src/routes`.

## 🔐 Access Control Implementation

### Framework & Architecture
- **Backend**: JWT-based authentication with Express middleware
- **Frontend**: Svelte stores with reactive authentication state
- **Database**: Role-based permissions stored in users table

### Role-Based Permissions

#### User Roles (stored in `users` table)
- **is_admin**: Full system access, user management
- **is_manager**: Manager role with broad access except cannot create new admins or delete users
- **is_lead**: Team management, engineer assignments  
- **is_coach**: Create and manage evaluations
- **Default**: Basic authenticated access
- **accounts_list**: current implementations also supports seeding accounts from accounts_list.md file in root dir. File format is: 

    coaches:
...
   leads:
...

#### Access Control Matrix
| Feature | Admin | Manager | Lead | Coach | User |
|---------|-------|---------|------|-------|------|
| View Evaluations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Evaluations | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit Evaluations | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete Evaluations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Engineers | ✅ | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| View All Data | ✅ | ✅ | ✅ | ✅ | ✅ |

### Middleware Implementation
```typescript
// Backend: JWT Authentication Middleware (src/middleware/auth.ts)
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Frontend: Auth Guard (src/routes/+layout.svelte)
$: if (!$authStore.isAuthenticated && browser) {
    goto('/auth/login');
}
```

## 📋 Logging & Monitoring

### Comprehensive Logging System
- **Winston Logger**: Structured logging with multiple transports
- **Daily Rotation**: Automatic log file rotation
- **Multiple Log Levels**: Error, warn, info, debug

### Audit Trail
All user actions are logged with:
- User ID and email
- Action performed
- Timestamp
- IP address
- Request details

### Log Files
```
logs/
├── backend-YYYY-MM-DD.log       # General application logs
├── backend-error-YYYY-MM-DD.log # Error-specific logs  
└── backend-audit-YYYY-MM-DD.log # User action audit trail
```

## 🚀 Development Workflow

### Docker Setup
1. Build and run all services:
   ```bash
   docker-compose up --build -d
   ```
2. Access services:
   - backend: http://localhost:3000
   - frontend: http://localhost:4173

### Local Development (without Docker)
1. Start backend:
   ```bash
   cd kcs-portal/backend
   npm install
   npm run dev
   ```
2. Start frontend:
   ```bash
   cd kcs-portal/frontend
   npm install
   npm run dev
   ```

### First Time Setup
1. Navigate to `http://localhost:4173` and register first user (automatically becomes admin).
2. Use Admin console to create users and assign roles.
3. Add engineers and start creating evaluations.

## 🔄 Future Enhancements Ready

### Microsoft SSO Integration
The system is architected to easily replace mock authentication:
- JWT infrastructure remains the same
- User interface unchanged
- Automatic user provisioning from MS domain

### Planned Features
- **Advanced Reporting**: Performance analytics and trends
- **Export Functionality**: Excel/PDF report generation
- **Email Notifications**: Evaluation reminders and updates
- **Performance Optimization**: Caching and database indexing

## 🐛 Troubleshooting

### Common Issues
1. **Database Lock**: Restart backend if SQLite database is locked
2. **CORS Errors**: Verify FRONTEND_URL in backend .env file
3. **Authentication Issues**: Clear localStorage and re-login
4. **Port Conflicts**: Change PORT in backend .env if 3000 is occupied

### Debug Mode
Set `LOG_LEVEL=debug` in backend .env for detailed logging.

## 📞 Developer Support

### Key Files for Maintenance
- **Authentication Logic**: `backend/src/routes/auth.ts`
- **Database Schema**: `backend/src/database/schema.sql`
- **Frontend Auth Store**: `frontend/src/lib/stores/auth.ts`
- **Main Evaluation Interface**: `frontend/src/routes/evaluations/+page.svelte`

### Database Backup
```bash
# Create backup
cp database/kcs_portal.db database/backup-$(date +%Y%m%d).db

# Restore from backup
cp database/backup-YYYYMMDD.db database/kcs_portal.db
```

---

**Built with ❤️ for KCS Performance Tracking** 