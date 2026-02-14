const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { PurchaseOrder, Variant, StockMovement } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler, generateOrderNumber } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/purchase-orders
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, supplierId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { tenantId: req.tenantId };
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;

    const [purchaseOrders, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('supplierId', 'name')
        .populate('createdBy', 'name')
        .populate('items.variantId', 'sku attributes')
        .populate('items.productId', 'name')
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);

    res.json({
      purchaseOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

// GET /api/purchase-orders/:id
router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('supplierId', 'name contactPerson email phone')
      .populate('createdBy', 'name email')
      .populate('items.variantId', 'sku attributes stock price')
      .populate('items.productId', 'name')
      .lean();

    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    res.json({ purchaseOrder: po });
  })
);

// POST /api/purchase-orders - Create PO
router.post(
  '/',
  auth,
  authorize('owner', 'manager'),
  [
    body('supplierId').notEmpty().withMessage('Supplier is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.variantId').notEmpty().withMessage('Variant ID is required'),
    body('items.*.productId').notEmpty().withMessage('Product ID is required'),
    body('items.*.quantityOrdered').isInt({ min: 1 }).withMessage('Quantity must be >= 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be >= 0'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { supplierId, items, expectedDeliveryDate, notes } = req.body;

    const po = await PurchaseOrder.create({
      tenantId: req.tenantId,
      poNumber: generateOrderNumber('PO'),
      supplierId,
      items: items.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        unitPrice: item.unitPrice,
      })),
      expectedDeliveryDate,
      notes,
      createdBy: req.user._id,
    });

    const populated = await PurchaseOrder.findById(po._id)
      .populate('supplierId', 'name')
      .populate('items.variantId', 'sku attributes')
      .populate('items.productId', 'name')
      .lean();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('po:created', { purchaseOrder: populated });
    }

    res.status(201).json({ purchaseOrder: populated });
  })
);

// PUT /api/purchase-orders/:id/status - Update PO status
router.put(
  '/:id/status',
  auth,
  authorize('owner', 'manager'),
  [body('status').isIn(['sent', 'confirmed', 'cancelled']).withMessage('Invalid status transition')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!po) {
      throw new AppError('Purchase order not found', 404);
    }

    // Validate status transitions
    const validTransitions = {
      draft: ['sent', 'cancelled'],
      sent: ['confirmed', 'cancelled'],
      confirmed: ['cancelled'],
      partially_received: ['cancelled'],
    };

    const allowed = validTransitions[po.status] || [];
    if (!allowed.includes(req.body.status)) {
      throw new AppError(
        `Cannot transition from '${po.status}' to '${req.body.status}'`,
        400
      );
    }

    po.status = req.body.status;
    await po.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('po:updated', { purchaseOrder: po });
    }

    res.json({ purchaseOrder: po });
  })
);

// POST /api/purchase-orders/:id/receive - Receive delivery (partial supported)
router.post(
  '/:id/receive',
  auth,
  authorize('owner', 'manager'),
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item to receive'),
    body('items.*.variantId').notEmpty(),
    body('items.*.quantityReceived').isInt({ min: 1 }),
    body('items.*.actualUnitPrice').optional().isFloat({ min: 0 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const po = await PurchaseOrder.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
        status: { $in: ['confirmed', 'partially_received'] },
      }).session(session);

      if (!po) {
        throw new AppError('PO not found or not in receivable status', 404);
      }

      const { items: receivedItems } = req.body;
      const stockMovements = [];

      for (const received of receivedItems) {
        const poItem = po.items.find(
          (i) => i.variantId.toString() === received.variantId
        );

        if (!poItem) {
          throw new AppError(`Variant ${received.variantId} not in this PO`, 400);
        }

        const remainingToReceive = poItem.quantityOrdered - poItem.quantityReceived;
        if (received.quantityReceived > remainingToReceive) {
          throw new AppError(
            `Cannot receive ${received.quantityReceived} for variant ${received.variantId}. Only ${remainingToReceive} remaining.`,
            400
          );
        }

        // Update PO line item
        poItem.quantityReceived += received.quantityReceived;
        if (received.actualUnitPrice !== undefined) {
          poItem.actualUnitPrice = received.actualUnitPrice;
        }

        // Update variant stock
        const variant = await Variant.findOneAndUpdate(
          { _id: received.variantId, tenantId: req.tenantId },
          { $inc: { stock: received.quantityReceived } },
          { new: true, session }
        );

        if (variant) {
          stockMovements.push({
            tenantId: req.tenantId,
            variantId: variant._id,
            productId: variant.productId,
            type: 'purchase',
            quantity: received.quantityReceived,
            previousStock: variant.stock - received.quantityReceived,
            newStock: variant.stock,
            reference: `PO ${po.poNumber}`,
            referenceId: po._id,
            createdBy: req.user._id,
          });
        }
      }

      // Check if all items fully received
      const allReceived = po.items.every(
        (item) => item.quantityReceived >= item.quantityOrdered
      );
      po.status = allReceived ? 'received' : 'partially_received';

      await po.save({ session });
      await StockMovement.create(stockMovements, { session });

      await session.commitTransaction();

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${req.tenantId}`).emit('po:received', { purchaseOrder: po });
        // Emit stock updates
        for (const sm of stockMovements) {
          io.to(`tenant:${req.tenantId}`).emit('stock:updated', {
            variantId: sm.variantId,
            stock: sm.newStock,
          });
        }
      }

      res.json({ purchaseOrder: po });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  })
);

module.exports = router;
