// Generate unique order/PO numbers
const generateOrderNumber = (prefix = 'ORD') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Generate SKU from product name and attributes
const generateSku = (productName, attributes = {}) => {
  const base = productName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, 'X');
  const attrParts = Object.values(attributes)
    .map((v) => String(v).substring(0, 3).toUpperCase())
    .join('-');
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return attrParts ? `${base}-${attrParts}-${random}` : `${base}-${random}`;
};

// Wrap async route handlers to catch errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { generateOrderNumber, generateSku, asyncHandler };
