const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { PurchaseOrder, Variant, StockMovement } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler, generateOrderNumber } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /purchase-orders:
 *   get:
 *     summary: List purchase orders with pagination
 *     tags: [Purchase Orders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, confirmed, partially_received, received, cancelled]
 *       - in: query
 *         name: supplierId
 *         schema:
 *           type: string
 *         description: Filter by supplier ID
 *     responses:
 *       200:
 *         description: Paginated list of purchase orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchaseOrders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PurchaseOrder'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
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

/**
 * @swagger
 * /purchase-orders/{id}:
 *   get:
 *     summary: Get a single purchase order by ID
 *     tags: [Purchase Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase Order ID
 *     responses:
 *       200:
 *         description: Purchase order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchaseOrder:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       404:
 *         description: Purchase order not found
 */
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

/**
 * @swagger
 * /purchase-orders:
 *   post:
 *     summary: Create a purchase order (owner/manager only)
 *     tags: [Purchase Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, items]
 *             properties:
 *               supplierId:
 *                 type: string
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [variantId, productId, quantityOrdered, unitPrice]
 *                   properties:
 *                     variantId:
 *                       type: string
 *                     productId:
 *                       type: string
 *                     quantityOrdered:
 *                       type: integer
 *                       minimum: 1
 *                     unitPrice:
 *                       type: number
 *                       minimum: 0
 *               expectedDeliveryDate:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Purchase order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchaseOrder:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  auth,
  authorize('owner', 'manager'),
  [
    body('supplierId').notEmpty().withMessage('Please select a supplier'),
    body('items').isArray({ min: 1 }).withMessage('Please add at least one item'),
    body('items.*.variantId').notEmpty().withMessage('Please select a product variant for each item'),
    body('items.*.productId').notEmpty().withMessage('Please select a product for each item'),
    body('items.*.quantityOrdered').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price cannot be negative'),
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

/**
 * @swagger
 * /purchase-orders/{id}/status:
 *   put:
 *     summary: Update purchase order status (owner/manager only)
 *     tags: [Purchase Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [sent, confirmed, cancelled]
 *     responses:
 *       200:
 *         description: Purchase order status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchaseOrder:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Purchase order not found
 */
router.put(
  '/:id/status',
  auth,
  authorize('owner', 'manager'),
  [body('status').isIn(['sent', 'confirmed', 'cancelled']).withMessage('Please select a valid status')],
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

/**
 * @swagger
 * /purchase-orders/{id}/receive:
 *   post:
 *     summary: Receive a delivery for a purchase order (partial supported, owner/manager only)
 *     tags: [Purchase Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Purchase Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [variantId, quantityReceived]
 *                   properties:
 *                     variantId:
 *                       type: string
 *                     quantityReceived:
 *                       type: integer
 *                       minimum: 1
 *                     actualUnitPrice:
 *                       type: number
 *                       minimum: 0
 *     responses:
 *       200:
 *         description: Delivery received, stock updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchaseOrder:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         description: Exceeds ordered quantity or validation error
 *       404:
 *         description: PO not found or not in receivable status
 */
router.post(
  '/:id/receive',
  auth,
  authorize('owner', 'manager'),
  [
    body('items').isArray({ min: 1 }).withMessage('Please select at least one item to receive'),
    body('items.*.variantId').notEmpty().withMessage('Please select a product variant for each item'),
    body('items.*.quantityReceived').isInt({ min: 1 }).withMessage('Received quantity must be at least 1'),
    body('items.*.actualUnitPrice').optional().isFloat({ min: 0 }).withMessage('Actual unit price cannot be negative'),
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
          throw new AppError('One of the received items does not belong to this purchase order', 400);
        }

        const remainingToReceive = poItem.quantityOrdered - poItem.quantityReceived;
        if (received.quantityReceived > remainingToReceive) {
          throw new AppError(
            `Cannot receive ${received.quantityReceived} units — only ${remainingToReceive} remaining to be received`,
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
