# KCS Performance Tracking System - Software Architecture (Revised)

## System Overview
A web-based performance tracking system for Knowledge-Centered Service (KCS) evaluation, replacing individual Excel sheets with a centralized solution. Features Microsoft SSO authentication and lightweight SQLite backend.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Svelte)      │◄──►│   (Node.js/     │◄──►│   (SQLite)      │
│                 │    │    Express)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                        │
          └────────────────────────┼─────────────────────────────┐
                                   │                             │
                            ┌─────────────────┐                 │
                            │   Azure AD      │                 │
                            │   (MS SSO)      │◄────────────────┘
                            └─────────────────┘
```

## Technology Stack

### Frontend
- **Svelte/SvelteKit** with TypeScript
- **Tailwind CSS** for styling
- **Microsoft Authentication Library (MSAL)** for SSO
- **Axios** for API calls
- **Chart.js** for statistics visualization

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **better-sqlite3** for database operations
- **Microsoft Graph API** for user verification
- **JWT** for session management
- **CORS** middleware

### Database
- **SQLite** with better-sqlite3
- **No caching needed** - direct SQL queries are fast enough

## Database Schema (Revised)

### Core Tables

```sql
-- Users table (from MS domain) - only people who login to system
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ms_user_id TEXT UNIQUE NOT NULL,  -- Microsoft user ID
    name TEXT NOT NULL,
    is_coach BOOLEAN DEFAULT FALSE,
    is_lead BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,   -- system admin role
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Engineers (workers) - separate entities, no user accounts needed
CREATE TABLE engineers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lead_user_id INTEGER REFERENCES users(id), -- who is their lead
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Coach assignments (many-to-many: coaches can have multiple engineers, engineers can have multiple coaches over time)
CREATE TABLE engineer_coach_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER REFERENCES engineers(id),
    coach_user_id INTEGER REFERENCES users(id),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(engineer_id, coach_user_id, start_date)
);

-- Monthly evaluations (one per engineer per month) - simplified date storage
CREATE TABLE evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engineer_id INTEGER REFERENCES engineers(id),
    coach_user_id INTEGER REFERENCES users(id),
    evaluation_date DATE NOT NULL,  -- YYYY-MM-DD format, quarter calculated in UI
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id), -- track who last modified
    UNIQUE(engineer_id, evaluation_date)
);

-- Individual case evaluations (8 per evaluation typically)
CREATE TABLE case_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER REFERENCES evaluations(id),
    case_number INTEGER NOT NULL, -- 1-8 (or more)
    case_id TEXT, -- actual case ID if available
    kb_potential BOOLEAN DEFAULT FALSE,
    article_linked BOOLEAN DEFAULT FALSE,
    article_improved BOOLEAN DEFAULT FALSE,
    improvement_opportunity BOOLEAN DEFAULT FALSE,
    article_created BOOLEAN DEFAULT FALSE,
    create_opportunity BOOLEAN DEFAULT FALSE,
    relevant_link BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluation_id, case_number)
);

-- Indexes for performance
CREATE INDEX idx_evaluations_engineer_date ON evaluations(engineer_id, evaluation_date);
CREATE INDEX idx_case_evaluations_evaluation ON case_evaluations(evaluation_id);
CREATE INDEX idx_assignments_active ON engineer_coach_assignments(is_active, engineer_id);
```

## Authentication Flow

### Microsoft SSO Integration

```typescript
// Frontend: MSAL configuration
const msalConfig = {
    auth: {
        clientId: "your-azure-app-id",
        authority: "https://login.microsoftonline.com/your-tenant-id",
        redirectUri: window.location.origin
    }
};

// Login flow
1. User clicks "Sign in with Microsoft"
2. Redirected to Azure AD
3. User authenticates with company credentials
4. Returns with access token
5. Frontend sends token to backend
6. Backend verifies with Microsoft Graph API
7. Backend creates/updates user record
8. Returns session JWT
```

### Backend Authentication Middleware

```typescript
// Verify Microsoft token and get user info
async function verifyMicrosoftUser(accessToken: string) {
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data; // Contains user info
}
```

## API Endpoints (Updated)

### Authentication
```typescript
POST   /api/auth/microsoft         // Verify MS token, create/update user
POST   /api/auth/logout           // Clear session
GET    /api/auth/me               // Get current user info
```

### Core Endpoints
```typescript
// Users & Setup
GET    /api/users                 // List all users (for admin setup)
PUT    /api/users/:id/roles       // Update user roles (coach/lead/worker)

// Engineers
GET    /api/engineers             // List engineers (filtered by lead if needed)
POST   /api/engineers             // Create engineer
PUT    /api/engineers/:id         // Update engineer
GET    /api/engineers/my-team     // Get engineers for current user (if lead)

// Coach Assignments
GET    /api/assignments/my-engineers    // Engineers assigned to current coach
POST   /api/assignments               // Create assignment (leads only)
PUT    /api/assignments/:id           // Update assignment

// Evaluations
GET    /api/evaluations/my-evaluations // Evaluations for current coach
POST   /api/evaluations               // Create new evaluation
PUT    /api/evaluations/:id           // Update evaluation
GET    /api/evaluations/:id/cases     // Get cases for specific evaluation
PUT    /api/evaluations/:id/cases     // Update cases for evaluation

// Reports & Statistics (role-based access)
GET    /api/reports/my-team           // Stats for current user's team
GET    /api/reports/engineer/:id     // Individual engineer stats
GET    /api/reports/quarterly        // Quarterly summary
```

## Frontend Architecture (Svelte)

### Project Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── forms/          # Evaluation forms
│   │   ├── dashboard/      # Dashboard components
│   │   └── common/         # Reusable UI components
│   ├── stores/             # Svelte stores for state management
│   ├── services/           # API service functions
│   └── utils/              # Utility functions
├── routes/
│   ├── +layout.svelte      # Main layout with auth check
│   ├── +page.svelte        # Home/dashboard
│   ├── coach/              # Coach-specific routes
│   ├── lead/               # Lead-specific routes
│   └── engineer/           # Engineer view routes
└── app.html
```

### Key Features by Role

#### Coach Interface
- Dashboard showing assigned engineers
- Monthly evaluation forms (8 cases per engineer, extandable)
- Historical evaluation data
- Quick statistics overview

#### Lead Interface  
- Team overview dashboard
- Individual engineer performance tracking
- Coach assignments view
- Quarterly reports and comparisons


## Data Flow Example

### Coach Creating Evaluation
```
1. Coach logs in via MS SSO
2. System shows their assigned engineers with possibility to add 
3. Coach selects engineer + month 
4. System creates evaluation record (linked to coach_user_id)
5. Coach fills 8 case(or more if needed) evaluation forms
6. System calculates metrics in real-time
7. Entered data being saved in real time after entering and might be modified by coach
8. Lead can immediately see updated stats
```
Evaluation criteria and workflow:
Coach pick one random case from CRM and enter its number into valuation form.
KB Potential - whether case should have article or not. If false - none other fields are required
Article Linked - if the article linked, being used for calculation link rate.
Relevant Link - if the linked article correct. being used for link accuracy rate
 Article Improved - being used for calculation contribution index. only active if next is true
 Improvement Opportunity - activates Article Improved param
 Article Created - being used for calculation contribution index. only active if next is true
 Create Opportunity - activates article created point
 
   + a note possibility to leave coache's note

## Deployment Strategy

### Development
- **Frontend**: SvelteKit dev server (localhost:5173)
- **Backend**: Express server (localhost:3000)
- **Database**: Local SQLite file
- **Auth**: Azure AD test app

### Production
- **Frontend**: Vercel/Netlify (static build)
- **Backend**: Railway/Render (with SQLite file)
- **Auth**: Production Azure AD app registration (MS SSO)
- **Database**: SQLite file on server (with backups)

## Security Considerations

### Authentication & Authorization
- Microsoft SSO handles authentication
- Role-based access control in API
- JWT tokens for session management
- HTTPS only in production

### Data Protection
- Input validation on all forms
- SQL injection prevention (parameterized queries)
- Rate limiting on API endpoints
- Regular SQLite backups

## Implementation Phases

### Phase 1: Core System (4-5 weeks)
- Microsoft SSO integration
- User/role management (first created user considered to be admin)
- Basic evaluation forms
- Coach and lead dashboards
- SQLite database setup

### Phase 2: Enhanced Features (2-3 weeks)
- Possibility to add engineers and cases for evaluation
- Advanced filtering and search
- Export functionality (Excel/PDF)
- Historical trend visualization
- Performance optimizations

### Phase 3: Polish & Production (1-2 weeks)
- Production deployment
- User training materials
- Data migration from Excel
- Monitoring and backup setup

## Migration Plan

1. **Azure AD Setup**: Register application, configure SSO
2. **User Onboarding**: Import user list, assign roles
3. **Data Migration**: Convert existing Excel data to SQLite
4. **Pilot Testing**: Start with 2-3 coaches
5. **Full Rollout**: Gradual expansion to all coaches
6. **Excel Sunset**: Disable old Excel workflow

This revised architecture addresses all your concerns: proper authentication from day one, clear data relationships, and a lightweight but scalable foundation that can grow with your needs.