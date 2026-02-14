const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'return', 'adjustment'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      // Can be negative for sales/adjustments
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reference: {
      // Links to the order/PO that caused this movement
      type: String,
      trim: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

stockMovementSchema.index({ tenantId: 1, variantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
