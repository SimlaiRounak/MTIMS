const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { Variant, StockMovement, PurchaseOrder } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/stock/adjust - Manual stock adjustment
router.post(
  '/adjust',
  auth,
  authorize('owner', 'manager'),
  [
    body('variantId').notEmpty().withMessage('Variant ID is required'),
    body('quantity').isInt().withMessage('Quantity must be an integer'),
    body('type').isIn(['adjustment', 'return']).withMessage('Type must be adjustment or return'),
    body('notes').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { variantId, quantity, type, notes } = req.body;

    // Atomic update — ensures stock never goes negative
    const variant = await Variant.findOneAndUpdate(
      {
        _id: variantId,
        tenantId: req.tenantId,
        stock: { $gte: quantity < 0 ? Math.abs(quantity) : 0 },
      },
      { $inc: { stock: quantity } },
      { new: true }
    );

    if (!variant) {
      throw new AppError('Variant not found or insufficient stock for negative adjustment', 400);
    }

    // Record stock movement
    const movement = await StockMovement.create({
      tenantId: req.tenantId,
      variantId: variant._id,
      productId: variant.productId,
      type,
      quantity,
      previousStock: variant.stock - quantity,
      newStock: variant.stock,
      notes,
      createdBy: req.user._id,
    });

    // Emit real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('stock:updated', {
        variantId: variant._id,
        stock: variant.stock,
        movement,
      });

      // Check for low stock alert
      if (variant.stock <= variant.lowStockThreshold) {
        io.to(`tenant:${req.tenantId}`).emit('stock:low', {
          variantId: variant._id,
          sku: variant.sku,
          stock: variant.stock,
          threshold: variant.lowStockThreshold,
        });
      }
    }

    res.json({ variant, movement });
  })
);

// GET /api/stock/movements - List stock movements
router.get(
  '/movements',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, variantId, type, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { tenantId: req.tenantId };
    if (variantId) filter.variantId = variantId;
    if (type) filter.type = type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('variantId', 'sku attributes')
        .populate('productId', 'name')
        .populate('createdBy', 'name')
        .lean(),
      StockMovement.countDocuments(filter),
    ]);

    res.json({
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

// GET /api/stock/low-stock - Low stock alerts (considers pending POs)
router.get(
  '/low-stock',
  auth,
  asyncHandler(async (req, res) => {
    // Get all low-stock variants for this tenant
    const lowStockVariants = await Variant.find({
      tenantId: req.tenantId,
      isActive: true,
      $expr: { $lte: ['$stock', '$lowStockThreshold'] },
    })
      .populate('productId', 'name category')
      .lean();

    if (lowStockVariants.length === 0) {
      return res.json({ alerts: [] });
    }

    // Get pending PO quantities for these variants
    const variantIds = lowStockVariants.map((v) => v._id);

    const pendingPOQuantities = await PurchaseOrder.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          status: { $in: ['draft', 'sent', 'confirmed', 'partially_received'] },
        },
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.variantId': { $in: variantIds },
        },
      },
      {
        $group: {
          _id: '$items.variantId',
          pendingQuantity: {
            $sum: { $subtract: ['$items.quantityOrdered', '$items.quantityReceived'] },
          },
        },
      },
    ]);

    const pendingMap = {};
    pendingPOQuantities.forEach((p) => {
      pendingMap[p._id.toString()] = p.pendingQuantity;
    });

    const alerts = lowStockVariants.map((v) => {
      const pendingQty = pendingMap[v._id.toString()] || 0;
      const effectiveStock = v.stock + pendingQty;
      return {
        ...v,
        pendingPOQuantity: pendingQty,
        effectiveStock,
        // Smart alert: only critical if even pending POs won't help
        severity: effectiveStock <= v.lowStockThreshold ? 'critical' : 'warning',
        message:
          effectiveStock > v.lowStockThreshold
            ? `Low stock (${v.stock}) but ${pendingQty} units pending in POs`
            : `Critical: Only ${v.stock} in stock, ${pendingQty} pending`,
      };
    });

    res.json({ alerts });
  })
);

module.exports = router;
