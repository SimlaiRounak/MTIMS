const express = require('express');
const { body, validationResult } = require('express-validator');
const { Supplier } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/suppliers
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { tenantId: req.tenantId };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('products.variantId', 'sku attributes')
        .lean(),
      Supplier.countDocuments(filter),
    ]);

    res.json({
      suppliers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

// GET /api/suppliers/:id
router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .populate('products.variantId', 'sku attributes price stock')
      .lean();

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    res.json({ supplier });
  })
);

// POST /api/suppliers
router.post(
  '/',
  auth,
  authorize('owner', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Supplier name is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, contactPerson, email, phone, address, products } = req.body;

    const supplier = await Supplier.create({
      tenantId: req.tenantId,
      name,
      contactPerson,
      email,
      phone,
      address,
      products: products || [],
    });

    res.status(201).json({ supplier });
  })
);

// PUT /api/suppliers/:id
router.put(
  '/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { name, contactPerson, email, phone, address, products, isActive } = req.body;

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        ...(name && { name }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(products && { products }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    res.json({ supplier });
  })
);

// DELETE /api/suppliers/:id
router.delete(
  '/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const supplier = await Supplier.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    res.json({ message: 'Supplier deleted' });
  })
);

module.exports = router;
