const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MTIMS API',
      version: '1.0.0',
      description:
        'Multi-Tenant Inventory Management System REST API documentation.',
      contact: {
        name: 'MTIMS Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API base path',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /auth/login or /auth/register',
        },
      },
      schemas: {
        // ---------- Pagination ----------
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 5 },
          },
        },

        // ---------- Error ----------
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  msg: { type: 'string' },
                  param: { type: 'string' },
                  location: { type: 'string' },
                },
              },
            },
          },
        },

        // ---------- Tenant ----------
        Tenant: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'Acme Corp' },
            slug: { type: 'string', example: 'acme-corp' },
            isActive: { type: 'boolean', example: true },
            settings: {
              type: 'object',
              properties: {
                currency: { type: 'string', example: 'USD' },
                lowStockThreshold: { type: 'integer', example: 10 },
                timezone: { type: 'string', example: 'UTC' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- User ----------
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d2' },
            tenantId: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@acme.com' },
            role: { type: 'string', enum: ['owner', 'manager', 'staff'], example: 'owner' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['owner', 'manager', 'staff'] },
            tenantId: { type: 'string' },
            tenantName: { type: 'string' },
            permissions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },

        // ---------- Product ----------
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            name: { type: 'string', example: 'T-Shirt' },
            description: { type: 'string', example: 'Cotton T-Shirt' },
            category: { type: 'string', example: 'Apparel' },
            basePrice: { type: 'number', example: 19.99 },
            imageUrl: { type: 'string' },
            variantAttributes: {
              type: 'array',
              items: { type: 'string' },
              example: ['size', 'color'],
            },
            isActive: { type: 'boolean', example: true },
            variants: {
              type: 'array',
              items: { $ref: '#/components/schemas/Variant' },
            },
            totalStock: { type: 'integer', example: 150 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Variant ----------
        Variant: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            productId: { type: 'string' },
            sku: { type: 'string', example: 'TSHIRT-RED-L' },
            attributes: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: { size: 'L', color: 'Red' },
            },
            price: { type: 'number', example: 19.99 },
            costPrice: { type: 'number', example: 8.5 },
            stock: { type: 'integer', example: 50 },
            lowStockThreshold: { type: 'integer', example: 10 },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Order ----------
        OrderLineItem: {
          type: 'object',
          properties: {
            variantId: { type: 'string' },
            productId: { type: 'string' },
            productName: { type: 'string' },
            variantSku: { type: 'string' },
            quantity: { type: 'integer', example: 2 },
            unitPrice: { type: 'number', example: 19.99 },
            total: { type: 'number', example: 39.98 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            orderNumber: { type: 'string', example: 'ORD-20260214-A1B2' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
              example: 'pending',
            },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderLineItem' },
            },
            totalAmount: { type: 'number', example: 79.96 },
            customerName: { type: 'string', example: 'Jane Smith' },
            customerEmail: { type: 'string', format: 'email' },
            notes: { type: 'string' },
            createdBy: { type: 'string' },
            cancelledAt: { type: 'string', format: 'date-time' },
            cancelReason: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Supplier ----------
        Supplier: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            name: { type: 'string', example: 'GlobalTex Supplies' },
            contactPerson: { type: 'string', example: 'Bob Lee' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', example: '+1-555-1234' },
            address: { type: 'string' },
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  variantId: { type: 'string' },
                  unitPrice: { type: 'number' },
                  leadTimeDays: { type: 'integer', example: 7 },
                },
              },
            },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Purchase Order ----------
        POLineItem: {
          type: 'object',
          properties: {
            variantId: { type: 'string' },
            productId: { type: 'string' },
            quantityOrdered: { type: 'integer', example: 100 },
            quantityReceived: { type: 'integer', example: 0 },
            unitPrice: { type: 'number', example: 8.5 },
            actualUnitPrice: { type: 'number', example: 8.75 },
          },
        },
        PurchaseOrder: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            poNumber: { type: 'string', example: 'PO-20260214-X1Y2' },
            supplierId: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'],
              example: 'draft',
            },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/POLineItem' },
            },
            totalAmount: { type: 'number', example: 850 },
            expectedDeliveryDate: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Stock Movement ----------
        StockMovement: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            variantId: { type: 'string' },
            productId: { type: 'string' },
            type: {
              type: 'string',
              enum: ['purchase', 'sale', 'return', 'adjustment'],
              example: 'sale',
            },
            quantity: { type: 'integer', example: -5 },
            previousStock: { type: 'integer', example: 55 },
            newStock: { type: 'integer', example: 50 },
            reference: { type: 'string', example: 'Order ORD-20260214-A1B2' },
            referenceId: { type: 'string' },
            notes: { type: 'string' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Role Permission ----------
        RolePermission: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            tenantId: { type: 'string' },
            role: { type: 'string', enum: ['manager', 'staff'] },
            permissions: {
              type: 'array',
              items: { type: 'string' },
              example: ['products.view', 'orders.view', 'orders.create'],
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // ---------- Low Stock Alert ----------
        LowStockAlert: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            sku: { type: 'string' },
            stock: { type: 'integer' },
            lowStockThreshold: { type: 'integer' },
            pendingPOQuantity: { type: 'integer' },
            effectiveStock: { type: 'integer' },
            severity: { type: 'string', enum: ['critical', 'warning'] },
            message: { type: 'string' },
            productId: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                name: { type: 'string' },
                category: { type: 'string' },
              },
            },
          },
        },

        // ---------- Dashboard ----------
        DashboardSummary: {
          type: 'object',
          properties: {
            inventory: {
              type: 'object',
              properties: {
                totalProducts: { type: 'integer' },
                totalVariants: { type: 'integer' },
                totalStock: { type: 'integer' },
                totalValue: { type: 'number' },
                totalCostValue: { type: 'number' },
              },
            },
            orders: {
              type: 'object',
              properties: {
                totalOrders: { type: 'integer' },
                totalRevenue: { type: 'number' },
                byStatus: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      count: { type: 'integer' },
                      amount: { type: 'number' },
                    },
                  },
                },
              },
            },
            alerts: {
              type: 'object',
              properties: {
                lowStockItems: { type: 'integer' },
                pendingPurchaseOrders: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & user registration' },
      { name: 'Users', description: 'User management (owner/manager)' },
      { name: 'Products', description: 'Product & variant CRUD' },
      { name: 'Orders', description: 'Sales order management' },
      { name: 'Suppliers', description: 'Supplier management' },
      { name: 'Purchase Orders', description: 'Purchase order workflow' },
      { name: 'Stock', description: 'Stock adjustments & movements' },
      { name: 'Dashboard', description: 'Analytics & summary data' },
      { name: 'Roles', description: 'Role-based permission management' },
    ],
  },
  apis: ['./src/routes/*.js', './src/app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
