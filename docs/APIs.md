
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
