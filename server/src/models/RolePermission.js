const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['manager', 'staff'],
      required: true,
    },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);

// One document per tenant + role combination
rolePermissionSchema.index({ tenantId: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
