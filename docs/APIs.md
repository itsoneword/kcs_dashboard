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
| `/api/engineers` | GET | All Authenticated | List all active engineers | `src/routes/engineers/+page.svelte` |
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

#### Notes

1. Engineer Status:
   - Engineers use an `is_active` flag (0 or 1) to indicate their status
   - All list endpoints return only active engineers by default (`is_active = 1`)
   - Unlike users which use `deleted_at` for soft deletion, engineers are managed through the active flag

2. Coach Assignments:
   - Active assignments are indicated by `is_active = 1`
   - When ending an assignment, it's marked as inactive rather than being deleted

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

| Endpoint | Method | Access | Description | Frontend Usage | Status |
|----------|--------|--------|-------------|----------------|--------|
| `/api/reports/batch-stats` | GET | All Authenticated | Get all report data in a single call (recommended) | `src/routes/reports/+page.svelte` | Active |
| `/api/reports/stats` | GET | All Authenticated | Generate evaluation statistics | `src/routes/reports/+page.svelte` | Deprecated |
| `/api/reports/my-team` | GET | Admin/Lead | Get stats for current user's team | `src/routes/reports/+page.svelte` | Deprecated |
| `/api/reports/engineer/:id` | GET | All Authenticated | Get stats for specific engineer | `src/routes/reports/+page.svelte` | Deprecated |
| `/api/reports/quarterly` | GET | All Authenticated | Get quarterly comparison report | `src/routes/reports/+page.svelte` | Deprecated |
| `/api/reports/monthly` | GET | All Authenticated | Get monthly stats for specified filters | `src/routes/reports/+page.svelte` | Deprecated |
| `/api/reports/evaluations` | GET | All Authenticated | Get evaluations for specific filters | `src/routes/reports/+page.svelte` | Active |
| `/api/reports/engineers` | GET | All Authenticated | Get engineers for filtering based on role | `src/routes/reports/+page.svelte` | Active |
| `/api/reports/batch` | POST | All Authenticated | Get all report data in a single call (alternative) | `src/routes/reports/+page.svelte` | Active |

#### `/api/reports/batch-stats` Parameters

Query Parameters:
- `year` (number): Year for the report (e.g., 2024)
- `quarter` (string, optional): Quarter filter (Q1, Q2, Q3, Q4)
- `engineer_ids` (string): Comma-separated list of engineer IDs (e.g., "21,22,23")
- `start_date` (string, optional): Start date in ISO format
- `end_date` (string, optional): End date in ISO format

Response includes:
- `overall_stats`: Combined statistics for all selected engineers
- `quarterly_stats`: Statistics broken down by quarter
- `individual_stats`: Individual statistics for each engineer
- `monthly_data`: Monthly breakdown for each engineer

#### Rate Limiting

The reports API has a dedicated rate limiter:
- 2000 requests per minute per IP
- More lenient than the general API rate limit (1000 requests per 30 seconds)

#### Notes

1. The `/api/reports/batch-stats` endpoint is the recommended way to fetch report data as it:
   - Reduces the number of API calls needed
   - Uses comma-separated engineer IDs for better URL compatibility
   - Returns all necessary data in a single response

2. The following endpoints are deprecated and will be removed in future versions:
   - `/api/reports/stats`
   - `/api/reports/my-team`
   - `/api/reports/engineer/:id`
   - `/api/reports/quarterly`
   - `/api/reports/monthly`

3. For large reports, consider using pagination or limiting the number of engineers to prevent timeouts.

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
