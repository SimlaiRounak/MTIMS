const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const config = require('../config');
const { Tenant, User } = require('../models');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, tenantId: user.tenantId, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// POST /api/auth/register - Register new tenant + owner
router.post(
  '/register',
  [
    body('tenantName').trim().notEmpty().withMessage('Business name is required'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { tenantName, name, email, password } = req.body;

    // Create slug from tenant name
    const slug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if tenant slug already exists
    const existingTenant = await Tenant.findOne({ slug });
    if (existingTenant) {
      throw new AppError('A business with this name already exists', 409);
    }

    // Create tenant
    const tenant = await Tenant.create({ name: tenantName, slug });

    // Create owner user
    const user = await User.create({
      tenantId: tenant._id,
      name,
      email,
      password,
      role: 'owner',
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant._id,
        tenantName: tenant.name,
      },
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, password } = req.body;

    // Find user across all tenants (email + password)
    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant || !tenant.isActive) {
      throw new AppError('Tenant account is deactivated', 403);
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: tenant._id,
        tenantName: tenant.name,
      },
    });
  })
);

// GET /api/auth/me - Get current user
router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.tenantId);
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        tenantId: req.tenantId,
        tenantName: tenant?.name,
      },
    });
  })
);

// POST /api/auth/users - Create user (Owner/Manager only)
router.post(
  '/users',
  auth,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['manager', 'staff']).withMessage('Role must be manager or staff'),
  ],
  asyncHandler(async (req, res) => {
    if (!['owner', 'manager'].includes(req.user.role)) {
      throw new AppError('Only owners and managers can create users', 403);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    // Managers can only create staff
    if (req.user.role === 'manager' && req.body.role !== 'staff') {
      throw new AppError('Managers can only create staff accounts', 403);
    }

    const { name, email, password, role } = req.body;

    const user = await User.create({
      tenantId: req.tenantId,
      name,
      email,
      password,
      role,
    });

    res.status(201).json({ user });
  })
);

module.exports = router;
