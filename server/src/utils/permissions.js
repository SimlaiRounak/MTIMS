const RolePermission = require('../models/RolePermission');

const ALL_PERMISSION_KEYS = [
  'users:view', 'users:create', 'users:edit', 'users:delete',
  'roles:manage',
  'products:view', 'products:create', 'products:edit', 'products:delete',
  'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
  'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
  'purchase-orders:view', 'purchase-orders:create', 'purchase-orders:edit', 'purchase-orders:receive',
  'stock:view', 'stock:adjust',
  'dashboard:view',
];

const DEFAULT_PERMISSIONS = {
  manager: [
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
    'purchase-orders:view', 'purchase-orders:create', 'purchase-orders:edit', 'purchase-orders:receive',
    'stock:view', 'stock:adjust',
    'dashboard:view',
    'users:view',
  ],
  staff: [
    'products:view',
    'orders:view', 'orders:create',
    'suppliers:view',
    'purchase-orders:view',
    'stock:view',
    'dashboard:view',
  ],
};

/**
 * Get permissions for a user role within a tenant.
 * Owner always gets all permissions.
 * Manager/Staff permissions are loaded from DB (with lazy defaults).
 */
const getUserPermissions = async (tenantId, role) => {
  if (role === 'owner') return ALL_PERMISSION_KEYS;

  let rolePerms = await RolePermission.findOne({ tenantId, role }).lean();
  if (!rolePerms) {
    // Lazy-create defaults for this tenant + role
    try {
      rolePerms = await RolePermission.create({
        tenantId,
        role,
        permissions: DEFAULT_PERMISSIONS[role] || [],
      });
    } catch (err) {
      // If another request created it concurrently, just read it
      if (err.code === 11000) {
        rolePerms = await RolePermission.findOne({ tenantId, role }).lean();
      } else {
        throw err;
      }
    }
  }

  return rolePerms.permissions || [];
};

/**
 * Get permissions for all roles within a tenant.
 */
const getAllRolePermissions = async (tenantId) => {
  // Ensure defaults exist for manager and staff
  for (const role of ['manager', 'staff']) {
    const exists = await RolePermission.findOne({ tenantId, role }).lean();
    if (!exists) {
      try {
        await RolePermission.create({
          tenantId,
          role,
          permissions: DEFAULT_PERMISSIONS[role] || [],
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
  }

  const docs = await RolePermission.find({ tenantId }).lean();
  const result = { owner: ALL_PERMISSION_KEYS };
  for (const doc of docs) {
    result[doc.role] = doc.permissions;
  }
  return result;
};

module.exports = {
  ALL_PERMISSION_KEYS,
  DEFAULT_PERMISSIONS,
  getUserPermissions,
  getAllRolePermissions,
};
