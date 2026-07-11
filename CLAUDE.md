# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AeroLMS v1.0.1** - Employee Training System (Systém školení zaměstnanců)

A production-ready learning management system featuring employee training modules, assessment capabilities, and comprehensive progress tracking. Built with Next.js 15, React 19, and Microsoft SQL Server.

## 🔐 Role-Based Access Control System

The system implements three user roles with distinct permissions:

### User Roles

- **ALL ROLES** (shared employee features):
  - View personal required trainings (Pozadovano=TRUE) on dashboard `/`
  - See "Moje skoleni" section in sidebar with dynamic training links
  - Take tests with same eligibility rules (first test in-person, max 2 online attempts, retake 1 month before expiration)
  - View training materials, progress, and certificates

- **ADMIN** 👑
  - All shared employee features above
  - Full system access via "Admin Menu" in sidebar
  - Manage trainers and training assignments
  - Create/edit/delete all trainings and tests
  - Access admin dashboard (`/admin/prehled`) and synchronization tools
  - Can manually enter test results for workers
  - View all test variants
  - Example user: `test@test.cz`

- **TRAINER** 👨‍🏫
  - All shared employee features above
  - Management of assigned trainings via "Skolitel Menu" in sidebar
  - Edit assigned trainings (name, description, content)
  - Create and manage tests for assigned trainings (soft delete tests)
  - View training statistics and test results
  - Can override training names from database codes
  - Can manually enter test results for first-time tests
  - View all test variants and activate/deactivate them
  - Manage multiple test variants per training
  - **CANNOT** create new trainings (auto-synced from database)
  - **CANNOT** delete trainings (admin only)
  - **CANNOT** manage unassigned trainings

- **WORKER** 👷
  - All shared employee features above
  - Login: personal code + password (example: code `123456` + password)

### RBAC Implementation - Enterprise-Grade Authorization

**Status**: ✅ Fully Implemented (2025-01-10)

The application implements centralized, enterprise-grade authorization system with audit logging capabilities.

#### Centralized Authorization Module (`src/lib/authorization.ts`)

All authorization logic is centralized in `src/lib/authorization.ts` to ensure consistency, maintainability, and auditability:

```typescript
// Core authorization helpers
getTrainerAssignedTrainingIds(trainerId: number): Promise<number[]>
isTrainerAssignedToTraining(trainerId: number, trainingId: number): Promise<boolean>
authorizeTrainingAccess(userId: number, userRole: string, trainingId?: number)
getTrainingsForUser(userId: number, userRole: string, options?)
validateTrainingAccess(session: any, trainingId?: number)  // Middleware-style
validateTestAccess(session: any, testId: number)
logAuthorizationCheck(log: AuthAuditLog): Promise<void>
```

**Key Features**:
- Single source of truth for all permission checks
- Middleware-style validators for API routes
- Built-in audit logging framework
- Type-safe with comprehensive TypeScript definitions
- Performance optimized (uses database indexes)

#### Role-Based Filtering Logic

**Two separate data flows:**

1. **Employee View (personal trainings)** - ALL roles:
   - Dashboard `/` shows only required trainings (Pozadovano=TRUE) with assigned trainer
   - Sidebar "Moje skoleni" section shows same filtered trainings
   - API: `GET /api/trainings` (default, without `?admin=true`)
   - API: `GET /api/trainings/[id]/tests?employee=true` (only active tests)
   - Test eligibility rules apply equally to ALL roles

2. **Management View** - TRAINER/ADMIN only:
   - TRAINER: `/trainer` dashboard + management pages use `?admin=true` or direct Prisma queries
   - ADMIN: `/admin/prehled` + management pages use `?admin=true` or direct Prisma queries
   - Management endpoints check `InspiritTrainingAssignment` for TRAINER access

**TRAINER - Management Access (Training Assignment Based)**:
- **BUSINESS RULE: One training = one trainer (1:1 relationship)**
- Each training can have exactly ONE trainer assigned
- Views ONLY assigned trainings in management view (`/trainer`, `/trainer/prvni-testy`)
- Assignment checked on every management API call using `isTrainerAssignedToTraining()`
- Management endpoints return 403 Forbidden for non-assigned trainings
- Trainer is responsible for training content (text + PDF) and tests

**Note:** A TRAINER may have different trainings in management view (assigned by admin) vs employee view (personal required trainings). These are independent.

#### Protected API Endpoints

All API endpoints have been secured with proper authorization checks:

**Fully Protected Trainer Endpoints** (check `InspiritTrainingAssignment`):
- `GET/PUT /api/trainings/[id]` - Training detail and updates
- `GET/POST /api/trainings/[id]/tests` - Test management
- `GET /api/trainings/[id]/content` - Training content access
- `GET /api/trainings/[id]/pdf` - PDF export
- `GET /api/trainings/by-code/[code]` - Training by code lookup
- `GET/PUT/DELETE /api/tests/[id]` - Test operations
- `POST/GET /api/test-attempts/manual` - Manual test entry

**Role-Filtered Endpoints**:
- `GET /api/trainings` - Returns trainings based on context:
  - Default (all roles): Only `Pozadovano = TRUE` trainings with assigned trainer
  - With `?admin=true` (TRAINER): Only assigned trainings for management
  - With `?admin=true` (ADMIN): All trainings for management
- `GET /api/trainings/[id]/tests` - Returns tests based on context:
  - With `?employee=true` (all roles): Only active tests (for test-taking)
  - Without param (TRAINER/ADMIN management): All tests (active + inactive)
  - WORKER always sees only active tests regardless of param

#### Security Implementation Pattern

**Recommended pattern for new API endpoints**:

```typescript
import { validateTrainingAccess } from '@/lib/authorization';

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const trainingId = parseInt(id);

  // SECURITY: Validate authorization using centralized helper
  try {
    await validateTrainingAccess(session, trainingId);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Nedostatečná oprávnění' },
      { status: 403 }
    );
  }

  // ... proceed with authorized operation
}
```

#### Testing RBAC

Comprehensive testing guide: `RBAC-TESTING-GUIDE.md` in project root

**Quick Verification**:
1. ALL roles: Should see only required trainings (Pozadovano=TRUE) with assigned trainer on dashboard `/` and sidebar "Moje skoleni"
2. ALL roles: Test eligibility rules (first test in-person, max 2 attempts, retake window) apply equally
3. TRAINER role: Should see only assigned trainings in management view `/trainer` and `/trainer/prvni-testy`
4. Security: Direct URL access to non-authorized management endpoints should return 403

**Database Queries for Testing**:
```sql
-- Check trainer assignments
SELECT t.code, t.name, ta.assignedAt
FROM InspiritTrainingAssignment ta
JOIN InspiritTraining t ON ta.trainingId = t.id
WHERE ta.trainerId = <TRAINER_ID>;

-- Check worker required trainings
SELECT _CMMPozadovano, _EDMPozadovano, _ITBezpecnostPozadovano
FROM InspiritCisZam
WHERE ID = <WORKER_ID>;
```

#### Audit Logging

All authorization checks can be logged for compliance and security auditing:

```typescript
await logAuthorizationCheck({
  userId: session.user.id,
  userRole: session.user.role,
  action: 'training.edit',
  resourceType: 'training',
  resourceId: trainingId.toString(),
  allowed: hasAccess,
  reason: hasAccess ? 'Authorized' : 'Not assigned to training'
});
```

Currently logs to console (development), ready for database storage (production).

### One Trainer Per Training - Business Rule

**BUSINESS RULE**: Each training can have exactly **ONE trainer** assigned (1:1 relationship).

**Implementation** (enforced at application level in `POST /api/admin/assignments`):

```typescript
// Check if training already has an active trainer assigned
const existingTrainerAssignment = await prisma.inspiritTrainingAssignment.findFirst({
  where: {
    trainingId,
    deletedAt: null // Only active assignments
  }
});

if (existingTrainerAssignment) {
  return NextResponse.json({
    error: `Školení již má přiřazeného školitele: ${trainerName}. Jedno školení může mít pouze jednoho školitele.`
  }, { status: 409 });
}
```

**Data Model**:
```
InspiritTraining (1) ←→ (0..1) InspiritTrainingAssignment ←→ (1) Trainer (User)
```

**Trainer Responsibilities**:
- Rich text content (via Tiptap editor)
- PDF document upload
- Test creation and management
- Question management

**What employees see (all roles in employee view)**:
- Single trainer's content (both rich text and PDF)
- Only the active test (One Active Test Rule)
- Trainer contact information (name + email)

**Admin UI** (`/admin/assignments`):
- Shows which trainings have assigned trainers
- Filters dropdown to show only unassigned trainings
- Displays count of assigned/unassigned trainings
- Prevents creating duplicate assignments (409 Conflict)

**Changing Trainer**:
1. Admin must first remove existing assignment (soft delete)
2. Then assign new trainer
3. Content (text + PDF) remains on the training
4. Tests remain on the training

## 🔄 Automatic Training Synchronization

The system dynamically generates training content based on database columns:

### How It Works
1. **On Application Start** (`src/instrumentation.ts`):
   - Calls `initializeTrainings()` from `lib/init-trainings.ts`
   - Scans TabCisZam_EXT table for training columns pattern: `_{code}DatumPosl`, `_{code}Pozadovano`
   - Creates missing Training records automatically via `lib/training-sync.ts`
   - Preserves existing training data

2. **Manual Synchronization**:
   - Admin page: `/admin/prehled` (integrated into admin dashboard)
   - Button: "Spustit manuální synchronizaci"
   - API endpoint: `POST /api/admin/sync-trainings`

3. **VIEW Regeneration** (for DatumPristi calculation):
   - API endpoint: `POST /api/admin/regenerate-view`
   - Stored procedure: `EXEC sp_RegenerateInspiritCisZamView`
   - Dynamically regenerates InspiritCisZam VIEW based on detected columns
   - Uses `validityMonths` from InspiritTraining table (default: 12 months)

4. **Debug Tools** (not part of application):
   - `prisma/check-columns.js` - Manual script for database analysis
   - Run with: `node prisma/check-columns.js`

### Training Detection Pattern
For each training, the system looks for TWO physical columns in TabCisZam_EXT table:
- `_{code}DatumPosl` - Last completion date (PHYSICAL column)
- `_{code}Pozadovano` - Required flag (boolean, PHYSICAL column)

The third column is COMPUTED in the VIEW (dynamically generated):
- `_{code}DatumPristi` - Next due date (COMPUTED via DATEADD in InspiritCisZam VIEW)
  - Uses `validityMonths` from InspiritTraining table
  - Default: 12 months if not configured
  - Example: `DATEADD(month, 24, _CMMDatumPosl) AS _CMMDatumPristi`

**CRITICAL:** All training columns have `_` (underscore) prefix!

Example physical columns in TabCisZam_EXT: `_CMMDatumPosl`, `_CMMPozadovano`
Example computed column in VIEW: `_CMMDatumPristi = DATEADD(month, 24, _CMMDatumPosl)`
→ Creates training with code "CMM"

### Adding New Training (Complete Workflow)

When DB admin adds new training columns to TabCisZam_EXT:

```sql
-- Step 1: Add physical columns (DB admin in SSMS)
ALTER TABLE TabCisZam_EXT ADD _NoveSkolDatumPosl DATETIME2 NULL;
ALTER TABLE TabCisZam_EXT ADD _NoveSkolPozadovano BIT NULL;

-- Step 2: Regenerate VIEW to include DatumPristi calculation
EXEC sp_RegenerateInspiritCisZamView;
```

Then in application:
1. Run "Spustit manuální synchronizaci" in admin dashboard → creates InspiritTraining record
2. (Optional) Set custom validity: Edit training → set validityMonths → regenerate VIEW again

**API Endpoints for Sync:**
- `POST /api/admin/sync-trainings` - Sync Training table with TabCisZam_EXT columns
- `POST /api/admin/regenerate-view` - Regenerate InspiritCisZam VIEW dynamically
- `GET /api/admin/regenerate-view` - Preview detected trainings without executing

## 📚 Advanced Testing System

### Test Configuration
- **Multiple Test Variants**: Each training can have multiple test variants
- **One Active Test Rule**: ⚠️ **ONLY ONE test can be active per training at any time**
  - Workers see only the active test
  - Trainers/admins see all test variants (active and inactive)
  - Trainers can activate/deactivate tests via toggle in test management
- **Test Ownership**: Tests belong to training, NOT to trainer
  - Tests have NO `createdBy` field - by design
  - Removing trainer assignment (`TrainingAssignment`) keeps tests intact
  - Tests remain in system as part of training content
- **Soft Delete**: Tests use soft delete system
  - Deleted tests are marked with `deletedAt` timestamp
  - Can be restored by admins if needed
  - Not permanently removed from database
- **Default Settings**:
  - Passing score: 75%
  - Time limit: 15 minutes (configurable by trainer)
- **Question Types**:
  - Single choice (1 point per question)
  - Multiple choice (multi-point based on number of correct answers)
- **Automatic Point Calculation**:
  - Question points are calculated automatically when creating questions
  - Single choice: 1 point (always)
  - Multiple choice: Number of points = number of correct answers
  - Example: Question with 3 correct answers = 3 points
  - Trainers cannot manually set points - calculated by system

### Testing Rules (All Roles)

**Test Eligibility Logic** (enforced in `/api/trainings/[id]/test/start` and `/api/trainings/[id]/test/check-eligibility`):

**IMPORTANT**: These rules apply equally to ALL roles (ADMIN, TRAINER, WORKER). All users are employees who must follow the same test-taking rules.

1. **First Test Rule** (DatumPosl = NULL):
   - User CANNOT take test online if `_{code}DatumPosl` is NULL
   - First test MUST be taken in person with trainer (manual entry)
   - Eligibility check returns: `{ eligible: false, reason: "První test musí být absolvován osobně" }`

2. **Retake Window Rule**:
   - User can ONLY retake test 1 month before expiration (`DatumPristi`)
   - Current date must be >= (DatumPristi - 30 days)
   - If too early: `{ eligible: false, reason: "Test lze opakovat až měsíc před vypršením platnosti" }`

3. **Attempt Limit Rule** (Max 2 attempts):
   - Count incomplete attempts since last successful test
   - Query: `WHERE userId = X AND testId = Y AND completedAt IS NOT NULL AND passed = false`
   - If attemptCount >= 2: `{ eligible: false, reason: "Překročen limit pokusů" }`
   - **Counter reset**: After successful test completion (online OR manual entry)
     - Counter resets to 0 when new `DatumPosl` is written to database
     - Query counts attempts since `DatumPosl` date

4. **Pre-flight Check Endpoint**:
   - `GET /api/trainings/[id]/test/check-eligibility` - Check eligibility before showing "Start Test" button
   - Returns: `{ eligible: boolean, reason: string, attemptCount: number }`
   - UI disables "Start Test" button if not eligible

5. **Scoring System**:
   - **Single Choice**: 1 point per question (correctAnswer = plain string)
   - **Multiple Choice**: 1 point per correct answer selected
     - Example: 3 correct answers → 3 points max
     - Partial credit: Select 2/3 correct → 2 points
     - Incorrect selection penalty: -1 point per wrong answer
   - **Passing threshold**: 75% (or custom passingScore)
   - Total score = (earnedPoints / totalPoints) * 100

### One Active Test Rule - Automatic Enforcement

**Implementation** (enforced in `PUT /api/tests/[id]`):

When trainer/admin activates a test (sets `isActive = true`):
```typescript
// Automatic deactivation of other tests for same training
if (isActive) {
  await prisma.inspiritTest.updateMany({
    where: {
      trainingId: test.trainingId,
      id: { not: testId },
      isActive: true,
      deletedAt: null
    },
    data: { isActive: false }
  });
}
```

**Business Rule**:
- ONLY ONE test can be active per training at any time
- When activating test A → all other tests for same training are automatically deactivated
- **Employee view** (all roles on `/{slug}`): Only active test visible (via `?employee=true` param)
- **Management view** (TRAINER/ADMIN on `/trainer/training/[code]/tests`): All tests visible (can switch active test via toggle)

**Use Case**: Multiple test variants (Test A, Test B, Test C) for same training → only active one shown in employee view

### Soft Delete System - Cascade Behavior

**Entities with soft delete**:
- `InspiritTest` (deletedAt)
- `InspiritQuestion` (deletedAt)
- `InspiritTestAttempt` (deletedAt)
- `InspiritCertificate` (deletedAt)
- `InspiritTrainingAssignment` (deletedAt)

**Cascade Soft Delete Logic** (enforced in `DELETE /api/tests/[id]`):

When deleting a test:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Soft delete test
  await tx.inspiritTest.update({
    where: { id: testId },
    data: { deletedAt: new Date() }
  });

  // 2. Cascade to questions
  await tx.inspiritQuestion.updateMany({
    where: { testId: testId },
    data: { deletedAt: new Date() }
  });

  // 3. Cascade to test attempts
  await tx.inspiritTestAttempt.updateMany({
    where: { testId: testId },
    data: { deletedAt: new Date() }
  });

  // 4. Cascade to certificates
  await tx.inspiritCertificate.updateMany({
    where: { testAttemptId: { in: attemptIds } },
    data: { deletedAt: new Date() }
  });
});
```

**Admin Recovery**:
- `GET /api/admin/deleted-data` - List all soft-deleted entities
- `POST /api/admin/deleted-data/restore` - Restore entity (sets deletedAt = NULL)
- `DELETE /api/admin/deleted-data/clean` - Permanently delete (hard delete from DB)

**Query Pattern**:
- Always filter: `WHERE deletedAt IS NULL` for active entities
- Include deleted: `WHERE deletedAt IS NOT NULL` for recovery UI

### Transaction Atomicity - Critical Operations

**Test Submission** (`POST /api/test-attempts/[id]/submit`):
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update test attempt (score, passed)
  await tx.inspiritTestAttempt.update({ ... });

  // 2. Update training dates (using raw SQL)
  await tx.$executeRawUnsafe(`
    UPDATE [TabCisZam_EXT]
    SET [_${trainingCode}DatumPosl] = @p0
    WHERE [ID] = @p1
  `, new Date(), userId);

  // 3. Create certificate (if passed)
  if (passed) {
    await tx.inspiritCertificate.create({ ... });
  }
});
```

**Manual Test Entry** (`POST /api/test-attempts/manual`):
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create manual attempt
  await tx.inspiritTestAttempt.create({ ... });

  // 2. Update training dates (raw SQL in transaction!)
  await tx.$executeRawUnsafe(`
    UPDATE [TabCisZam_EXT]
    SET [_${trainingCode}DatumPosl] = @p0
    WHERE [ID] = @p1
  `, datumPosl, userId);

  // 3. Create certificate (if passed)
  if (passed) {
    await tx.inspiritCertificate.create({ ... });
  }
});
```

**CRITICAL**: Raw SQL (`$executeRawUnsafe`) WORKS inside Prisma transactions!

**Real-time Revalidation** (after assignments):
```typescript
// POST /api/admin/assignments
await prisma.inspiritTrainingAssignment.create({ ... });
revalidatePath('/trainer');  // Immediate UI update for trainers
```

### Certificate Generation
- Automatic PDF certificate upon successful test completion
- Unique certificate number (format: CERT-YYYY-XXXXX)
- Validity period: 1-2 years from issue date (configurable per training via database VIEW)
- Stored in database with training and test attempt reference

## Available MCP Servers

Claude Code has access to these MCP servers (configured globally):

- **Playwright** (`mcp__playwright__`) - Browser automation, E2E testing, web scraping
- **Sequential Thinking** (`mcp__sequential-thinking__`) - Step-by-step problem solving and analysis
- **Context7** (`mcp__context7__`) - Library documentation lookup for any framework/library
- **Basic Memory** (`mcp__basic-memory`) - Persistent knowledge base for storing project insights and solutions
- **Shadcn** (`mcp__shadcn__`) - Direct access to shadcn/ui component source code and demos

These servers enhance development capabilities and are available immediately in all Claude Code sessions.

### Technology Stack

- **Framework**: Next.js 15.3.5 with App Router and Turbopack
- **Runtime**: React 19.0.0, TypeScript 5.7.2 (strict mode)
- **UI Components**:
  - shadcn/ui (full suite of Radix UI components)
  - Tailwind CSS v4.0.0 with tailwindcss-animate
  - Lucide React & Tabler Icons for iconography
- **Database (Sdílená architektura)**:
  - **Lokální vývoj**: Microsoft SQL Server Express 2019 (localhost:1433, database: AeroLMS)
    - Schema: `prisma/schema.prisma`
    - Environment: `.env.local` s `DATABASE_URL`
    - Migrace: `prisma/migrations/`
  - **Produkce (Corporate Server)**: Microsoft SQL Server (10.235.1.8:1433, database: Helios003)
    - Schema: `prisma/schema.prisma` (sdílené s lokálem)
    - Environment: `.env.production` s `DATABASE_URL`
    - Migrace: **POUZE MANUÁLNÍ** SQL příkazy (bezpečnostní požadavky)
  - Prisma ORM v6.11.1 as database abstraction layer
  - **Důležité**: Oba prostředí používají SQL Server, produkční DB obsahuje další tabulky nesouvisející s tímto projektem
- **Authentication**: NextAuth v4.24.11 with JWT strategy (employee code-based)
- **State Management**:
  - Zustand v5.0.2 for client state
  - Nuqs v2.4.1 for URL search params state
- **Forms & Validation**:
  - React Hook Form v7.54.1
  - Zod v3.24.1 for schema validations
- **Data Tables**:
  - Tanstack React Table v8.21.2
  - Server-side pagination/filtering via Nuqs
- **Charts**: Recharts v2.15.1 for data visualization
- **PDF Generation**: @react-pdf/renderer v4.3.0 for training content export
- **Command Palette**: kbar v0.1.0-beta.45 for Cmd+K interface
- **Error Tracking**: Sentry/NextJS v9.19.0
- **Date Handling**: date-fns v4.1.0
- **Code Quality**:
  - ESLint 8.48.0 with TypeScript plugin
  - Prettier 3.4.2 with Tailwind plugin
  - Husky v9.1.7 for pre-commit hooks
  - Lint-staged for staged files

## Development Commands

```bash
# Development with Turbopack
npm run dev              # Starts on http://localhost:3000

# Production build
npm run build            # Creates .next production build
npm run start            # Starts production server

# Code Quality
npm run lint             # Run Next.js linter
npm run lint:fix         # Fix linting issues and format (NOTE: package.json references pnpm, use npm)
npm run lint:strict      # Fail on any warnings
npm run format           # Format all files with Prettier
npm run format:check     # Check formatting without fixing

# Database operations (Prisma with SQL Server)
npx prisma migrate dev   # Run migrations in development
npx prisma db push       # Push schema changes without migration
npx prisma generate      # Generate Prisma client
npx prisma db seed       # Seed database (runs prisma/seed.js)

# ⚠️ DŮLEŽITÉ: Správné spuštění Prisma Studio s lokální databází
npx dotenv -e .env.local -- prisma studio  # ✅ SPRÁVNĚ - načte DATABASE_URL z .env.local
# NIKDY nepoužívej: npx prisma studio     # ❌ ŠPATNĚ - chybí DATABASE_URL

# SQL Server Management
# Use SQL Server Management Studio (SSMS) to manage database
# Database: AeroLMS on localhost:1433

# Type checking
npx tsc --noEmit         # Check TypeScript types without emitting files

# Git hooks (auto-installed)
npm run prepare          # Setup Husky pre-commit hooks
```

## Key Features

### Dashboard Pages
- **Overview** (`/`): Main dashboard with real-time statistics from database (ALL roles land here)
  - Statistics cards with emoji indicators (🔵🟢🔴🟡) and user-friendly labels
  - Bar chart showing upcoming trainings by month
  - Recent completions list with last 5 trainings
  - Full training table with columns:
    - Název školení (Training name)
    - Požadováno (Required: Yes/No)
    - Poslední absolvování (Last completion date)
    - Platnost do (Valid until date)
    - Status (Visual status with icons: ✅ Platné, ⚠️ Brzy vyprší, ❌ Prošlé, ⏳ Čeká na první absolvování)
    - Akce (Actions: Open button)
- **Dynamic Training Routes** (`[[...node]]`): Handles training modules with dynamic path segments
  - Training overview with continuous content display (no collapsible sections)
  - PDF export functionality for training content
  - Test mode with assessment capabilities
  - Results display with scoring
- **Profil** (`/profil`): User profile management page
- **Login** (`/login`): Universal login form with email or personal code + password

### UI Components Library (shadcn/ui)
All components are in `src/components/ui/`:

**Note**: To get the latest shadcn/ui v4 component implementations, use the Shadcn UI v4 MCP server:
- Example: "Get me the latest Button component from shadcn/ui"
- Example: "Show me the DataTable implementation with all features"
- This helps ensure components are up-to-date with the latest shadcn/ui patterns

Components currently in the project:
- **Forms**: Button, Input, Textarea, Select, Checkbox, Radio Group, Switch, Slider, Form
- **Feedback**: Alert, Alert Dialog, Toast (Sonner), Progress, Skeleton
- **Overlays**: Dialog, Sheet, Popover, Tooltip, Hover Card, Context Menu, Dropdown Menu
- **Navigation**: Tabs, Breadcrumb, Navigation Menu, Sidebar, Menubar
- **Data Display**: Table (with advanced features), Card, Badge, Avatar
- **Layout**: Separator, Scroll Area, Aspect Ratio, Collapsible, Resizable
- **Advanced**: 
  - Calendar with date-fns
  - Command (cmdk) for search
  - Date Picker (React Day Picker)
  - Input OTP for verification codes
  - File Uploader with dropzone
- **Animations**: All components support motion/animations

## Architecture

### Authentication Flow
- NextAuth with JWT strategy using email or personal code + password
- **Login form**: Single universal field "E-mail / Osobní číslo" + password
  - Admins/Trainers: Use personal code (e.g., 123456) OR email (e.g., test@test.cz) + password
  - Workers: Use personal code (e.g., 123456) + password
- System automatically detects if identifier is email or code (by presence of '@')
- All users must have password in database
- Protected routes: `/dashboard/*` and `/api/*`
- Sign-in page: `/login`
- Session data includes `user.id`, `user.code`, `user.email`, and `user.role`
- Middleware protection in `src/middleware.ts`

### Database Architecture

**Production Architecture Overview:**
The system uses a **hybrid database pattern** combining existing Helios ERP tables with new AeroLMS tables. This architecture is CRITICAL to understand for any database operations.

**Key Components:**
1. **TabCisZam** (Helios - ❌ DO NOT MODIFY)
   - Employee master table with ID, Jmeno, Prijmeni, Cislo
   - Managed by Helios ERP system
   - AeroLMS has READ-ONLY access

2. **TabCisZam_EXT** (Helios - ⚠️ UPDATE ONLY VIA APPROVED FUNCTIONS)
   - Extended employee data with dynamic training columns (added by DB admin)
   - Pattern: `_{code}DatumPosl`, `_{code}DatumPristi`, `_{code}Pozadovano`
   - **CRITICAL**: All training columns have `_` (underscore) prefix
   - **CRITICAL**: DatumPristi is AUTO-CALCULATED by database (+1 year from DatumPosl)
   - Use ONLY `updateUserTrainingData()` from `lib/training-sync.ts` for updates

3. **InspiritUserAuth** (AeroLMS - ✅ FULL ACCESS)
   - Authentication table: ID, role, email, timestamps (NOT code or password!)
   - Code (Cislo) and password (Alias) are in TabCisZam - plain text password (Helios constraint)
   - 1:1 relationship with TabCisZam via ID field

4. **InspiritCisZam VIEW** (IDENTICAL in dev and production)
   - ✅ **Already exists in production** containing TabCisZam + TabCisZam_EXT
   - 🔧 **Deployment script 03 augments** with LEFT JOIN to InspiritUserAuth
   - Uses `CREATE OR ALTER VIEW` (preserves existing view, no data loss)
   - INSTEAD OF triggers handle INSERT/UPDATE operations
   - Routes auth data to InspiritUserAuth, preserves Helios data
   - **⚠️ CRITICAL - Dynamic Training Columns:**
     - VIEW **OBSAHUJE** všechny dynamické sloupce školení (_CMMPozadovano, _EDMPozadovano, _ITBezpecnostPozadovano, atd.)
     - NICMÉNĚ tyto sloupce **NEJSOU v Prisma schema** (záměrně!)
     - **Důvod**: Prisma ORM neumí pracovat s dynamickými sloupci načítanými podle patternu názvu
     - **Proto**: K training sloupcům přistupujeme POUZE přes raw SQL (`$queryRawUnsafe`, `$executeRawUnsafe`)
     - **Chyba**: `prisma.user.findUnique()` vrátí `undefined` pro training sloupce (nejsou v schema)
     - **Správně**: Použij funkce z `lib/training-sync.ts` (getUserTrainingData, updateUserTrainingData)
     - **Example problém**: `user._ITBezpecnostPozadovano` z Prisma = `undefined`, ale sloupec v DB existuje!

5. **Prisma User Model** (JavaScript alias, not database SYNONYM)
   - Prisma model `User` maps to `InspiritCisZam` VIEW in schema
   - JavaScript alias: `Object.assign(prismaClient, { user: prismaClient.inspiritCisZam })`
   - Allows code to use `prisma.user` while querying InspiritCisZam VIEW
   - No database SYNONYM object created

**Data Flow - Read Operations:**
```
Prisma Query (prisma.user) → InspiritCisZam VIEW →
  LEFT JOIN (TabCisZam + TabCisZam_EXT + InspiritUserAuth)
```

**Data Flow - Write Operations:**
- **Auth fields** (email, role): Prisma update → INSTEAD OF trigger → InspiritUserAuth
- **Password field** (Alias): In TabCisZam (plain text, Helios constraint)
- **Training fields**: Direct to TabCisZam_EXT via `updateUserTrainingData()`
- **Helios fields** (Jmeno, Prijmeni, Cislo): ❌ NEVER UPDATE (managed by Helios)

**Environment Identity:**
- **Development and Production**: IDENTICAL database structure
- Both environments use TabCisZam, TabCisZam_EXT, InspiritUserAuth, and InspiritCisZam VIEW
- No environmental differences or conditional logic

### Database Models
- **User**: Employee records with:
  - Unique employee code for authentication
  - Role field (ADMIN, TRAINER, WORKER)
  - Multiple training date tracking fields (DatumPosl/DatumPristi/Pozadovano pattern)
  - Each training module tracks: last completion, next due date, required flag
  - Index on `role` for role-based filtering
- **Training**: Training modules with code, name, description, and content
  - Code: Database column identifier (e.g., "CMM", "EDM")
  - Name: Display name (can be overridden by trainers)
  - Unique constraint on `code` (automatic index)
- **Test**: Assessment tests linked to trainings with passing score and time limits
  - Multiple tests per training support
  - Active/inactive status for test management
  - Indexes: `trainingId`, `isActive`, composite `trainingId+isActive`
- **Question**: Test questions with types, options, correct answers, and points
  - Indexes: `testId`, composite `testId+order` for ordered retrieval
- **TestAttempt**: User test attempts with scores and completion status
  - Indexes: `userId`, `testId`, `completedAt`, `createdAt` (DESC), composite `userId+testId`
  - Optimized for user history queries and filtering by completion status
  - Employee data accessed via `userId` foreign key to TabCisZam table
- **Certificate**: PDF certificates for completed trainings
  - Indexes: `userId`, `trainingId`, `certificateNumber`, `validUntil`
  - Optimized for certificate lookups and expiration queries
- **TrainingAssignment**: One-to-one relationship between trainers and trainings
  - **BUSINESS RULE: One training = one trainer**
  - Each training can have exactly ONE trainer assigned (enforced at application level)
  - Trainer is responsible for: training content (rich text + PDF), tests, and questions
  - Indexes: `trainerId`, `trainingId`
  - Unique constraint on `trainerId+trainingId` combination

### Database Architecture - Critical Rules for Agents

**⚠️ MANDATORY RULES - READ BEFORE ANY DATABASE OPERATION:**

1. **NEVER Modify Helios Tables Directly**
   - ❌ NEVER `UPDATE TabCisZam` - managed by Helios ERP
   - ❌ NEVER `UPDATE TabCisZam_EXT` without using `updateUserTrainingData()`
   - ❌ NEVER `INSERT` or `DELETE` from Helios tables
   - ✅ ONLY use approved helper functions from `lib/training-sync.ts`

2. **Training Column Access - SQL Injection Prevention**
   - ❌ NEVER use dynamic training codes without validation
   - ✅ ALWAYS call `validateTrainingCode(code)` BEFORE any raw SQL
   - ✅ Import from: `import { validateTrainingCode } from '@/lib/validation-schemas'`
   - ✅ Validates ONLY alfanumerické znaky (SQL injection ochrana)
   - ✅ NEVALIDUJE existenci v DB - kódy jsou plně dynamické
   - **Reason**: Production database (Helios003) is SHARED with other systems
   - **Risk**: Unvalidated input could access/modify unrelated data

3. **Underscore Prefix Requirement**
   - All training columns in database have `_` prefix: `_CMMDatumPosl`, NOT `CMMDatumPosl`
   - This applies to ALL training codes (dynamický počet)
   - Common mistake: Forgetting underscore in SQL queries

4. **Parameterized Queries Required**
   - ✅ ALWAYS use `@p0, @p1, @p2` parameters in raw SQL
   - ❌ NEVER use string interpolation: `` `WHERE UserID = ${userId}` ``
   - ✅ CORRECT: `prisma.$queryRawUnsafe('... WHERE UserID = @p0', userId)`

5. **Production VIEW Pattern**
   - ✅ Use `CREATE OR ALTER VIEW` - preserves existing data
   - ❌ NEVER `DROP VIEW` then `CREATE VIEW` - causes data loss
   - Reason: Production database may have active connections

6. **Training Data Updates**
   - ✅ ONLY use `updateUserTrainingData(userId, trainingCode, datumPosl, datumPristi?)`
   - Function handles environment detection (dev vs production)
   - Function validates training code pattern (alfanumerické znaky only)
   - Function uses correct table (TabCisZam_EXT in prod, User in dev)

7. **Read Training Data**
   - ✅ Use `getUserTrainingData(userId, trainingCode)` for single training
   - ✅ Use `getAllUserTrainings(userId)` for all trainings
   - Returns: `{ datumPosl, datumPristi, pozadovano, status }`

8. **Auto-Calculated Fields**
   - DatumPristi is AUTO-CALCULATED by database trigger (+1 year from DatumPosl)
   - When calling `updateUserTrainingData()`, you CAN provide custom datumPristi but usually omit it
   - Database will handle the calculation

9. **Prisma Schema Design**
   - Training columns are NOT in Prisma schema (intentional!)
   - Allows dynamic training addition without code rebuild
   - Access via raw SQL functions in `training-sync.ts`

10. **Environment Detection**
    - Use `isProductionEnvironment()` from `training-sync.ts`
    - Checks `process.env.DB_ENVIRONMENT === 'production'`
    - Returns correct table/column names based on environment

**Quick Reference - Approved Functions:**
```typescript
// lib/training-sync.ts - USE THESE ONLY
import {
  detectTrainingColumns,        // Scan database for training columns
  syncTrainingsWithDatabase,    // Create missing Training records
  getUserTrainingData,          // Read single training data (validated)
  updateUserTrainingData,       // Update training data (validated, env-aware)
  getAllUserTrainings          // Read all training data for user
} from '@/lib/training-sync';

// lib/validation-schemas.ts - VALIDATE BEFORE RAW SQL
import {
  validateTrainingCode          // Validates pattern only (SQL injection prevention)
} from '@/lib/validation-schemas';
```

### Routing Structure
- **App Router** with Next.js 15
- Main routes (all roles land on `/` - personal training dashboard):
  - `app/(dashboard)/[[...node]]/` - Dynamic training routes with catch-all segments (employee view for all roles)
  - `app/(dashboard)/profil/` - User profile page
  - `app/(dashboard)/admin/` - Admin dashboard and tools
  - `app/(dashboard)/trainer/` - Trainer dashboard and management
  - `app/login/` - Authentication page with sign-in-view component
- Admin routes:
  - `/admin/prehled` - Admin dashboard (includes synchronization, user management, training management)
  - `/admin/assignments` - Training assignments management (assign trainers to trainings)
  - `/admin/smazana-data` - Soft-deleted data management (restore or permanently delete)
- Trainer routes:
  - `/trainer` - Trainer dashboard (My trainings overview)
  - `/trainer/prvni-testy` - First tests page (Manual test result entry for in-person tests)
  - `/trainer/vysledky` - Results page (View all test results by employee)
  - `/trainer/training/[code]/edit` - Edit training details
  - `/trainer/training/[code]/tests` - Manage tests for training
  - `/trainer/test/[id]/edit` - Edit test details
  - `/trainer/test/[id]/questions` - Manage test questions
- API routes - See API Endpoints section above

### State Management
- **Nuqs** for URL search params state management
- Form state handled by React Hook Form with Zod validation

### Component Architecture
```
src/components/
├── ui/           # Shadcn UI primitive components
├── layout/       # App layout components (sidebar, header)
├── kbar/         # Command palette (Cmd+K) interface
└── modal/        # Modal components

src/features/     # Feature-based modules
├── */components/ # Feature-specific components
├── */utils/      # Feature utilities and stores
```

### Data Tables
- **Tanstack React Table v8** for complex tables
- Server-side pagination, filtering, and sorting via Nuqs
- Column definitions in `*/product-tables/columns.tsx`
- Table toolbar with faceted filters and view options
- Built-in sorting, filtering, column visibility toggles
- Row selection and actions support

### Additional Libraries
- **Motion v11.17**: Animation library for smooth transitions
- **Sonner v1.7**: Toast notifications system
- **Vaul v1**: Drawer component for mobile
- **cmdk v1.1**: Command menu (Cmd+K support)
- **react-dropzone v14**: File upload with drag & drop
- **react-resizable-panels v2**: Resizable layout panels
- **react-responsive v10**: Media query hooks
- **match-sorter v8**: Fuzzy search for filtering
- **uuid v11**: Unique ID generation
- **Input OTP v1.4**: One-time password inputs
- **React Day Picker v8**: Date picker component

## API Endpoints - Complete List (24 routes)

### Training APIs (9 routes)
- **GET /api/trainings** - List trainings based on context:
  - Default (all roles): Returns only `Pozadovano = TRUE` trainings with assigned trainer
  - Query params: `?admin=true` (TRAINER: assigned trainings, ADMIN: all trainings)
- **GET /api/trainings/[id]** - Get training detail with authorization check
  - TRAINER: Checks InspiritTrainingAssignment
  - Returns: Training object with tests
- **PUT /api/trainings/[id]** - Update training (name, description, content) - trainer/admin only
  - Body: UpdateTrainingSchema (Zod validated)
- **DELETE /api/trainings/[id]** - Soft delete training (admin only)
  - Cascade soft delete: Tests, Questions, TestAttempts, Certificates
- **GET /api/trainings/[id]/content** - Get training content sections
- **GET /api/trainings/[id]/pdf** - Generate and download training content as PDF
- **GET /api/trainings/[id]/tests** - Get all tests for a training (multiple test support)
  - With `?employee=true`: Only active tests (for test-taking, used by all roles in employee view)
  - Without param: WORKER sees only active, TRAINER/ADMIN sees all (for management)
- **POST /api/trainings/[id]/tests** - Create new test for training (trainer/admin only)
  - Body: CreateTestSchema (Zod validated, max 100 questions)
  - Auto-calculates points per question
- **GET /api/trainings/[id]/test/check-eligibility** - Pre-flight eligibility check (all roles)
  - Returns: eligible (boolean), reason (string), attemptCount (number)
- **POST /api/trainings/[id]/test/start** - Start a new test attempt (all roles, with testId in body)
  - Eligibility checks apply to ALL roles: First test, max attempts, retake window
  - Body: { testId: number }
- **GET /api/trainings/by-code/[code]** - Get training by code
- **GET /api/trainings/slug/[slug]** - Get training by URL slug

### Test Management (3 routes)
- **GET /api/tests/[id]** - Get test details with questions
  - Authorization check via training ownership
- **PUT /api/tests/[id]** - Update test including questions (trainer/admin only)
  - Body: CreateTestSchema (Zod validated)
  - One-active-test rule: Deactivates other tests if isActive = true
  - Auto-recalculates points
- **DELETE /api/tests/[id]** - Soft delete test (admin only)
  - Cascade soft delete: Questions, TestAttempts, Certificates

### Test Attempts (4 routes)
- **GET /api/test-attempts/[id]** - Get attempt detail
  - Authorization: Own attempt or TRAINER/ADMIN
- **POST /api/test-attempts/[id]/submit** - Submit test answers and calculate score
  - Body: SubmitTestSchema (Zod validated)
  - Transaction: Update attempt + Update training dates + Create certificate (atomic)
  - Auto-scoring with partial points for multiple choice
  - Resets attempt counter on pass
- **POST /api/test-attempts/[id]/abandon** - Mark test as abandoned
  - Sets completedAt, passed = false, score = 0
- **POST /api/test-attempts/manual** - Create manual test attempt (trainers/admins only, for in-person tests)
  - Body: ManualTestAttemptSchema (Zod validated)
  - Transaction: Create attempt + Update training dates + Create certificate (atomic)
  - Resets attempt counter on pass
- **GET /api/test-attempts/manual** - Get manual test attempts for a user (trainers/admins only)

### User Management (2 routes)
- **GET /api/users** - List all users (admin only)
  - Query params: role filter
- **PATCH /api/users/[userId]** - Update user (admin only, for role assignment)
  - Training column updates use validated updateUserTrainingData()

### Admin Functions (5 routes)
- **POST /api/admin/sync-trainings** - Manually sync trainings from User columns to Training table
- **GET /api/admin/assignments** - List all training assignments
- **POST /api/admin/assignments** - Create training assignment (assign trainer to training)
  - Body: { trainerId: number, trainingId: number }
  - Real-time revalidation: revalidatePath('/trainer')
- **DELETE /api/admin/assignments** - Remove training assignment
  - Body: { trainerId: number, trainingId: number }
  - Real-time revalidation: revalidatePath('/trainer')
- **GET /api/admin/deleted-data** - List soft-deleted entities
  - Returns: Tests, Questions, TestAttempts, Certificates, TrainingAssignments
- **POST /api/admin/deleted-data/restore** - Restore soft-deleted entity
  - Body: { entityType: string, entityId: number }
- **DELETE /api/admin/deleted-data/clean** - Permanently delete soft-deleted entity
  - Body: { entityType: string, entityId: number }

### Certificate APIs (1 route)
- **GET /api/certificates/[id]/pdf** - Download certificate PDF
  - Returns: Base64 PDF data

### Data Import (1 route - Legacy)
- **POST /api/excel-data** - Import data from Excel (kept for future use)

## Security & Validation

**🚨 CRITICAL SECURITY CONTEXT:**
The production database (Helios003) is **SHARED** with other business systems. Improper database operations can:
- Corrupt financial data in Helios ERP
- Expose sensitive employee information
- Cause production downtime affecting entire company
- Violate data protection regulations

**EVERY database operation MUST follow security protocols below.**

### Input Validation (Zod Schemas)

**Directive: ALWAYS validate user input before database operations**

All API endpoints use centralized validation schemas in `src/lib/validation-schemas.ts`:

**Training Codes Pattern Validation** (CRITICAL for SQL injection prevention):
- Training codes are **DYNAMIC** - defined by database columns (added manually by DB admin)
- `validateTrainingCode(code)` - validates pattern only (alfanumerické znaky A-Z, a-z, 0-9)
- Does NOT validate existence in database - source of truth: `detectTrainingColumns()` from database
- **WHY**: Training codes become SQL column names - MUST be validated for safe characters

**API Request Validation Schemas:**
- `CreateTestSchema` - Test creation (max 100 questions, required fields validation)
- `SubmitTestSchema` - Test submissions (answer format, signature data)
- `UpdateTrainingSchema` - Training updates (content length limits, required fields)
- `ManualTestAttemptSchema` - Manual test entry by trainers (score validation)

**Validation Helper Functions:**
- `validateRequestBody(schema, request)` - Async body validation with error handling
- `safeJsonParse(text)` - Safe JSON parsing with fallback to null
- Both return structured errors for API responses

### SQL Injection Prevention

**Directive: Training code validation is MANDATORY before raw SQL**

**Protected Functions in `training-sync.ts`:**
All functions using `$queryRawUnsafe` or `$executeRawUnsafe` MUST:
1. Call `validateTrainingCode(code)` first (throws if invalid)
2. Use parameterized queries with `@p0, @p1, @p2`
3. Never use string interpolation for SQL values

**Example - CORRECT Implementation:**
```typescript
// ✅ SAFE - validation + parameterized query
try {
  validateTrainingCode(trainingCode); // Throws if pattern invalid (SQL injection prevention)
} catch (error) {
  console.error(`Invalid training code: ${trainingCode}`);
  return null;
}

await prisma.$queryRawUnsafe(
  `SELECT [_${trainingCode}DatumPosl] FROM [User] WHERE UserID = @p0`,
  userId  // Parameterized - safe from injection
);
```

**Example - WRONG Implementation:**
```typescript
// ❌ DANGEROUS - no validation, string interpolation
await prisma.$queryRawUnsafe(
  `SELECT [_${untrustedCode}DatumPosl] FROM [User] WHERE UserID = ${userId}`
);
// Allows SQL injection via untrustedCode or userId!
```

**Why This Matters:**
- Production database contains payroll, financial, and personnel data
- Single SQL injection could expose entire company database
- Training codes are user-controllable (via API endpoints)
- Whitelist validation is the ONLY safe approach

### Security Best Practices

**Database Access Rules:**
1. **Shared Database Awareness**
   - Helios003 contains tables for: Accounting, HR, Inventory, Manufacturing
   - AeroLMS tables: Training, Test, Question, TestAttempt, Certificate, TrainingAssignment, InspiritUserAuth
   - Helios tables: TabCisZam, TabCisZam_EXT (plus 50+ other Helios tables)
   - **Never** query or modify tables outside AeroLMS scope

2. **Validation First**
   - All user input → Zod schema validation → database operation
   - No exceptions, even for admin/trainer roles
   - Validate at API boundary, not in components

3. **Parameterized Queries**
   - Prisma parameterized: `where: { id: userId }`
   - Raw SQL parameterized: `@p0, @p1, @p2` placeholders
   - Never: String interpolation in SQL

4. **Role-Based Access Control**
   - Check session role in EVERY API route
   - Admin: Full access to all endpoints
   - Trainer: Access to assigned trainings only
   - Worker: Access to own data only
   - Enforce at API level, not just UI level

5. **Production Database Changes**
   - **NEVER** run `prisma migrate` on production
   - **ALWAYS** use manual SQL scripts from `deployment/sql/`
   - **TEST** on local/staging database first
   - **BACKUP** before any schema changes
   - **USE** CREATE OR ALTER VIEW (not DROP VIEW)

### Common Workflows - Agent Directives

**Workflow 1: Reading User Training Data**
```
Directive: Use approved helper functions, not direct Prisma queries
Pattern: getUserTrainingData(userId, trainingCode) → returns training status
Why: Validates training code, queries InspiritCisZam VIEW for training column data
```

**Workflow 2: Updating Training After Test Completion**
```
Directive: ONLY use updateUserTrainingData() function
Steps:
1. User completes test successfully
2. Call updateUserTrainingData(userId, trainingCode, new Date())
3. Function handles: validation, correct table selection
4. Database auto-calculates DatumPristi (+1 year)
Never: Direct UPDATE on TabCisZam_EXT
```

**Workflow 3: Training Synchronization**
```
Directive: Use syncTrainingsWithDatabase() for automatic detection
When: Application startup, manual admin trigger
Process:
1. detectTrainingColumns() scans TabCisZam_EXT for _*DatumPosl/_*DatumPristi/_*Pozadovano columns
2. Creates missing Training records in Training table
3. Preserves existing training data (names, descriptions, content)
Never: Delete or recreate existing Training records
```

**Workflow 4: Creating New User (Admin Only)**
```
Directive: Create in TabCisZam first (Helios), then add auth data
Steps:
1. Admin creates employee in Helios ERP (outside AeroLMS scope)
2. ID is assigned by Helios in TabCisZam
3. AeroLMS adds auth data via Prisma User create (triggers INSERT into InspiritUserAuth)
4. INSTEAD OF trigger routes auth fields to correct table
Never: Direct INSERT into TabCisZam or TabCisZam_EXT
```

**Workflow 5: User Login**
```
Directive: System auto-detects email vs personal code
Pattern:
- Input contains '@' → email login (admin/trainer)
- Input is numeric → personal code login (worker)
- NextAuth credentials provider handles both cases
- Session includes: id, code, email, role
Never: Require users to specify login type
```

**Workflow 6: Adding New Training Type**
```
Directive: Database-first approach (Helios adds columns)
Process:
1. Database admin adds 3 columns to TabCisZam_EXT: _{code}DatumPosl, _{code}DatumPristi, _{code}Pozadovano
2. Run syncTrainingsWithDatabase() to auto-detect and create Training record
3. Trainer can now edit training content via UI
Note: Training codes are auto-detected from database - no code changes required!
Never: Add training columns to Prisma schema
```

## Key Implementation Patterns

### Forms
- Use React Hook Form with Zod schemas
- Schema definitions in `features/*/utils/form-schema.ts`
- Form components follow pattern in `features/*/components/*-form.tsx`

### API Calls
- Server Actions preferred over API routes when possible
- Use Prisma client imported from `@/lib/prisma`
- Handle errors with try-catch and return appropriate responses

### Styling
- Tailwind CSS v4 with `tailwind-merge` for className merging
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Component variants handled by `class-variance-authority`

### Error Handling
- Sentry integration for production error tracking
- Error boundaries with error.tsx files at route levels
- Global error handler in `app/global-error.tsx`

### Training Content Rendering Pattern
- Training content displays as continuous flow without collapsible sections
- All content sections visible immediately on page load
- Content types supported: introduction, keyPoints, rules, standards, tolerances, defects, documents, ppe, hazards, emergency
- Each content type has dedicated rendering logic with appropriate icons and styling
- Content centered with `max-w-[1200px] mx-auto` for optimal reading
- Example structure in `app/(dashboard)/[[...node]]/training-client.tsx`

### PDF Export Feature
- Uses @react-pdf/renderer for server-side PDF generation
- PDF document component: `components/training/training-pdf-document.tsx`
- Preserves all content formatting and structure in PDF
- Supports Czech characters with Roboto font family
- Automatic filename generation with training name and date
- API endpoint: `/api/trainings/[id]/pdf`

### Test Mode Switching Pattern
- ViewMode state manages transitions: 'overview' | 'test' | 'results'
- Applies to ALL roles (ADMIN, TRAINER, WORKER) - same eligibility checks and test UI
- Separate components for each mode:
  - `src/components/training/test-form.tsx` - Assessment form with questions
  - `src/components/training/test-results.tsx` - Score display and feedback
- Test flow: handleStartTest → fetch test (`?employee=true`) → start attempt → submit → show results
- Navigation maintains state: handleBackToOverview, handleRetryTest
- Loading states and error handling for async operations

## Project Structure Details

### File Organization
```
src/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication routes
│   ├── (dashboard)/        # Protected dashboard routes
│   ├── api/                
│   │   ├── auth/          # NextAuth API route
│   │   └── trainings/     
│   │       └── [id]/      
│   │           └── pdf/   # PDF generation endpoint
│   └── globals.css        # Global styles with Tailwind directives
├── components/            
│   ├── ui/                # 40+ shadcn/ui components
│   ├── training/          # Training-specific components
│   │   ├── training-pdf-document.tsx  # PDF generator
│   │   ├── test-form.tsx             # Test interface
│   │   └── test-results.tsx          # Results display
│   ├── layout/            # App-wide layout components
│   │   ├── app-sidebar.tsx  # Sidebar: role-specific management + "Moje skoleni" for all roles
│   │   ├── header.tsx
│   │   ├── providers.tsx  # All context providers
│   │   └── ThemeToggle/   # Theme switching components
│   └── kbar/              # Command palette implementation
├── features/              # Feature-based modules
│   ├── prehled/          # Dashboard overview components
│   │   └── components/   
│   │       ├── bar-graph.tsx
│   │       ├── recent-sales.tsx
│   │       └── trainings-table.tsx
│   ├── products/         # Product management (deprecated,old)
│   └── profil/          # User profile
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
├── types/                # TypeScript type definitions
└── middleware.ts         # NextAuth middleware
```

### Styling System
- **Tailwind CSS v4** with PostCSS
- **CSS Variables** for theming in `app/theme.css`
- **cn() utility** for className merging from `lib/utils.ts`
- **CVA (class-variance-authority)** for component variants
- **Dark Mode** support via next-themes

### Performance Features
- **Turbopack** for fast development builds
- **React 19** with improved performance
- **Sharp** for optimized image processing
- **Parallel Routes** for independent component loading
- **nextjs-toploader** for page transition feedback

## Configuration Files

### Next.js Configuration (`next.config.ts`)
- Image optimization for remote patterns
- Sentry integration with source maps
- Transpiles `geist` package
- Monitoring route at `/monitoring` for Sentry

### TypeScript Configuration (`tsconfig.json`)
- Strict mode enabled
- Path aliases: `@/*` → `./src/*`, `~/*` → `./public/*`
- Target: ES2020
- Module resolution: Node

### Prisma Configuration
**Local Development (SQL Server)**:
- Database: Microsoft SQL Server Express 2019
- Port: 1433 (default SQL Server port)
- Database name: AeroLMS
- Authentication: Windows Integrated Security
- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Seed: `prisma/seed.js`

**Production (Corporate SQL Server)**:
- Database: Microsoft SQL Server (corporate network)
- Server: 10.235.1.8:1433
- Database name: Helios003
- Authentication: SQL Server Authentication (user: AeroLMS)
- Schema: `prisma/schema.prisma` (sdílené s lokálem)
- Migrations: **MANUÁLNÍ** - pouze SQL příkazy (bezpečnost)
- Seed: `prisma/seed.js` (sdílené s lokálem)
- **Důležité**: Databáze obsahuje další tabulky nesouvisející s projektem

### Tailwind Configuration
- Version 4.0 with PostCSS
- Animation utilities via `tailwindcss-animate`
- Custom theme variables in `app/theme.css`

## Environment Variables

### Local Development
Required in `.env.local`:
```
# Database - Microsoft SQL Server Express 2019
DATABASE_URL="sqlserver://localhost:1433;database=AeroLMS;trustServerCertificate=true;encrypt=true;integratedSecurity=true"

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=                 # Generate with: openssl rand -base64 32

# Sentry (Optional)
NEXT_PUBLIC_SENTRY_DSN=         # Sentry DSN for error tracking
NEXT_PUBLIC_SENTRY_ORG=         # Sentry organization
NEXT_PUBLIC_SENTRY_PROJECT=     # Sentry project name
NEXT_PUBLIC_SENTRY_DISABLED=    # Set to "true" to disable Sentry
```

### Corporate Server Production
Required in `.env.production` on production server:
```
# Database Provider - Set this FIRST
DB_PROVIDER="sqlserver"

# Database - Microsoft SQL Server (corporate network)
DATABASE_URL="sqlserver://10.235.1.8:1433;database=Helios003;user=AeroLMS;password=***;encrypt=true;trustServerCertificate=true"

# Authentication
NEXTAUTH_URL=http://10.235.1.8
NEXTAUTH_SECRET=                 # Generate secure secret

# Node Environment
NODE_ENV=production
PORT=3000

# Sentry (Optional - can be disabled on corporate server)
NEXT_PUBLIC_SENTRY_DISABLED=true

# File Storage (PDF uploads)
FILE_STORAGE_PATH=C:/AeroLMSFiles    # Absolute path on production server
FILE_MAX_SIZE_MB=200                 # Maximum file size in MB (default: 200)
```

**IMPORTANT:** The `C:/AeroLMSFiles` directory must exist on the production server with write permissions for the PM2 process user.

## Custom Hooks Available

The project includes several custom hooks in `src/hooks/`:
- `use-breadcrumbs.tsx` - Breadcrumb navigation management
- `use-callback-ref.ts` and `use-callback-ref.tsx` - Stable callback references (duplicate files)
- `use-controllable-state.tsx` - Controlled/uncontrolled state pattern
- `use-data-table.ts` - Data table state management
- `use-debounce.tsx` - Debounced values
- `use-debounced-callback.ts` - Debounced callbacks
- `use-media-query.ts` - Responsive design hooks
- `use-mobile.tsx` - Mobile device detection
- `use-multistep-form.tsx` - Multi-step form navigation

## Important Conventions

1. **TypeScript**: Strict mode enabled - ensure all types are properly defined
2. **Imports**: Use path aliases `@/*` for src directory, `~/*` for public
3. **Components**: Server components by default, add `"use client"` only when needed
4. **Authentication**: Always check session in protected routes
5. **Database**: Use Prisma transactions for multiple related operations
6. **Forms**: Always validate with Zod schemas before submission
7. **Styling**: Use Tailwind classes, avoid inline styles
8. **Icons**: Prefer Lucide React icons, fallback to Tabler Icons

## Package Management

### Scripts Overview
```json
{
  "dev": "next dev --turbopack",        // Development with Turbopack
  "build": "next build",                // Production build
  "start": "next start",                // Start production server
  "lint": "next lint",                  // ESLint check
  "lint:fix": "eslint src --fix && npm run format",  // Fix and format
  "lint:strict": "eslint --max-warnings=0 src",   // Strict linting
  "format": "prettier --write .",       // Format all files
  "format:check": "prettier -c -w .",   // Check formatting
  "prepare": "husky"                    // Setup git hooks
}
```

### Key Dependencies
- **UI Framework**: React 19 + Next.js 15.3.5
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Data**: Prisma + SQL Server
- **Forms**: React Hook Form + Zod
- **State**: Zustand + Nuqs
- **Tables**: Tanstack React Table
- **Charts**: Recharts
- **PDF Generation**: @react-pdf/renderer v4.3.0
- **Auth**: NextAuth v4

### Development Dependencies
- **@faker-js/faker v9**: Mock data generation
- **@prisma/client v6**: Database client
- **bcryptjs v3**: Password hashing (Note: Using bcryptjs not bcrypt)
- **TypeScript ESLint Plugin**: Type-aware linting
- **Husky v9**: Git hooks management
- **lint-staged v15**: Run linters on staged files
- **Prettier with Tailwind plugin**: Code formatting
- **tsx v4**: TypeScript execution for scripts

### Pre-commit Configuration
Lint-staged runs on staged files:
```json
{
  "**/*.{js,jsx,tsx,ts,css,less,scss,sass}": [
    "prettier --write --no-error-on-unmatched-pattern"
  ]
}
```

## Testing Approach

### E2E Testing with Playwright MCP
Use the Playwright MCP server for browser automation:
```javascript
// Example: Test login flow
mcp__playwright__browser_navigate({ url: "http://localhost:3000/login" })
mcp__playwright__browser_type({ element: "Employee Code input", text: "12345" })
mcp__playwright__browser_click({ element: "Sign in button" })

// Test training module navigation
mcp__playwright__browser_snapshot() // Get accessibility snapshot
mcp__playwright__browser_click({ element: "Training module link" })
mcp__playwright__browser_wait_for({ text: "Training Overview" })
```

### Unit Testing
Currently no test scripts configured. To add testing:
```bash
# Unit/Integration testing
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event jest-environment-jsdom

# E2E testing with Playwright (MCP server available)
npm install --save-dev @playwright/test
```

### Testing Patterns
- **Unit tests**: Co-locate with components as `*.test.ts(x)`
- **API tests**: In `app/api/**/*.test.ts`
- **E2E tests**: Use Playwright MCP for browser automation
- **Run single test file**: `npm test -- path/to/test.test.ts`
- **Run specific test by name**: `npm test -- -t "test name pattern"`
- **Debug tests**: `npm run test:watch` then press `p` to filter
- **Coverage report**: `npm test -- --coverage`

## Recent Changes & Fixes

### Security Hardening (January 2025)
1. **SQL Injection Fixes**:
   - Added pattern-based validation for dynamic training codes (alfanumerické znaky only)
   - Protected `training-sync.ts` functions using `$queryRawUnsafe`
   - Created `src/lib/validation-schemas.ts` with centralized validation
   - Critical for shared database (Helios003) containing other systems

2. **Input Validation Implementation**:
   - Zod schemas for all API endpoints
   - `validateRequestBody()` helper for consistent validation
   - `safeJsonParse()` for safe JSON parsing
   - Updated 4 critical API routes:
     - `/api/trainings/[id]/tests` (test creation)
     - `/api/test-attempts/[id]/submit` (answer submission)
     - `/api/trainings/[id]` (training updates)
     - `/api/test-attempts/manual` (manual test entry)

3. **Database Performance Optimization**:
   - Added 11 indexes across 5 tables in Prisma schema
   - Updated `deployment/sql/04_create_indexes.sql` with new indexes
   - Key indexes:
     - TestAttempt: `createdAt` (DESC) for recent attempts
     - Certificate: `certificateNumber` for fast lookups
     - Composite indexes for common queries (userId+testId)
   - Expected 50-80% performance improvement for common queries

### Deployment Simplification (January 2025)
1. **Two environments with same database technology**:
   - Local = SQL Server Express 2019 (localhost:1433, database: AeroLMS)
   - Production = Corporate SQL Server (10.235.1.8:1433, database: Helios003)
   - Shared schema and migrations
2. **Simplified scripts**:
   - `postinstall.js` - Just generates Prisma client
   - `build.js` - Simple Next.js build, no database operations
3. **Production database**:
   - Contains other tables not related to this project
   - Schema changes **ONLY via manual SQL commands** (security requirement)
   - No automatic Prisma migrations on production

### RBAC System Implementation
- Added role field to User model (ADMIN/TRAINER/WORKER)
- Created TrainingAssignment model for trainer assignments
- Automatic training synchronization from database columns
- Multiple tests per training support
- Dynamic content generation based on TabCisZam_EXT columns

### Unified Employee View (February 2025)
- Extended required training visibility to ALL roles (previously WORKER-only)
- ALL roles now land on `/` (personal training dashboard) - removed middleware redirects for ADMIN/TRAINER
- Sidebar shows "Moje skoleni" section for ALL roles (plus role-specific management sections)
- Test eligibility rules (first test in-person, 2 attempts, retake window) apply to ALL roles
- Added `?employee=true` param to `/api/trainings/[id]/tests` to separate employee vs management views
- `/api/trainings` (default) returns only required trainings for ALL roles
- Management views (`?admin=true`, `/trainer/*`) remain unchanged

## Common Pitfalls to Avoid

**Database Operations (CRITICAL - Read First):**

1. **Helios Table Modifications**
   - ❌ NEVER: Direct UPDATE/INSERT/DELETE on TabCisZam or TabCisZam_EXT
   - ❌ NEVER: Add columns to TabCisZam or TabCisZam_EXT from AeroLMS
   - ✅ ALWAYS: Use `updateUserTrainingData()` for training updates
   - **Why**: These tables are managed by Helios ERP system
   - **Risk**: Could corrupt payroll, HR, or manufacturing data

2. **Training Code Validation**
   - ❌ NEVER: Use dynamic training code without `validateTrainingCode()`
   - ❌ NEVER: String interpolation in raw SQL: `` `WHERE ${column} = ...` ``
   - ✅ ALWAYS: Validate pattern with `validateTrainingCode()` before raw SQL (alfanumerické znaky only)
   - ✅ ALWAYS: Use parameterized queries `@p0, @p1, @p2`
   - **Note**: Validation checks format only - training codes are dynamic (DB admin adds columns)
   - **Why**: Training codes become SQL column names
   - **Risk**: SQL injection exposing entire company database (Helios003 is shared)

3. **Underscore Prefix**
   - ❌ COMMON MISTAKE: Forgetting `_` prefix: `CMMDatumPosl`
   - ✅ CORRECT: All training columns have prefix: `_CMMDatumPosl`
   - **Symptoms**: "Invalid column name" errors in production
   - **Fix**: Always check database schema, not assumptions

4. **DatumPristi Auto-Calculation**
   - ❌ NEVER: Manually calculate or set DatumPristi to arbitrary date
   - ✅ CORRECT: Let database trigger calculate (+1 year from DatumPosl)
   - **Why**: Business rule enforced at database level
   - **Exception**: Can override in `updateUserTrainingData()` if needed

5. **Production Database Changes**
   - ❌ NEVER: `prisma migrate deploy` on production
   - ❌ NEVER: `DROP VIEW InspiritCisZam` then `CREATE VIEW`
   - ✅ ALWAYS: Use `CREATE OR ALTER VIEW` (preserves connections)
   - ✅ ALWAYS: Manual SQL scripts from `deployment/sql/`
   - ✅ ALWAYS: Test on local/staging first, backup before changes
   - **Why**: Helios003 is shared, has active connections, contains critical data

6. **Prisma Schema Assumptions**
   - ❌ WRONG: Expecting training columns in User model
   - ✅ CORRECT: Training columns accessed via raw SQL functions only
   - **Why**: Allows dynamic training addition without code rebuild
   - **Design**: Intentional omission from Prisma schema

**Application Development:**

7. **SQL Server Connection**
   - Uses Windows Authentication (Integrated Security) in development
   - Requires SQL Server Express 2019 running on localhost:1433
   - Database name must be "AeroLMS" (dev) or "Helios003" (prod)
   - Remember T-SQL syntax when writing raw queries

8. **Prisma Studio**
   - ❌ WRONG: `npx prisma studio` (missing DATABASE_URL)
   - ✅ CORRECT: `npx dotenv -e .env.local -- prisma studio`
   - **Why**: Loads correct environment variables

9. **View Pattern in Production**
   - Prisma queries User → SYNONYM → InspiritCisZam VIEW → 3 tables
   - INSTEAD OF triggers handle writes
   - Don't bypass this architecture

10. **Component Architecture**
    - Server components by default, `"use client"` only when needed
    - Database queries ONLY in server components or API routes
    - Employee code authentication is number-based, not string

11. **Other Considerations**
    - Parallel routes need independent error.tsx and loading.tsx
    - Zustand stores persist locally - consider privacy implications
    - React 19 compatibility - some libraries may have issues
    - Tailwind v4 uses different config format than v3
    - Run `npx prisma generate` after schema changes


## Key Patterns and Directives

### Component Development Patterns

**UI Components:**
- Use shadcn/ui components from `src/components/ui/`
- Access latest implementations via Shadcn MCP server
- Server components by default, add `"use client"` only when needed

**Form Handling:**
- React Hook Form + Zod validation pattern
- Schema definitions in `features/*/utils/form-schema.ts`
- Validate at API boundary, not in components

**Authentication:**
- Server components: Use `getServerSession(authOptions)`
- API routes: Check session first, return 401 if unauthorized
- Middleware: Handles route protection in `src/middleware.ts`

**Data Fetching:**
- Server components: Direct Prisma queries or fetch with cache
- Client components: SWR or React Query for client-side fetching
- API routes: Use Prisma client from `@/lib/prisma`

**Component Architecture:**
- Server Components (default): Data fetching, DB queries
- Client Components (`"use client"`): Interactivity, state, effects
- Never mix: Keep DB queries in server components only

## Database Troubleshooting

If Prisma cannot connect to SQL Server:

1. **Verify SQL Server is running**:
   - Open Services (services.msc)
   - Check "SQL Server (SQLEXPRESS)" or "SQL Server (MSSQLSERVER)" is running

2. **Check SQL Server Configuration**:
   - Open SQL Server Configuration Manager
   - Enable TCP/IP protocol if needed
   - Verify port 1433 is configured

3. **Test connection**:
   ```bash
   npx prisma db pull  # Test if Prisma can connect
   ```

4. **Create database if missing**:
   ```sql
   -- Run in SSMS or sqlcmd
   CREATE DATABASE AeroLMS;
   ```

## Code Style Standards

- **Functions**: Prefer arrow functions with annotated return types
- **Props**: Always destructure props in components
- **Types**: Avoid `any` type, use `unknown` or strict generics
- **Imports**: Group imports: react → next → libraries → local
- **Naming**: 
  - camelCase for variables/functions
  - PascalCase for components
  - UPPER_SNAKE_CASE for constants
- **Components**: Server Components by default, add `"use client"` only when needed


## Debugging Tips

- **Component not rendering?** Check if it needs `"use client"` directive
- **Auth issues?** Verify NextAuth session and employee code format
- **SQL Server connection failed?** Check if service is running and port 1433 is open
- **Prisma errors?** Run `npx prisma generate` after schema changes
- **Dark theme problems?** Check ThemeProvider wrapper in layout
- **TypeScript errors?** Run `npx tsc --noEmit` for detailed type checking
- **Parallel routes not loading?** Each needs its own error.tsx and loading.tsx
- **Route protection failing?** Check middleware.ts configuration

## Key Components for Training System

### Training Components
- **Training Client** (`app/(dashboard)/[[...node]]/training-client.tsx`): Main training interface with mode switching
  - Used by ALL roles (employee view) - same eligibility checks and test UI
  - Continuous content display (no collapsibles)
  - PDF download functionality with loading states
  - Enlarged action buttons with cursor pointer
  - Real-time database integration
  - Fetches tests with `?employee=true` param (only active tests)
- **Training PDF Document** (`components/training/training-pdf-document.tsx`): PDF generation component
  - Server-side rendering for PDF
  - Full Czech language support
  - Preserves all content types and formatting
- **Test Form** (`components/training/test-form.tsx`): Renders questions and handles answer submission
- **Test Results** (`components/training/test-results.tsx`): Displays scores and completion status
- **Trainings Table** (`features/prehled/components/trainings-table.tsx`): Lists all available trainings
  - Database-driven data display
  - Color-coded status indicators
  - "Neurčeno" text for undefined next dates

### Dashboard Components
- **Bar Graph** (`features/prehled/components/bar-graph.tsx`): Upcoming trainings by month
- **Recent Sales** (`features/prehled/components/recent-sales.tsx`): Last 5 completed trainings with status icons

### Supporting Features
- Dynamic URL-based routing for training modules
- Session-based authentication with employee codes
- Real-time progress tracking from database
- PDF export for training content
- Signature capture for test completion
- Automatic date tracking for training compliance
- Real-time statistics widgets on dashboard


### Quick Deployment Overview

#### Prerequisites
- Windows Server with IIS
- Node.js 22.x installed
- PM2 installed globally (`npm install -g pm2 pm2-windows-service`)
- Git installed
- SQL Server access (10.235.1.8:1433, database: Helios003)
- Internet access for Google Fonts during build (fonts.googleapis.com)

#### Deployment Steps

1. **Clone Repository**
   ```powershell
   cd C:\inetpub\wwwroot
   git clone https://github.com/inspiritenergy/AeroLMS.git
   cd AeroLMS
   ```

2. **Install Dependencies**
   ```powershell
   npm install  # Automatically runs postinstall.js
   ```

3. **Configure Environment**
   - Create `.env.production` with DATABASE_URL
   - Set NEXTAUTH_URL and NEXTAUTH_SECRET
   - Optional: Set NEXT_PUBLIC_SENTRY_DISABLED=true

4. **Build Application**
   ```powershell
   # Build with Sentry disabled (if needed)
   $env:NEXT_PUBLIC_SENTRY_DISABLED="true"
   npx next build
   ```

5. **Setup PM2**
   ```powershell
   # Start application
   pm2 start ecosystem.config.js

   # Install as Windows Service
   pm2-service-install -n PM2
   pm2 save
   ```

6. **Configure IIS**
   - Install URL Rewrite Module and ARR
   - Create website pointing to project folder
   - Configure reverse proxy to localhost:3000
   - `web.config` is already in the project

7. **Database Setup**
   - Apply schema changes **MANUALLY** via SQL commands
   - **NEVER** run `prisma migrate` on production
   - Test changes on local/staging first
   - Use SQL scripts from `deployment/sql/`

#### Updates

```powershell
# Stop application
pm2 stop aerolms

# Pull changes
git pull origin master

# Apply schema changes MANUALLY via SQL (if needed)
# Use deployment/sql/ scripts

# Rebuild
npx next build

# Restart
pm2 restart aerolms
pm2 status
```

#### ⚠️ Important Production Notes

1. **Database Schema Changes**:
   - Production database contains other tables not related to this project
   - All schema changes **MUST** be applied manually via SQL
   - **NO** automatic Prisma migrations on production
   - Reason: Security requirements + shared database

2. **Build Process**:
   - Requires internet access for Google Fonts
   - `npx next build` - safe, no database operations
   - `npm run build` - same as above (no longer does DB operations)

3. **PM2 Process Management**:
   - Application runs on port 3000
   - IIS acts as reverse proxy (port 80/443 → 3000)
   - PM2 service ensures app starts on server boot

4. **Monitoring**:
   - PM2 logs: `pm2 logs aerolms`
   - IIS logs: `C:\inetpub\logs\`
   - Database: SQL Server Management Studio

### Corporate Server Monitoring

- **Application Performance**: IIS logs and PM2 monitoring (`pm2 monit`)
- **Error Tracking**: Sentry (optional, can be disabled)
- **Database Monitoring**: SQL Server Management Studio
- **Application Logs**:
  - PM2 logs: `pm2 logs aerolms`
  - PM2 error log: `C:/inetpub/logs/AeroLMS/pm2-error.log`
  - PM2 out log: `C:/inetpub/logs/AeroLMS/pm2-out.log`
- **Process Status**: `pm2 status` shows running status, restarts, memory usage

## Important Reminders for Claude Code

- **Never create files** unless absolutely necessary for the task
- **Always prefer editing** existing files over creating new ones
- **Never proactively create** documentation files (*.md) unless explicitly requested
- **Use MCP tools** when available:
  - Context7 for library documentation
  - Playwright for browser testing
  - Sequential Thinking for complex problem solving
  - Shadcn for getting latest shadcn/ui component source code and demos
  - Basic Memory for persistent knowledge storage
- **Check existing patterns** before implementing new ones
- **Follow project conventions** for imports, naming, and structure
- **Run linting** after significant changes: `npm run lint:fix`