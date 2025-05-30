# KCS Performance Tracking Portal

A web-based performance tracking system for Knowledge-Centered Service (KCS) evaluation, replacing individual Excel sheets with a centralized solution. Features comprehensive evaluation management with role-based access control.

## 🚀 Current Implementation Status

### ✅ Fully Implemented Features
- **Authentication System**: Mock authentication with JWT tokens
- **User Management**: Complete admin console for role assignment
- **Engineer Management**: Full CRUD operations for engineers
- **Evaluation System**: Complete evaluation creation, editing, and viewing
- **Role-Based Access Control**: Comprehensive permissions system
- **Modern UI**: Responsive design with unified evaluation interface
- **Audit Logging**: Complete action tracking and logging
- **SQLite Database**: Production-ready schema with proper relationships
- **Reporting & Analytics**: Comprehensive statistics and performance tracking
- **Admin Management**: Database administration tools and system monitoring
- **Dashboard Overview**: System statistics and current month tracking

### 🔄 Ready for Enhancement
- **Microsoft SSO Integration**: Architecture ready for MS SSO replacement
- **Export Functionality**: Excel/PDF export capabilities
- **Performance Optimization**: Caching and advanced filtering
- **Email Notifications**: Evaluation reminders and updates

## 🏗️ Project Structure

```
kcs-portal/
├── backend/                    # Node.js/Express API Server
│   ├── src/
│   │   ├── routes/            # API route handlers
│   │   │   ├── auth.ts        # Authentication & user management
│   │   │   ├── engineers.ts   # Engineer CRUD operations
│   │   │   └── evaluations.ts # Evaluation management
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.ts        # JWT authentication middleware
│   │   │   └── logging.ts     # Request logging middleware
│   │   ├── database/          # Database operations
│   │   │   ├── init.ts        # Database initialization
│   │   │   └── schema.sql     # Database schema
│   │   ├── utils/             # Utility functions
│   │   │   └── logger.ts      # Winston logging configuration
│   │   └── server.ts          # Express server setup
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # SvelteKit Application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── stores/        # Svelte stores for state management
│   │   │   │   └── auth.ts    # Authentication store
│   │   │   ├── components/    # Reusable UI components
│   │   │   └── utils/         # Frontend utilities
│   │   ├── routes/            # SvelteKit routes (file-based routing)
│   │   │   ├── +layout.svelte # Main layout with auth guard
│   │   │   ├── +page.svelte   # Landing page
│   │   │   ├── auth/          # Authentication pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── admin/         # Admin console
│   │   │   ├── engineers/     # Engineer management
│   │   │   └── evaluations/   # Evaluation system
│   │   │       ├── +page.svelte      # Evaluations list
│   │   │       └── [id]/+page.svelte # Evaluation details
│   │   ├── app.html           # HTML template
│   │   └── app.css            # Global styles
│   ├── package.json
│   └── svelte.config.js
├── database/                   # SQLite database files
│   └── kcs_portal.db          # Main database file
├── logs/                      # Application logs
│   ├── backend-YYYY-MM-DD.log # General logs
│   ├── backend-error-YYYY-MM-DD.log # Error logs
│   └── backend-audit-YYYY-MM-DD.log # Audit logs
└── docs/                      # Documentation
```

## 📡 API Endpoints & Usage

### Authentication APIs (`/api/auth`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/auth/register` | POST | Public | Register new user | `src/routes/auth/register/+page.svelte` |
| `/api/auth/login` | POST | Public | User login | `src/routes/auth/login/+page.svelte` |
| `/api/auth/logout` | POST | Authenticated | User logout | `src/lib/stores/auth.ts` |
| `/api/auth/me` | GET | Authenticated | Get current user info | `src/routes/+layout.svelte` |
| `/api/auth/users` | GET | Admin/Coach/Lead | List all users | `src/routes/admin/+page.svelte` |
| `/api/auth/users/:id/roles` | PUT | Admin | Update user roles | `src/routes/admin/+page.svelte` |
| `/api/auth/users/:id` | DELETE | Admin | Soft delete user | `src/routes/admin/+page.svelte` |

### Engineer Management APIs (`/api/engineers`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/engineers` | GET | All Authenticated | List all engineers | `src/routes/engineers/+page.svelte` |
| `/api/engineers` | POST | Admin/Lead | Create new engineer | `src/routes/engineers/+page.svelte` |
| `/api/engineers/:id` | GET | All Authenticated | Get engineer by ID | `src/routes/engineers/+page.svelte` |
| `/api/engineers/:id` | PUT | Admin/Lead | Update engineer | `src/routes/engineers/+page.svelte` |
| `/api/engineers/for-evaluation` | GET | All Authenticated | Get engineers for evaluation | `src/routes/evaluations/+page.svelte` |
| `/api/engineers/by-coach/:coachId` | GET | Admin/Coach | Get engineers assigned to coach | `src/routes/reports/+page.svelte` |
| `/api/engineers/by-lead/:leadId` | GET | Admin/Lead | Get engineers assigned to lead | `src/routes/reports/+page.svelte` |
| `/api/engineers/search` | GET | All Authenticated | Search engineers by name | `src/routes/engineers/+page.svelte` |
| `/api/engineers/:id/assignments` | GET | All Authenticated | Get coach assignments for engineer | `src/routes/engineers/+page.svelte` |
| `/api/engineers/assignments` | POST | Admin/Lead | Create coach assignment | `src/routes/engineers/+page.svelte` |
| `/api/engineers/assignments/:id/end` | PUT | Admin/Lead | End coach assignment | `src/routes/engineers/+page.svelte` |

### Evaluation Management APIs (`/api/evaluations`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/evaluations` | GET | All Authenticated | List all evaluations | `src/routes/evaluations/+page.svelte` |
| `/api/evaluations` | POST | Admin/Coach | Create new evaluation | `src/routes/evaluations/+page.svelte` |
| `/api/evaluations/:id` | GET | All Authenticated | Get evaluation details | `src/routes/evaluations/[id]/+page.svelte` |
| `/api/evaluations/:id` | PUT | Admin/Coach | Update evaluation | `src/routes/evaluations/[id]/+page.svelte` |
| `/api/evaluations/:id/cases` | POST | Admin/Coach | Add new case to evaluation | `src/routes/evaluations/[id]/+page.svelte` |
| `/api/evaluations/cases/:caseId` | PUT | Admin/Coach | Update case evaluation | `src/routes/evaluations/[id]/+page.svelte` |
| `/api/evaluations/cases/:caseId` | DELETE | Admin/Coach | Delete case evaluation | `src/routes/evaluations/[id]/+page.svelte` |
| `/api/evaluations/cases/check/:caseId` | GET | Admin/Coach | Check if case ID exists | `src/routes/evaluations/[id]/+page.svelte` |

### Reports & Analytics APIs (`/api/reports`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/reports/stats` | GET | All Authenticated | Generate evaluation statistics | `src/routes/reports/+page.svelte` |
| `/api/reports/my-team` | GET | Admin/Lead | Get stats for current user's team | `src/routes/reports/+page.svelte` |
| `/api/reports/engineer/:id` | GET | All Authenticated | Get stats for specific engineer | `src/routes/reports/+page.svelte` |
| `/api/reports/quarterly` | GET | All Authenticated | Get quarterly comparison report | `src/routes/reports/+page.svelte` |
| `/api/reports/evaluations` | GET | All Authenticated | Get evaluations for specific filters | `src/routes/reports/+page.svelte` |
| `/api/reports/engineers` | GET | All Authenticated | Get engineers for filtering based on role | `src/routes/reports/+page.svelte` |

### Admin Management APIs (`/api/admin`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/admin/database/status` | GET | Admin | Get database status | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/backup` | POST | Admin | Create database backup | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/backups` | GET | Admin | List available backups | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/schema` | GET | Admin | Get current schema information | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/migrations` | GET | Admin | Get available migration files | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/execute-sql` | POST | Admin | Execute SQL command (dangerous) | `src/routes/admin/database/+page.svelte` |
| `/api/admin/database/change-db` | POST | Admin | Change active database file | `src/routes/admin/database/+page.svelte` |

### Dashboard APIs (`/api/dashboard`)

| Endpoint | Method | Access | Description | Frontend Usage |
|----------|--------|--------|-------------|----------------|
| `/api/dashboard/overview` | GET | All Authenticated | Get dashboard overview statistics | `src/routes/dashboard/+page.svelte` |

### Health Check
| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/health` | GET | Public | System health status |

## 🔐 Access Control Implementation

### Framework & Architecture
- **Backend**: JWT-based authentication with Express middleware
- **Frontend**: Svelte stores with reactive authentication state
- **Database**: Role-based permissions stored in users table

### Authentication Flow
```typescript
// 1. User login (frontend)
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
});

// 2. Backend validates and returns JWT
const token = jwt.sign({ userId, email, roles }, JWT_SECRET);

// 3. Frontend stores token and updates auth store
authStore.set({ user, token, isAuthenticated: true });

// 4. All subsequent requests include Authorization header
headers: { Authorization: `Bearer ${token}` }
```

### Role-Based Permissions

#### User Roles (stored in `users` table)
- **is_admin**: Full system access, user management
- **is_lead**: Team management, engineer assignments  
- **is_coach**: Create and manage evaluations
- **Default**: Basic authenticated access

#### Access Control Matrix
| Feature | Admin | Lead | Coach | User |
|---------|-------|------|-------|------|
| View Evaluations | ✅ | ✅ | ✅ | ✅ |
| Create Evaluations | ✅ | ❌ | ✅ | ❌ |
| Edit Evaluations | ✅ | ❌ | ✅ | ❌ |
| Delete Evaluations | ✅ | ❌ | ❌ | ❌ |
| Manage Engineers | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| View All Data | ✅ | ✅ | ✅ | ✅ |

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

## 📊 Database Schema & Relationships

### Core Tables
```sql
-- Users (system accounts with roles)
users (id, email, name, password_hash, is_admin, is_lead, is_coach, created_at)

-- Engineers (workers being evaluated)  
engineers (id, name, lead_user_id, is_active, created_at)

-- Coach assignments (many-to-many)
engineer_coach_assignments (id, engineer_id, coach_user_id, start_date, end_date, is_active)

-- Monthly evaluations
evaluations (id, engineer_id, coach_user_id, evaluation_date, created_by, updated_by, created_at, updated_at)

-- Individual case evaluations (8+ cases per evaluation)
case_evaluations (id, evaluation_id, case_number, case_id, kb_potential, article_linked, 
                 article_improved, improvement_opportunity, article_created, create_opportunity, 
                 relevant_link, notes, created_at)
```

### Key Relationships
- Engineers → Users (lead_user_id): Each engineer has a lead
- Evaluations → Engineers: One-to-many relationship
- Evaluations → Users: Coach who created the evaluation
- Case Evaluations → Evaluations: One-to-many (8+ cases per evaluation)

## 🎯 Frontend Architecture (SvelteKit)

### State Management
- **Auth Store** (`src/lib/stores/auth.ts`): Global authentication state
- **Reactive Updates**: Automatic UI updates on state changes
- **Persistent Sessions**: JWT tokens stored in localStorage

### Routing Strategy
- **File-based Routing**: SvelteKit's automatic route generation
- **Layout Guards**: Authentication checks in `+layout.svelte`
- **Role-based Navigation**: Dynamic menu based on user roles

### Key Components
- **Unified Evaluations Interface**: Single page for all evaluation management
- **Modal-based Forms**: Create/edit operations in modals
- **Real-time Filtering**: Client-side filtering with server-side data
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## 🔧 Configuration & Environment

### Backend Environment Variables
```env
PORT=3000                                    # Server port
NODE_ENV=development                         # Environment mode
DATABASE_PATH=../database/kcs_portal.db     # SQLite database path
JWT_SECRET=your-secret-key                  # JWT signing secret
JWT_EXPIRES_IN=24h                          # Token expiration
LOG_LEVEL=info                              # Logging level
LOG_DIR=../logs                             # Log directory
FRONTEND_URL=http://localhost:5173          # CORS configuration
```

### Frontend Configuration
```javascript
// svelte.config.js
adapter: adapter(),
kit: {
    alias: {
        $lib: 'src/lib'
    }
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

### Local Development Setup
```bash
# Backend
cd kcs-portal/backend
npm install
cp env.example .env
npm run dev          # Starts on localhost:3000

# Frontend  
cd kcs-portal/frontend
npm install
npm run dev          # Starts on localhost:5173
```

### First Time Setup
1. Start both backend and frontend
2. Navigate to `http://localhost:5173`
3. Register first user (automatically becomes admin)
4. Use admin console to create additional users and assign roles
5. Add engineers and start creating evaluations

### Code Quality Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Error Handling**: Comprehensive try-catch blocks
- **Input Validation**: Server-side validation for all inputs

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