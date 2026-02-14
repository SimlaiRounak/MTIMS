# MTIMS — Multi-Tenant Inventory Management System

A SaaS platform where multiple businesses (tenants) manage inventory, suppliers, and orders independently with complete data isolation.

## Features

- **Multi-Tenant Architecture**: Row-level data isolation with automatic tenant scoping
- **Role-Based Access Control**: Owner / Manager / Staff roles per tenant
- **Complex Inventory**: Products with variants (size × color = multiple SKUs), each with independent stock tracking
- **Stock Movement Tracking**: Full audit trail for purchases, sales, returns, and adjustments
- **Smart Low-Stock Alerts**: Considers pending Purchase Orders before alerting
- **Purchase Order Workflow**: Draft → Sent → Confirmed → Partially Received → Received
- **Concurrent Order Handling**: Atomic stock operations prevent overselling
- **Real-Time Updates**: Socket.io-powered live dashboard and stock alerts
- **Dashboard & Analytics**: Inventory value, top sellers, stock movement graphs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Context API, React Router v6, Recharts, Socket.io Client |
| Backend | Node.js, Express, MongoDB, Mongoose, Socket.io |
| Auth | JWT (access tokens) |
| Real-time | Socket.io with tenant-scoped rooms |

## Setup Instructions

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/MTIMS.git
cd MTIMS
```

### 2. Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run seed    # Seeds 2 tenants with sample data
npm run dev     # Starts server on port 5000
```

### 3. Frontend Setup

```bash
cd client
npm install
cp .env.example .env
npm start       # Starts React app on port 3000
```

## Test Credentials

After running the seed script, use these credentials:

### Tenant 1 — "TechGear Electronics"
| Role | Email | Password |
|------|-------|----------|
| Owner | owner@techgear.com | password123 |
| Manager | manager@techgear.com | password123 |
| Staff | staff@techgear.com | password123 |

### Tenant 2 — "Fashion Hub"
| Role | Email | Password |
|------|-------|----------|
| Owner | owner@fashionhub.com | password123 |
| Manager | manager@fashionhub.com | password123 |
| Staff | staff@fashionhub.com | password123 |

## API Documentation

### Authentication
- `POST /api/auth/register` — Register new tenant + owner
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/auth/me` — Get current user

### Products & Variants
- `GET /api/products` — List products (paginated)
- `POST /api/products` — Create product with variants
- `GET /api/products/:id` — Get product with variants
- `PUT /api/products/:id` — Update product
- `DELETE /api/products/:id` — Delete product and variants
- `POST /api/products/:id/variants` — Add variant
- `PUT /api/variants/:id` — Update variant
- `DELETE /api/variants/:id` — Delete variant

### Stock Management
- `POST /api/stock/adjust` — Manual stock adjustment
- `GET /api/stock/movements` — List stock movements
- `GET /api/stock/low-stock` — Low stock alerts (considers pending POs)

### Orders
- `GET /api/orders` — List orders
- `POST /api/orders` — Create order (atomic stock deduction)
- `GET /api/orders/:id` — Get order details
- `PUT /api/orders/:id/status` — Update order status
- `POST /api/orders/:id/cancel` — Cancel order (restores stock)

### Suppliers
- `GET /api/suppliers` — List suppliers
- `POST /api/suppliers` — Create supplier
- `PUT /api/suppliers/:id` — Update supplier
- `DELETE /api/suppliers/:id` — Delete supplier

### Purchase Orders
- `GET /api/purchase-orders` — List POs
- `POST /api/purchase-orders` — Create PO
- `GET /api/purchase-orders/:id` — Get PO details
- `PUT /api/purchase-orders/:id/status` — Update PO status
- `POST /api/purchase-orders/:id/receive` — Receive delivery (partial supported)

### Dashboard
- `GET /api/dashboard/summary` — Inventory value, counts, alerts
- `GET /api/dashboard/top-sellers` — Top 5 products (30 days)
- `GET /api/dashboard/stock-movements` — Movement graph data (7 days)

## Project Structure

```
MTIMS/
├── server/
│   ├── src/
│   │   ├── config/         # DB connection, env config
│   │   ├── middleware/      # Auth, tenant scoping, error handling
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route handlers
│   │   ├── services/        # Business logic layer
│   │   ├── socket/          # Socket.io setup and handlers
│   │   ├── utils/           # Helpers, validators
│   │   └── app.js           # Express app setup
│   ├── seed.js              # Database seeder
│   └── index.js             # Entry point
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React Context providers
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   ├── hooks/           # Custom React hooks
│   │   └── App.js           # Root component
├── ARCHITECTURE.md           # Design decisions document
└── README.md
```

## Assumptions & Known Limitations

### Assumptions
- Single currency per tenant (no multi-currency support)
- Stock quantities are integers (no fractional units)
- A product must have at least one variant
- Tenant registration creates the Owner user automatically

### Known Limitations
- No refresh token rotation (JWT expires in 24h, must re-login)
- Dashboard cache is in-memory (not shared across server instances)
- No email notifications for PO status changes
- No bulk import/export of products
- No image upload for products (URL-based only)

## Time Breakdown

| Phase | Estimated Time |
|-------|---------------|
| Architecture & Planning | 1.5h |
| Backend: Auth & Tenant Setup | 2h |
| Backend: Products, Variants, Stock | 3h |
| Backend: Suppliers & Purchase Orders | 2.5h |
| Backend: Dashboard & Analytics | 1.5h |
| Frontend: Auth & Layout | 2h |
| Frontend: Inventory & Orders | 3h |
| Frontend: Dashboard & Real-time | 2h |
| Testing, Seeding & Polish | 1.5h |
| **Total** | **~19h** |
