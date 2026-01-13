# Montaz Medias CRM

A comprehensive Customer Relationship Management system built for Montaz Medias, a content production and social media management agency.

**Live URL**: [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID)

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (Lovable Cloud)
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v7
- **PDF Generation**: jsPDF
- **Charts**: Recharts
- **Drag & Drop**: @dnd-kit

---

## 📋 Features Implemented

### 🔐 Authentication
- Email-based authentication with Supabase Auth
- Protected routes for authenticated users
- Role-based access control (Admin, Sales, Strategy, Editor, Social Media)
- User profiles with avatar support

### 📊 Dashboard
- Overview statistics and KPIs
- Quick access to all modules
- Real-time data visualization

### 👥 Leads Management
- Lead capture and tracking
- Status workflow: New → Contacted → Qualified → Proposal Required → Disqualified
- Lead source tracking (Website, Instagram, Referral, Ads)
- Budget range and revenue range categorization
- Primary goals tracking (Visibility, Authority, Monetization)
- Social media links (Instagram, LinkedIn, YouTube)
- Assigned sales representative

### 📝 Proposals
- Create proposals linked to leads
- Plan types: Essential, Accelerator, Dominator
- Track proposal status: Draft → Sent → Accepted → Rejected
- Configure reels per month and shoot days
- Contract duration and monthly fee calculation
- Platform selection

### 👤 Clients
- Convert accepted proposals to clients
- Client status tracking: Active, Paused, At Risk, Completed
- Brand name and niche categorization
- Platform management
- Contract month tracking
- Account manager assignment

### 📄 Contracts
- **Contract Management**
  - Link contracts to clients
  - Duration tracking (months)
  - Monthly retainer amounts
  - Payment status: Paid, Pending, Overdue
  - Contract status: Active, Ending Soon, Renewed, Closed
  - Renewal probability tracking

- **PDF Generation** ✨
  - Professional 4-page contract documents
  - **Cover Page**: Company branding, client details, contract value
  - **Service Agreement**: Detailed service scope and client information
  - **Terms & Conditions**: Payment, cancellation, deliverables, confidentiality, revisions
  - **Signature Section**: Authorized signatory blocks for both parties
  - Matching Montaz Medias brand format

### 🎯 Strategy
- Monthly strategy planning per client
- Content pillars definition
- Platform priority setting
- Monthly reel targets
- Shoot days planning
- Brand positioning summaries
- Client availability notes
- Strategy status: Pending → Strategy Call Done → Approved

### 🎬 Shoots
- Schedule shoot days for clients
- Up to 3 shoot days per month
- Location tracking
- Reels planned per shoot
- Shoot status: Not Scheduled → Dates Fixed → Completed → Pending Client

### 🎥 Reels
- Track individual reel production
- Batch organization (Batch 1, Batch 2)
- Script status: Pending → Approved
- Edit status: Not Started → Editing → Ready for Review → Approved
- Priority levels (High, Normal)
- Editor assignment
- Month and reel number tracking
- **Workflow Validation**: Reels cannot move to 'editing' unless shoot is completed ✨
- **Ready for Publishing**: Automatic badge when batch has 15+ approved reels ✨

### 📅 Content Calendar
- Schedule posts across platforms
- Link reels to calendar entries
- Caption status tracking: Pending → Approved
- Posting status: Scheduled → Posted → Missed
- Post URL tracking
- **Posting Validation**: Cannot mark as "Posted" unless approved reels are ready ✨

### 🔄 Monthly Cycles
- Track monthly progress per client
- Reels metrics: Planned, Shot, Edited, Posted
- Client satisfaction tracking: Happy, Neutral, Risk
- Issues documentation
- Cycle status: Planned → In Production → Publishing Live → Completed
- **Cycle Delay Tracking**: Mark cycles as delayed with reason ✨
- **Completion Validation**: Cannot complete until reels_posted ≥ reels_planned ✨

### 👤 Owner Dashboard ✨
- Admin-only operational command center
- **Today's Shoots**: View and access scheduled shoots
- **Stuck Reels**: Identify reels in editing for 48+ hours
- **Posts Due Today**: Track content scheduled for posting
- **Missed Posts (Last 7 Days)**: Monitor posting failures
- **Ending Contracts**: Alert for contracts in final month
- **At Risk Clients**: Clients with health_status = 'risk'
- **Delayed Monthly Cycles**: Cycles past end date not completed

### 📁 Files
- File management and organization
- Upload capabilities

### ⚙️ Settings ✨ (Enhanced)
- **Team Management Tab**
  - View all team members with roles
  - Role badges with color coding
  - Invite new team members
  - Role assignment and management
  
- **Roles & Permissions Tab**
  - Define role-based access levels
  - Admin, Sales, Strategy, Editor, Social Media roles
  - Visual permission cards

- **Notifications Tab** ✨
  - Email notification preferences toggle
  - Granular notification controls:
    - Proposal Accepted
    - Shoot Scheduled
    - Editing Delays
    - Missed Posts
    - Contract Renewal
    - Client at Risk
  - Notification history/log with status indicators

- **Contracts Tab** ✨
  - **Company Branding**: Company name, tagline, contact details, address
  - **Bank & Tax Details**: Bank name, account number, IFSC code, GST number
  - **Contract Terms & Policies**: 
    - Payment terms
    - Cancellation policy
    - Deliverables
    - Confidentiality clause
    - Revision policy
  - **Preview Contract**: Download sample PDF with current settings

- **Preferences Tab**
  - Date format selection
  - Currency selection (INR, USD, EUR)
  - First day of week preference
  - Theme toggle (Light/Dark mode)

### 📧 Email Notifications System ✨ (NEW)
- **Database Tables**
  - `email_notifications`: Stores all notification records
  - `user_notification_preferences`: User-specific notification settings

- **Edge Function**: `send-notifications`
  - Processes pending notifications
  - Integrates with Resend API for email delivery
  - Tracks sent/failed status

- **Notification Types**
  - Proposal accepted alerts
  - Shoot scheduled reminders
  - Editing delay warnings
  - Missed post notifications
  - Contract renewal alerts
  - Client at-risk warnings

### 📱 Mobile Responsiveness ✨ (NEW)
- **Fully Responsive Design** across all pages
- **Adaptive Layouts**
  - Sidebar collapses on mobile
  - Tables with horizontal scroll
  - Stacked layouts for forms
  - Touch-friendly buttons and controls

- **Settings Page Mobile Optimization**
  - Team table with hidden columns and compact display
  - Abbreviated role badges on mobile
  - Stacked notification toggles
  - Full-width buttons on small screens
  - Responsive grid layouts (1-col → 2-col → 3-col)

- **Pull-to-Refresh Support**
  - Custom `PullToRefreshWrapper` component
  - `usePullToRefresh` hook for data refresh

---

## 🗄️ Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `profiles` | User profile information |
| `user_roles` | Role assignments for users |
| `user_notification_preferences` | User notification settings ✨ |
| `email_notifications` | Notification history and queue ✨ |
| `leads` | Potential client information |
| `proposals` | Proposal documents for leads |
| `clients` | Active client records |
| `contracts` | Client contract details |
| `strategies` | Monthly content strategies |
| `shoots` | Scheduled shoot sessions |
| `reels` | Individual reel tracking |
| `content_calendar` | Content scheduling |
| `monthly_cycles` | Monthly progress tracking |

### Enums
- **Roles**: admin, sales, strategy, editor, social_media
- **Lead Status**: new, contacted, qualified, proposal_required, disqualified
- **Plan Types**: essential, accelerator, dominator
- **Client Status**: active, paused, at_risk, completed
- **Contract Status**: active, ending_soon, renewed, closed
- **Payment Status**: paid, pending, overdue

---

## 🛠️ Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # App layout components
│   │   ├── AppLayout.tsx
│   │   └── AppSidebar.tsx
│   ├── shared/          # Reusable components
│   │   ├── DataTable.tsx
│   │   ├── KanbanBoard.tsx
│   │   ├── StatsCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── HealthBadge.tsx          # Client health indicator
│   │   ├── ContractWarningBadge.tsx # Contract expiry alerts
│   │   ├── DelayedCycleBadge.tsx    # Delayed cycle indicator
│   │   ├── ValidationMessage.tsx    # Form validation messages
│   │   ├── FileUpload.tsx
│   │   └── PullToRefreshWrapper.tsx # ✨ Mobile pull-to-refresh
│   ├── calendar/        # Calendar components
│   ├── clients/         # Client form dialogs
│   ├── contracts/       # Contract form dialogs
│   ├── cycles/          # Cycle form dialogs
│   ├── leads/           # Lead form dialogs
│   ├── proposals/       # Proposal form dialogs
│   ├── reels/           # Reel form dialogs
│   ├── shoots/          # Shoot form dialogs
│   └── strategy/        # Strategy form dialogs
├── hooks/
│   ├── useAuth.tsx              # Authentication hook
│   ├── useWorkflowValidation.ts # Workflow validation logic
│   ├── usePullToRefresh.tsx     # ✨ Pull-to-refresh hook
│   ├── use-toast.ts             # Toast notifications
│   └── use-mobile.tsx           # Mobile detection
├── integrations/
│   └── supabase/        # Supabase client and types
├── lib/
│   ├── utils.ts         # Utility functions
│   └── contractPdfGenerator.ts  # PDF generation logic
├── pages/
│   ├── Dashboard.tsx
│   ├── OwnerDashboard.tsx       # Admin operational dashboard
│   ├── Leads.tsx
│   ├── Proposals.tsx
│   ├── Clients.tsx
│   ├── Contracts.tsx
│   ├── Strategy.tsx
│   ├── Shoots.tsx
│   ├── Reels.tsx
│   ├── Calendar.tsx
│   ├── Cycles.tsx
│   ├── Files.tsx
│   ├── Settings.tsx             # ✨ Enhanced with 5 tabs
│   ├── Auth.tsx
│   └── NotFound.tsx
├── types/
│   └── crm.ts           # TypeScript type definitions
└── main.tsx             # App entry point

supabase/
├── config.toml          # Supabase configuration
├── functions/
│   └── send-notifications/  # ✨ Email notification edge function
│       └── index.ts
└── migrations/          # Database migrations
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Backend integration |
| `@tanstack/react-query` | Server state management |
| `react-router-dom` | Client-side routing |
| `jspdf` | PDF document generation |
| `recharts` | Data visualization |
| `@dnd-kit/core` | Drag and drop functionality |
| `date-fns` | Date manipulation |
| `lucide-react` | Icon library |
| `zod` | Schema validation |
| `react-hook-form` | Form handling |
| `sonner` | Toast notifications |

---

## 🎨 UI Components

Built with **shadcn/ui** including:
- Data Tables with sorting and filtering
- Form dialogs for all entities
- Status badges with color coding
- Stats cards for metrics
- Kanban boards for visual workflow
- Toast notifications
- Date pickers
- Select dropdowns
- Tabs for organized content
- Switches for toggle preferences
- Cards for grouped content
- And more...

---

## 🔒 Security

- Row Level Security (RLS) policies on all tables
- Role-based access control
- Secure authentication via Supabase Auth
- Protected API routes
- **Anonymous Access Denial**: Explicit RLS policies to block unauthenticated access
- **Data Protection**: All sensitive tables protected with restrictive policies
- **Security Definer Functions**: `has_role()` and `has_any_role()` for secure role checks

---

## 🔄 Workflow Hardening

### Validation Rules
| Rule | Description |
|------|-------------|
| Shoot → Editing | Reels can only move to 'editing' after shoot is 'completed' |
| Editing → Posting | Posts can only be marked 'posted' when approved reels are ready |
| Cycle Completion | Cycles can only be 'completed' when reels_posted ≥ reels_planned |
| Batch Publishing | Automatically marks reels ready when 15+ approved in batch |

### Health & Warning Indicators
| Indicator | Description |
|-----------|-------------|
| Client Health | Calculated based on missed posts, pending shoots, incomplete cycles |
| Contract Warning | Visual alerts when contract is in final month |
| Delayed Cycle | Badge showing cycles past end date with delay reason |

### Shared Components
- `HealthBadge`: Visual health status indicator (good/watch/risk)
- `ContractWarningBadge`: Contract expiry alerts (warning/critical)
- `DelayedCycleBadge`: Delayed cycle indicator with tooltip
- `ValidationMessage`: Contextual error/warning/info messages
- `StatusBadge`: Generic status display component
- `PullToRefreshWrapper`: Mobile pull-to-refresh functionality

### Custom Hooks
- `useWorkflowValidation`: Centralized validation logic for all workflow rules
- `useAuth`: Authentication state and role checking
- `usePullToRefresh`: Mobile pull-to-refresh gesture handling
- `useMobile`: Mobile device detection

---

## 📱 Mobile Support

The application is fully responsive with:
- **Collapsible Sidebar**: Hamburger menu on mobile devices
- **Responsive Tables**: Horizontal scroll with hidden columns on small screens
- **Stacked Forms**: Form fields stack vertically on mobile
- **Touch-Friendly**: Larger tap targets for mobile users
- **Pull-to-Refresh**: Native-like refresh gesture support
- **Adaptive Typography**: Text sizes adjust based on screen width

---

## 📄 License

This project is proprietary software for Montaz Medias.

---

## 🤝 Contributing

1. Make changes via [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID)
2. Or clone, modify locally, and push to GitHub
3. Changes sync automatically between Lovable and GitHub

---

Built with ❤️ using [Lovable](https://lovable.dev)
