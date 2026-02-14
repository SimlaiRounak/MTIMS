# MTIMS Architecture Document

## Table of Contents
1. [Multi-Tenancy Approach](#multi-tenancy-approach)
2. [Data Modeling Decisions](#data-modeling-decisions)
3. [Concurrency Handling](#concurrency-handling)
4. [Performance Optimization](#performance-optimization)
5. [Scalability Considerations](#scalability-considerations)
6. [Trade-offs Made](#trade-offs-made)

---

## 1. Multi-Tenancy Approach

### Chosen: Row-Level Isolation (Discriminator Column)

Every document in MongoDB includes a `tenantId` field. All queries are automatically scoped to the requesting tenant via middleware.

### Alternatives Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Separate Databases** | Strongest isolation, easy backup/restore per tenant, simple compliance | Expensive at scale (connection pool per DB), complex migrations, harder to manage 100+ tenants |
| **Schema-Based** | Good isolation, moderate cost | MongoDB doesn't natively support schemas like PostgreSQL; would require naming conventions (e.g., `tenant1_products`) |
| **Row-Level (Chosen)** | Single DB, simple deployment, easy cross-tenant analytics if needed, cost-effective | Requires discipline (every query must include tenantId), risk of data leakage if middleware fails |

### Why Row-Level?

1. **Cost-effective**: Single MongoDB instance/cluster serves all tenants
2. **Simpler operations**: One connection pool, one set of indexes, unified migrations
3. **MongoDB alignment**: MongoDB's document model with compound indexes (`tenantId` + other fields) performs well for this pattern
4. **Middleware enforcement**: A Mongoose plugin automatically injects `tenantId` into all queries, reducing human error
5. **Practical for the scale**: For a SaaS with hundreds of tenants, row-level is the industry standard (Shopify, Slack, etc.)

### Isolation Guarantees

- **Mongoose middleware** (`pre('find')`, `pre('save')`) automatically injects `tenantId`
- **API middleware** extracts tenant from JWT and attaches to request
- **Compound indexes** ensure queries are efficient per-tenant
- **No cross-tenant queries** are possible through the API layer

---

## 2. Data Modeling Decisions

### Product Variants Strategy

**Chosen: Separate Variant Documents linked to Parent Product**

```
Product (parent)
├── name, description, category, basePrice
└── variants[] (referenced)
    ├── Variant: { size: "S", color: "Red", sku: "TSH-S-RED", stock: 50 }
    ├── Variant: { size: "S", color: "Blue", sku: "TSH-S-BLU", stock: 30 }
    └── Variant: { size: "M", color: "Red", sku: "TSH-M-RED", stock: 0 }
```

**Why not embedded?**
- Variants need independent stock tracking, and atomic updates on nested arrays in MongoDB are complex
- Each variant is an independent SKU for ordering — referencing makes order line items cleaner
- With 9+ variants per product, embedded arrays become unwieldy for stock operations
- Separate documents allow direct indexing on `sku` and `stock` fields

**Why not fully independent products?**
- Variants share common attributes (name, description, images, category)
- Grouping provides better UX — users see "T-Shirt" with variant options, not 9 separate products
- Reporting needs both product-level and variant-level views

### Key Collections

```
tenants          - Business accounts
users            - Users with roles, linked to tenant
products         - Parent products (name, category, description)
variants         - Individual SKUs with stock levels
stockMovements   - Audit log of all stock changes
suppliers        - Vendor information per tenant
purchaseOrders   - PO header with status workflow
poLineItems      - Individual items in a PO
orders           - Sales orders with line items
```

### Indexing Strategy

```javascript
// Every collection: compound index starting with tenantId
{ tenantId: 1, _id: 1 }

// Variants: fast SKU lookup and low-stock queries
{ tenantId: 1, sku: 1 }           // unique per tenant
{ tenantId: 1, stock: 1 }         // low-stock alerts
{ tenantId: 1, productId: 1 }     // get variants for product

// Stock Movements: timeline queries
{ tenantId: 1, variantId: 1, createdAt: -1 }
{ tenantId: 1, type: 1, createdAt: -1 }

// Orders: dashboard queries
{ tenantId: 1, status: 1 }
{ tenantId: 1, createdAt: -1 }

// Purchase Orders: status tracking
{ tenantId: 1, status: 1 }
{ tenantId: 1, supplierId: 1 }
```

---

## 3. Concurrency Handling

### The "Last Item" Problem

**Scenario**: Two users try to order the last unit of a variant simultaneously.

**Solution: Atomic Conditional Update**

```javascript
// Instead of: read stock → check → update (race condition!)
// We use: atomic findOneAndUpdate with condition
const result = await Variant.findOneAndUpdate(
  { 
    _id: variantId, 
    tenantId: tenantId,
    stock: { $gte: requestedQuantity }  // Guard condition
  },
  { 
    $inc: { stock: -requestedQuantity },
    $set: { updatedAt: new Date() }
  },
  { new: true }
);

if (!result) {
  throw new Error('Insufficient stock');
}
```

**Why this works**: MongoDB's `findOneAndUpdate` is atomic at the document level. The `$gte` condition ensures stock can never go negative — if two requests race, only the first succeeds.

### Multi-Document Transactions

For operations spanning multiple collections (e.g., creating an order that decrements stock across multiple variants), we use **MongoDB transactions**:

```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // 1. Decrement stock for each variant (atomic per document)
  // 2. Create stock movement records
  // 3. Create order document
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

### Optimistic Concurrency for Purchase Orders

PO status transitions use a version field (`__v`) to prevent conflicting updates:

```javascript
const po = await PurchaseOrder.findOneAndUpdate(
  { _id: poId, __v: expectedVersion, status: 'Sent' },
  { $set: { status: 'Confirmed' }, $inc: { __v: 1 } }
);
if (!po) throw new Error('PO was modified by another user');
```

---

## 4. Performance Optimization

### Dashboard <2s Target with 10,000+ Products

1. **Aggregation pipelines** with `$match` on `tenantId` first (uses compound index)
2. **Pre-computed summaries**: Stock value is calculated via aggregation, not by summing all variants in application code
3. **Indexed queries**: All dashboard queries hit covered indexes where possible
4. **Pagination**: Product lists use cursor-based pagination (not skip/limit)
5. **Lean queries**: Using `.lean()` for read-only operations (skips Mongoose hydration, ~5x faster)
6. **Selective projection**: Only fetch needed fields — `{ name: 1, stock: 1, price: 1 }`

### Caching Strategy

- Dashboard data is cached for 30 seconds (in-memory) — prevents redundant aggregations
- Low-stock alerts are computed on demand but use efficient aggregation with index support

---

## 5. Scalability Considerations

### Horizontal Scaling

- **Stateless API servers**: JWT-based auth means no server-side sessions; any server can handle any request
- **MongoDB Atlas**: Sharding on `tenantId` would distribute data evenly if a single replica set becomes insufficient
- **Socket.io with Redis adapter**: Would allow WebSocket connections across multiple server instances

### Data Growth

- **Stock movements** grow fastest (audit log). Mitigation: TTL index for archiving old movements, or move to a time-series collection
- **Archival strategy**: Orders older than 1 year could be moved to a cold collection
- **Connection pooling**: Single pool serves all tenants (advantage of row-level isolation)

### Tenant Isolation at Scale

- **Rate limiting** per tenant prevents noisy neighbors
- **Query timeout**: MongoDB operations have a maxTimeMS to prevent long-running queries from one tenant affecting others

---

## 6. Trade-offs Made

| Decision | Trade-off | Reasoning |
|----------|-----------|-----------|
| Row-level vs separate DBs | Weaker isolation for simplicity | Acceptable for inventory management; not handling PHI/PCI data |
| Separate variant documents | Extra joins vs embedded simplicity | Stock operations on variants are the hottest path; they need atomic independence |
| MongoDB transactions | Performance cost (~30% slower) | Data integrity for orders is non-negotiable; only used where multi-doc consistency is required |
| JWT (no refresh tokens initially) | Simpler auth at cost of revocation | Added token expiry (24h); acceptable for MVP |
| In-memory cache vs Redis | Won't survive restarts, not shared across instances | Sufficient for single-instance deployment; Redis noted as scaling improvement |
| Socket.io over SSE | Heavier but bidirectional | Need bidirectional communication for stock alerts and real-time dashboard |
| Context API over Redux | Less boilerplate, sufficient for this scale | App state isn't deeply nested; Context + useReducer covers our needs |

### What I'd Improve

1. **Redis caching layer** for dashboard data and session management
2. **Elasticsearch** for full-text product search
3. **Event sourcing** for stock movements (immutable event log → materialized stock view)
4. **Background jobs** (Bull queue) for PO email notifications and report generation
5. **API rate limiting** per tenant with sliding window
6. **Comprehensive test suite** — unit tests for business logic, integration tests for API endpoints
7. **CI/CD pipeline** with automated testing before deployment
