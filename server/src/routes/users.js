const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Tenant } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/users - List all users for this tenant (owner/manager only)
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

// GET /api/users/:id - Get single user
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

// PUT /api/users/:id/role - Change user role (owner only)
router.put(
  '/:id/role',
  auth,
  authorize('owner'),
  [body('role').isIn(['manager', 'staff']).withMessage('Role must be manager or staff')],
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

// PUT /api/users/:id/status - Activate/deactivate user (owner only)
router.put(
  '/:id/status',
  auth,
  authorize('owner'),
  [body('isActive').isBoolean().withMessage('isActive must be a boolean')],
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

// DELETE /api/users/:id - Delete user (owner only)
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
