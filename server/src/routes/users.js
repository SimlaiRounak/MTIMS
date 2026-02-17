const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Tenant } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users for the tenant (owner/manager only)
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 */
router.get(
  '/',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const users = await User.find({ tenantId: req.tenantId })
      .select('-password')
      .sort({ role: 1, name: 1 })
      .lean();

    res.json({ users });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a single user by ID (owner/manager only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  auth,
  authorize('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    })
      .select('-password')
      .lean();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ user });
  })
);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Change a user's role (owner only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [manager, staff]
 *     responses:
 *       200:
 *         description: User role updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       400:
 *         description: Cannot change own role
 *       403:
 *         description: Cannot change an owner's role
 *       404:
 *         description: User not found
 */
router.put(
  '/:id/role',
  auth,
  authorize('owner'),
  [body('role').isIn(['manager', 'staff']).withMessage('Please select a valid role (Manager or Staff)')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    // Cannot change own role
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot change your own role', 400);
    }

    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Cannot change another owner's role
    if (user.role === 'owner') {
      throw new AppError('Cannot change an owner\'s role', 403);
    }

    user.role = req.body.role;
    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  })
);

/**
 * @swagger
 * /users/{id}/status:
 *   put:
 *     summary: Activate or deactivate a user (owner only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       400:
 *         description: Cannot deactivate own account
 *       403:
 *         description: Cannot deactivate an owner
 *       404:
 *         description: User not found
 */
router.put(
  '/:id/status',
  auth,
  authorize('owner'),
  [body('isActive').isBoolean().withMessage('Please provide a valid active status')],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    // Cannot deactivate self
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot deactivate your own account', 400);
    }

    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === 'owner') {
      throw new AppError('Cannot deactivate an owner account', 403);
    }

    user.isActive = req.body.isActive;
    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user (owner only)
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted
 *       400:
 *         description: Cannot delete own account
 *       403:
 *         description: Cannot delete an owner
 *       404:
 *         description: User not found
 */
router.delete(
  '/:id',
  auth,
  authorize('owner'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot delete your own account', 400);
    }

    const user = await User.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === 'owner') {
      throw new AppError('Cannot delete an owner account', 403);
    }

    await User.findByIdAndDelete(user._id);

    res.json({ message: 'User deleted' });
  })
);

module.exports = router;
