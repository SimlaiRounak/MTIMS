const express = require('express');
const { body, validationResult } = require('express-validator');
const { Supplier } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /suppliers:
 *   get:
 *     summary: List suppliers with pagination
 *     tags: [Suppliers]
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
 *         description: Search by supplier name
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: Paginated list of suppliers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suppliers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
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

/**
 * @swagger
 * /suppliers/{id}:
 *   get:
 *     summary: Get a single supplier by ID
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supplier:
 *                   $ref: '#/components/schemas/Supplier'
 *       404:
 *         description: Supplier not found
 */
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

/**
 * @swagger
 * /suppliers:
 *   post:
 *     summary: Create a supplier (owner/manager only)
 *     tags: [Suppliers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: GlobalTex Supplies
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId:
 *                       type: string
 *                     unitPrice:
 *                       type: number
 *                     leadTimeDays:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Supplier created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supplier:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Validation error
 */
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

/**
 * @swagger
 * /suppliers/{id}:
 *   put:
 *     summary: Update a supplier (owner/manager only)
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               contactPerson:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     variantId:
 *                       type: string
 *                     unitPrice:
 *                       type: number
 *                     leadTimeDays:
 *                       type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Supplier updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 supplier:
 *                   $ref: '#/components/schemas/Supplier'
 *       404:
 *         description: Supplier not found
 */
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

/**
 * @swagger
 * /suppliers/{id}:
 *   delete:
 *     summary: Delete a supplier (owner/manager only)
 *     tags: [Suppliers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Supplier ID
 *     responses:
 *       200:
 *         description: Supplier deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Supplier deleted
 *       404:
 *         description: Supplier not found
 */
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
