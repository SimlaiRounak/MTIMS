// Role hierarchy: owner > manager > staff
const ROLE_PERMISSIONS = {
  owner: [
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'roles:manage',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
    'purchase-orders:view', 'purchase-orders:create', 'purchase-orders:edit', 'purchase-orders:receive',
    'stock:view', 'stock:adjust',
    'dashboard:view',
  ],
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

export const hasAnyRole = (user, roles = []) => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

export const isOwner = (user) => hasAnyRole(user, ['owner']);
export const isManager = (user) => hasAnyRole(user, ['owner', 'manager']);

export const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  if (user.role === 'owner') return true; // Owner always has full access
  // Use server-provided permissions if available
  if (user.permissions) return user.permissions.includes(permission);
  // Fallback to hardcoded defaults
  const perms = ROLE_PERMISSIONS[user.role] || [];
  return perms.includes(permission);
};

export const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

export const ALL_PERMISSIONS = [
  { key: 'users:view', label: 'View Users', group: 'Users' },
  { key: 'users:create', label: 'Create Users', group: 'Users' },
  { key: 'users:edit', label: 'Edit Users', group: 'Users' },
  { key: 'users:delete', label: 'Delete Users', group: 'Users' },
  { key: 'roles:manage', label: 'Manage Roles', group: 'Roles' },
  { key: 'products:view', label: 'View Products', group: 'Products' },
  { key: 'products:create', label: 'Create Products', group: 'Products' },
  { key: 'products:edit', label: 'Edit Products', group: 'Products' },
  { key: 'products:delete', label: 'Delete Products', group: 'Products' },
  { key: 'orders:view', label: 'View Orders', group: 'Orders' },
  { key: 'orders:create', label: 'Create Orders', group: 'Orders' },
  { key: 'orders:edit', label: 'Edit Orders', group: 'Orders' },
  { key: 'orders:cancel', label: 'Cancel Orders', group: 'Orders' },
  { key: 'suppliers:view', label: 'View Suppliers', group: 'Suppliers' },
  { key: 'suppliers:create', label: 'Create Suppliers', group: 'Suppliers' },
  { key: 'suppliers:edit', label: 'Edit Suppliers', group: 'Suppliers' },
  { key: 'suppliers:delete', label: 'Delete Suppliers', group: 'Suppliers' },
  { key: 'purchase-orders:view', label: 'View Purchase Orders', group: 'Purchase Orders' },
  { key: 'purchase-orders:create', label: 'Create Purchase Orders', group: 'Purchase Orders' },
  { key: 'purchase-orders:edit', label: 'Edit Purchase Orders', group: 'Purchase Orders' },
  { key: 'purchase-orders:receive', label: 'Receive Deliveries', group: 'Purchase Orders' },
  { key: 'stock:view', label: 'View Stock', group: 'Stock' },
  { key: 'stock:adjust', label: 'Adjust Stock', group: 'Stock' },
  { key: 'dashboard:view', label: 'View Dashboard', group: 'Dashboard' },
];

export const ROLES = [
  { key: 'owner', label: 'Owner', description: 'Full access to everything. Cannot be assigned.' },
  { key: 'manager', label: 'Manager', description: 'Can manage products, orders, suppliers, stock. Can view users.' },
  { key: 'staff', label: 'Staff', description: 'Can view data and create orders. Read-only for most resources.' },
];

export default { hasAnyRole, isOwner, isManager, hasPermission, getPermissions, ALL_PERMISSIONS, ROLES };
