const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Product, Variant } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler, generateSku } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List products with variants and pagination
 *     tags: [Products]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by product name (case-insensitive)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: A paginated list of products with variants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
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

/**
 * @swagger
 * /products/categories:
 *   get:
 *     summary: Get unique product categories for the tenant
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of category strings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [Apparel, Electronics]
 */
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

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a single product with its variants
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product with variants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
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

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product with variants (owner/manager only)
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, basePrice, variants]
 *             properties:
 *               name:
 *                 type: string
 *                 example: T-Shirt
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 example: Apparel
 *               basePrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 19.99
 *               imageUrl:
 *                 type: string
 *               variantAttributes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [size, color]
 *               variants:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [price]
 *                   properties:
 *                     sku:
 *                       type: string
 *                     attributes:
 *                       type: object
 *                       additionalProperties:
 *                         type: string
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                     costPrice:
 *                       type: number
 *                     stock:
 *                       type: integer
 *                       minimum: 0
 *                     lowStockThreshold:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Product created with variants
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 */
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

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product (owner/manager only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               imageUrl:
 *                 type: string
 *               variantAttributes:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
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

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product and all its variants (owner/manager only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Product and variants deleted
 *       404:
 *         description: Product not found
 */
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

/**
 * @swagger
 * /products/{id}/variants:
 *   post:
 *     summary: Add a variant to a product (owner/manager only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [price]
 *             properties:
 *               sku:
 *                 type: string
 *               attributes:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               costPrice:
 *                 type: number
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *               lowStockThreshold:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Variant created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variant:
 *                   $ref: '#/components/schemas/Variant'
 *       404:
 *         description: Product not found
 */
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

/**
 * @swagger
 * /products/variants/{id}:
 *   put:
 *     summary: Update a variant (owner/manager only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Variant ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               attributes:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *               price:
 *                 type: number
 *               costPrice:
 *                 type: number
 *               lowStockThreshold:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Variant updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variant:
 *                   $ref: '#/components/schemas/Variant'
 *       404:
 *         description: Variant not found
 */
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

/**
 * @swagger
 * /products/variants/{id}:
 *   delete:
 *     summary: Delete a variant (owner/manager only)
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Variant ID
 *     responses:
 *       200:
 *         description: Variant deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Variant deleted
 *       404:
 *         description: Variant not found
 */
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
