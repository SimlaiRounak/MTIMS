const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { Order, Variant, StockMovement } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler, generateOrderNumber } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List orders with pagination and filters
 *     tags: [Orders]
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
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders created on or after this date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders created on or before this date
 *     responses:
 *       200:
 *         description: A paginated list of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { tenantId: req.tenantId };
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name')
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      orders,
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
 * /orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 */
router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('createdBy', 'name email')
      .lean();

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.json({ order });
  })
);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create a new order (deducts stock atomically)
 *     tags: [Orders]
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
 *                   required: [variantId, quantity]
 *                   properties:
 *                     variantId:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *               customerName:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *                 format: email
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error or insufficient stock
 *       404:
 *         description: Variant not found
 */
router.post(
  '/',
  auth,
  [
    body('items').isArray({ min: 1 }).withMessage('Please add at least one item to the order'),
    body('items.*.variantId').notEmpty().withMessage('Please select a product variant for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('customerName').optional().trim(),
    body('customerEmail').optional().isEmail().withMessage('Please enter a valid email address'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { items, customerName, customerEmail, notes } = req.body;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const orderItems = [];
      const stockMovements = [];

      for (const item of items) {
        // Atomic conditional update — prevents overselling
        const variant = await Variant.findOneAndUpdate(
          {
            _id: item.variantId,
            tenantId: req.tenantId,
            stock: { $gte: item.quantity },
          },
          { $inc: { stock: -item.quantity } },
          { new: true, session }
        );

        if (!variant) {
          // Check if variant exists at all
          const exists = await Variant.findOne({
            _id: item.variantId,
            tenantId: req.tenantId,
          }).session(session);

          if (!exists) {
            throw new AppError(`Variant ${item.variantId} not found`, 404);
          }
          throw new AppError(
            `Insufficient stock for ${exists.sku}. Available: ${exists.stock}, Requested: ${item.quantity}`,
            400
          );
        }

        // Get product info for denormalized order data
        const Product = require('../models/Product');
        const product = await Product.findById(variant.productId).session(session);

        orderItems.push({
          variantId: variant._id,
          productId: variant.productId,
          productName: product?.name || 'Unknown',
          variantSku: variant.sku,
          quantity: item.quantity,
          unitPrice: variant.price,
          total: variant.price * item.quantity,
        });

        stockMovements.push({
          tenantId: req.tenantId,
          variantId: variant._id,
          productId: variant.productId,
          type: 'sale',
          quantity: -item.quantity,
          previousStock: variant.stock + item.quantity,
          newStock: variant.stock,
          createdBy: req.user._id,
        });
      }

      const totalAmount = orderItems.reduce((sum, item) => sum + item.total, 0);

      const [order] = await Order.create(
        [
          {
            tenantId: req.tenantId,
            orderNumber: generateOrderNumber('ORD'),
            items: orderItems,
            totalAmount,
            customerName,
            customerEmail,
            notes,
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      // Record stock movements with order reference
      const movements = stockMovements.map((m) => ({
        ...m,
        reference: `Order ${order.orderNumber}`,
        referenceId: order._id,
      }));
      await StockMovement.create(movements, { session });

      await session.commitTransaction();

      // Emit real-time updates
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${req.tenantId}`).emit('order:created', { order });
        // Emit stock updates for each variant
        for (const item of orderItems) {
          const updatedVariant = await Variant.findById(item.variantId).lean();
          io.to(`tenant:${req.tenantId}`).emit('stock:updated', {
            variantId: item.variantId,
            stock: updatedVariant.stock,
          });
          if (updatedVariant.stock <= updatedVariant.lowStockThreshold) {
            io.to(`tenant:${req.tenantId}`).emit('stock:low', {
              variantId: updatedVariant._id,
              sku: updatedVariant.sku,
              stock: updatedVariant.stock,
              threshold: updatedVariant.lowStockThreshold,
            });
          }
        }
      }

      res.status(201).json({ order });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  })
);

/**
 * @swagger
 * /orders/{id}/status:
 *   put:
 *     summary: Update order status (owner/manager only)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
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
 *                 enum: [confirmed, processing, shipped, delivered]
 *     responses:
 *       200:
 *         description: Order status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Order not found
 */
router.put(
  '/:id/status',
  auth,
  authorize('owner', 'manager'),
  [body('status').isIn(['confirmed', 'processing', 'shipped', 'delivered']).withMessage('Please select a valid order status')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.status === 'cancelled') {
      throw new AppError('Cannot update a cancelled order', 400);
    }

    if (order.status === 'delivered') {
      throw new AppError('Cannot update a delivered order', 400);
    }

    order.status = req.body.status;
    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('order:updated', { order });
    }

    res.json({ order });
  })
);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order and restore stock (owner/manager only)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Customer requested cancellation
 *     responses:
 *       200:
 *         description: Order cancelled, stock restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Order already cancelled or shipped/delivered
 *       404:
 *         description: Order not found
 */
router.post(
  '/:id/cancel',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findOne({
        _id: req.params.id,
        tenantId: req.tenantId,
      }).session(session);

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status === 'cancelled') {
        throw new AppError('Order is already cancelled', 400);
      }

      if (['shipped', 'delivered'].includes(order.status)) {
        throw new AppError('Cannot cancel a shipped/delivered order', 400);
      }

      // Restore stock for each item
      const stockMovements = [];
      for (const item of order.items) {
        const variant = await Variant.findOneAndUpdate(
          { _id: item.variantId, tenantId: req.tenantId },
          { $inc: { stock: item.quantity } },
          { new: true, session }
        );

        if (variant) {
          stockMovements.push({
            tenantId: req.tenantId,
            variantId: variant._id,
            productId: item.productId,
            type: 'return',
            quantity: item.quantity,
            previousStock: variant.stock - item.quantity,
            newStock: variant.stock,
            reference: `Cancelled Order ${order.orderNumber}`,
            referenceId: order._id,
            notes: reason || 'Order cancelled',
            createdBy: req.user._id,
          });
        }
      }

      await StockMovement.create(stockMovements, { session });

      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = reason || '';
      await order.save({ session });

      await session.commitTransaction();

      const io = req.app.get('io');
      if (io) {
        io.to(`tenant:${req.tenantId}`).emit('order:cancelled', { order });
      }

      res.json({ order });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  })
);

module.exports = router;
