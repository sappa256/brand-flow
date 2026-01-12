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

### 📅 Content Calendar
- Schedule posts across platforms
- Link reels to calendar entries
- Caption status tracking: Pending → Approved
- Posting status: Scheduled → Posted → Missed
- Post URL tracking

### 🔄 Monthly Cycles
- Track monthly progress per client
- Reels metrics: Planned, Shot, Edited, Posted
- Client satisfaction tracking: Happy, Neutral, Risk
- Issues documentation
- Cycle status: Planned → In Production → Publishing Live → Completed

### 📁 Files
- File management and organization
- Upload capabilities

### ⚙️ Settings
- **General Settings**
  - User profile management
  - Theme preferences

- **Notifications**
  - Email and push notification preferences

- **Security**
  - Password management
  - Two-factor authentication options

- **Contract Settings** ✨
  - **Company Branding**: Company name, tagline, contact details, address
  - **Bank & Tax Details**: Bank name, account number, IFSC code, GST number
  - **Contract Terms & Policies**: 
    - Payment terms
    - Cancellation policy
    - Deliverables
    - Confidentiality clause
    - Revision policy
  - **Preview Contract**: Download sample PDF with current settings

---

## 🗄️ Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `profiles` | User profile information |
| `user_roles` | Role assignments for users |
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
│   ├── shared/          # Reusable components (DataTable, KanbanBoard, etc.)
│   ├── calendar/        # Calendar components
│   ├── clients/         # Client form dialogs
│   ├── contracts/       # Contract form dialogs
│   ├── cycles/          # Cycle form dialogs
│   ├── leads/           # Lead form dialogs
│   ├── proposals/       # Proposal form dialogs
│   ├── reels/           # Reel form dialogs
│   ├── shoots/          # Shoot form dialogs
│   └── strategy/        # Strategy form dialogs
├── hooks/               # Custom React hooks
├── integrations/
│   └── supabase/        # Supabase client and types
├── lib/
│   ├── utils.ts         # Utility functions
│   └── contractPdfGenerator.ts  # PDF generation logic
├── pages/               # Route pages
├── types/
│   └── crm.ts           # TypeScript type definitions
└── main.tsx             # App entry point
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
- And more...

---

## 🔒 Security

- Row Level Security (RLS) policies on all tables
- Role-based access control
- Secure authentication via Supabase Auth
- Protected API routes

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
