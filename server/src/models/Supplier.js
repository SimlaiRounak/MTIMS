const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 200,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Products/Variants this supplier provides with their pricing
    products: [
      {
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Variant',
        },
        unitPrice: {
          type: Number,
          min: 0,
        },
        leadTimeDays: {
          type: Number,
          default: 7,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

supplierSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
