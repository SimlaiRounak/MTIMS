const express = require('express');
const { RolePermission } = require('../models');
const { auth, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');
const {
  ALL_PERMISSION_KEYS,
  getAllRolePermissions,
} = require('../utils/permissions');

const router = express.Router();

// GET /api/roles/permissions — Get permissions for all roles (any authenticated user)
router.get(
  '/permissions',
  auth,
  asyncHandler(async (req, res) => {
    const permissions = await getAllRolePermissions(req.tenantId);
    res.json({ permissions });
  })
);

// PUT /api/roles/:role/permissions — Update permissions for a role (owner only)
router.put(
  '/:role/permissions',
  auth,
  authorize('owner'),
  asyncHandler(async (req, res) => {
    const { role } = req.params;

    if (!['manager', 'staff'].includes(role)) {
      throw new AppError('Cannot modify owner permissions', 400);
    }

    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      throw new AppError('Permissions must be an array', 400);
    }

    // Validate every permission key
    const invalid = permissions.filter((p) => !ALL_PERMISSION_KEYS.includes(p));
    if (invalid.length > 0) {
      throw new AppError(`Invalid permissions: ${invalid.join(', ')}`, 400);
    }

    const updated = await RolePermission.findOneAndUpdate(
      { tenantId: req.tenantId, role },
      { permissions },
      { new: true, upsert: true }
    );

    res.json({ role, permissions: updated.permissions });
  })
);

module.exports = router;
