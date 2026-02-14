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

/**
 * @swagger
 * /roles/permissions:
 *   get:
 *     summary: Get permissions for all roles (any authenticated user)
 *     tags: [Roles]
 *     responses:
 *       200:
 *         description: Role permissions map
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 permissions:
 *                   type: object
 *                   description: Map of role to permission arrays
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 */
router.get(
  '/permissions',
  auth,
  asyncHandler(async (req, res) => {
    const permissions = await getAllRolePermissions(req.tenantId);
    res.json({ permissions });
  })
);

/**
 * @swagger
 * /roles/{role}/permissions:
 *   put:
 *     summary: Update permissions for a role (owner only)
 *     tags: [Roles]
 *     parameters:
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *           enum: [manager, staff]
 *         description: Role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [products.view, orders.view, orders.create]
 *     responses:
 *       200:
 *         description: Permissions updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role:
 *                   type: string
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid permissions or cannot modify owner
 */
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
