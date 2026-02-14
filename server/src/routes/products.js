const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Product, Variant } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler, generateSku } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/products - List products with variants
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, category, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { tenantId: req.tenantId };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      filter.category = category;
    }
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Attach variants to each product
    const productIds = products.map((p) => p._id);
    const variants = await Variant.find({
      tenantId: req.tenantId,
      productId: { $in: productIds },
    }).lean();

    const variantMap = {};
    variants.forEach((v) => {
      const pid = v.productId.toString();
      if (!variantMap[pid]) variantMap[pid] = [];
      variantMap[pid].push(v);
    });

    const productsWithVariants = products.map((p) => ({
      ...p,
      variants: variantMap[p._id.toString()] || [],
      totalStock: (variantMap[p._id.toString()] || []).reduce((sum, v) => sum + v.stock, 0),
    }));

    res.json({
      products: productsWithVariants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

// GET /api/products/categories - Get unique categories
router.get(
  '/categories',
  auth,
  asyncHandler(async (req, res) => {
    const categories = await Product.distinct('category', {
      tenantId: req.tenantId,
      category: { $ne: null, $ne: '' },
    });
    res.json({ categories });
  })
);

// GET /api/products/:id - Get single product with variants
router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    }).lean();

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const variants = await Variant.find({
      tenantId: req.tenantId,
      productId: product._id,
    }).lean();

    res.json({ product: { ...product, variants } });
  })
);

// POST /api/products - Create product with variants
router.post(
  '/',
  auth,
  authorize('owner', 'manager'),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('basePrice').isFloat({ min: 0 }).withMessage('Base price must be >= 0'),
    body('variants').isArray({ min: 1 }).withMessage('At least one variant is required'),
    body('variants.*.price').isFloat({ min: 0 }).withMessage('Variant price must be >= 0'),
    body('variants.*.stock').optional().isInt({ min: 0 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { name, description, category, basePrice, imageUrl, variantAttributes, variants } = req.body;

    // Create the product
    const product = await Product.create({
      tenantId: req.tenantId,
      name,
      description,
      category,
      basePrice,
      imageUrl,
      variantAttributes: variantAttributes || [],
    });

    // Create variants
    const variantDocs = await Promise.all(
      variants.map(async (v) => {
        const sku = v.sku || generateSku(name, v.attributes);
        return Variant.create({
          tenantId: req.tenantId,
          productId: product._id,
          sku,
          attributes: v.attributes || {},
          price: v.price || basePrice,
          costPrice: v.costPrice || 0,
          stock: v.stock || 0,
          lowStockThreshold: v.lowStockThreshold || 10,
        });
      })
    );

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('product:created', {
        product: { ...product.toObject(), variants: variantDocs },
      });
    }

    res.status(201).json({
      product: { ...product.toObject(), variants: variantDocs },
    });
  })
);

// PUT /api/products/:id - Update product
router.put(
  '/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { name, description, category, basePrice, imageUrl, variantAttributes, isActive } = req.body;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(basePrice !== undefined && { basePrice }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(variantAttributes && { variantAttributes }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const variants = await Variant.find({
      tenantId: req.tenantId,
      productId: product._id,
    }).lean();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('product:updated', {
        product: { ...product.toObject(), variants },
      });
    }

    res.json({ product: { ...product.toObject(), variants } });
  })
);

// DELETE /api/products/:id - Delete product and all variants
router.delete(
  '/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Delete all variants for this product
    await Variant.deleteMany({
      tenantId: req.tenantId,
      productId: req.params.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${req.tenantId}`).emit('product:deleted', { productId: req.params.id });
    }

    res.json({ message: 'Product and variants deleted' });
  })
);

// POST /api/products/:id/variants - Add variant to product
router.post(
  '/:id/variants',
  auth,
  authorize('owner', 'manager'),
  [
    body('price').isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const { sku, attributes, price, costPrice, stock, lowStockThreshold } = req.body;

    const variant = await Variant.create({
      tenantId: req.tenantId,
      productId: product._id,
      sku: sku || generateSku(product.name, attributes),
      attributes: attributes || {},
      price: price || product.basePrice,
      costPrice: costPrice || 0,
      stock: stock || 0,
      lowStockThreshold: lowStockThreshold || 10,
    });

    res.status(201).json({ variant });
  })
);

// PUT /api/variants/:id - Update variant
router.put(
  '/variants/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { sku, attributes, price, costPrice, lowStockThreshold, isActive } = req.body;

    const variant = await Variant.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      {
        ...(sku && { sku }),
        ...(attributes && { attributes }),
        ...(price !== undefined && { price }),
        ...(costPrice !== undefined && { costPrice }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!variant) {
      throw new AppError('Variant not found', 404);
    }

    res.json({ variant });
  })
);

// DELETE /api/variants/:id - Delete variant
router.delete(
  '/variants/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const variant = await Variant.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!variant) {
      throw new AppError('Variant not found', 404);
    }

    res.json({ message: 'Variant deleted' });
  })
);

module.exports = router;
