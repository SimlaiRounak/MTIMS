const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const { Tenant, User, Product, Variant, Supplier, PurchaseOrder, Order, StockMovement } = require('./models');
const { generateOrderNumber } = require('./utils/helpers');

const seed = async () => {
  await connectDB();
  console.log('Clearing existing data...');

  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Product.deleteMany({}),
    Variant.deleteMany({}),
    Supplier.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Order.deleteMany({}),
    StockMovement.deleteMany({}),
  ]);

  console.log('Seeding Tenant 1: TechGear Electronics...');

  // ===== TENANT 1: TechGear Electronics =====
  const tenant1 = await Tenant.create({
    name: 'TechGear Electronics',
    slug: 'techgear-electronics',
    settings: { currency: 'USD', lowStockThreshold: 10 },
  });

  const [t1Owner, t1Manager, t1Staff] = await Promise.all([
    User.create({ tenantId: tenant1._id, name: 'John Owner', email: 'owner@techgear.com', password: 'password123', role: 'owner' }),
    User.create({ tenantId: tenant1._id, name: 'Jane Manager', email: 'manager@techgear.com', password: 'password123', role: 'manager' }),
    User.create({ tenantId: tenant1._id, name: 'Bob Staff', email: 'staff@techgear.com', password: 'password123', role: 'staff' }),
  ]);

  // Products for Tenant 1
  const t1Laptop = await Product.create({
    tenantId: tenant1._id,
    name: 'ProBook Laptop',
    description: 'High-performance business laptop with multiple configurations',
    category: 'Laptops',
    basePrice: 999.99,
    variantAttributes: ['ram', 'storage'],
  });

  const t1LaptopVariants = await Variant.create([
    { tenantId: tenant1._id, productId: t1Laptop._id, sku: 'PBL-8-256', attributes: new Map([['ram', '8GB'], ['storage', '256GB SSD']]), price: 999.99, costPrice: 650, stock: 25, lowStockThreshold: 5 },
    { tenantId: tenant1._id, productId: t1Laptop._id, sku: 'PBL-16-512', attributes: new Map([['ram', '16GB'], ['storage', '512GB SSD']]), price: 1299.99, costPrice: 850, stock: 15, lowStockThreshold: 5 },
    { tenantId: tenant1._id, productId: t1Laptop._id, sku: 'PBL-32-1TB', attributes: new Map([['ram', '32GB'], ['storage', '1TB SSD']]), price: 1799.99, costPrice: 1100, stock: 8, lowStockThreshold: 3 },
  ]);

  const t1Phone = await Product.create({
    tenantId: tenant1._id,
    name: 'SmartPhone X',
    description: 'Flagship smartphone',
    category: 'Phones',
    basePrice: 699.99,
    variantAttributes: ['color', 'storage'],
  });

  const t1PhoneVariants = await Variant.create([
    { tenantId: tenant1._id, productId: t1Phone._id, sku: 'SPX-BLK-128', attributes: new Map([['color', 'Black'], ['storage', '128GB']]), price: 699.99, costPrice: 450, stock: 50, lowStockThreshold: 10 },
    { tenantId: tenant1._id, productId: t1Phone._id, sku: 'SPX-WHT-128', attributes: new Map([['color', 'White'], ['storage', '128GB']]), price: 699.99, costPrice: 450, stock: 45, lowStockThreshold: 10 },
    { tenantId: tenant1._id, productId: t1Phone._id, sku: 'SPX-BLK-256', attributes: new Map([['color', 'Black'], ['storage', '256GB']]), price: 799.99, costPrice: 520, stock: 30, lowStockThreshold: 8 },
    { tenantId: tenant1._id, productId: t1Phone._id, sku: 'SPX-WHT-256', attributes: new Map([['color', 'White'], ['storage', '256GB']]), price: 799.99, costPrice: 520, stock: 3, lowStockThreshold: 8 },
  ]);

  const t1Headphones = await Product.create({
    tenantId: tenant1._id,
    name: 'NoiseCancel Pro Headphones',
    description: 'Premium ANC wireless headphones',
    category: 'Accessories',
    basePrice: 249.99,
    variantAttributes: ['color'],
  });

  const t1HeadphoneVariants = await Variant.create([
    { tenantId: tenant1._id, productId: t1Headphones._id, sku: 'NCP-BLK', attributes: new Map([['color', 'Black']]), price: 249.99, costPrice: 120, stock: 100, lowStockThreshold: 15 },
    { tenantId: tenant1._id, productId: t1Headphones._id, sku: 'NCP-SLV', attributes: new Map([['color', 'Silver']]), price: 249.99, costPrice: 120, stock: 75, lowStockThreshold: 15 },
    { tenantId: tenant1._id, productId: t1Headphones._id, sku: 'NCP-BLU', attributes: new Map([['color', 'Blue']]), price: 259.99, costPrice: 125, stock: 5, lowStockThreshold: 15 },
  ]);

  const t1Charger = await Product.create({
    tenantId: tenant1._id,
    name: 'USB-C Fast Charger',
    description: 'Universal fast charging brick',
    category: 'Accessories',
    basePrice: 39.99,
    variantAttributes: ['wattage'],
  });

  const t1ChargerVariants = await Variant.create([
    { tenantId: tenant1._id, productId: t1Charger._id, sku: 'USC-20W', attributes: new Map([['wattage', '20W']]), price: 29.99, costPrice: 8, stock: 200, lowStockThreshold: 30 },
    { tenantId: tenant1._id, productId: t1Charger._id, sku: 'USC-65W', attributes: new Map([['wattage', '65W']]), price: 49.99, costPrice: 18, stock: 150, lowStockThreshold: 25 },
    { tenantId: tenant1._id, productId: t1Charger._id, sku: 'USC-100W', attributes: new Map([['wattage', '100W']]), price: 69.99, costPrice: 28, stock: 80, lowStockThreshold: 15 },
  ]);

  const t1Monitor = await Product.create({
    tenantId: tenant1._id,
    name: '4K UltraWide Monitor',
    description: '34" curved ultrawide monitor for productivity',
    category: 'Monitors',
    basePrice: 549.99,
    variantAttributes: ['size'],
  });

  const t1MonitorVariants = await Variant.create([
    { tenantId: tenant1._id, productId: t1Monitor._id, sku: 'MON-27', attributes: new Map([['size', '27"']]), price: 449.99, costPrice: 280, stock: 20, lowStockThreshold: 5 },
    { tenantId: tenant1._id, productId: t1Monitor._id, sku: 'MON-34', attributes: new Map([['size', '34"']]), price: 649.99, costPrice: 400, stock: 12, lowStockThreshold: 3 },
  ]);

  // Supplier for Tenant 1
  const t1Supplier1 = await Supplier.create({
    tenantId: tenant1._id,
    name: 'Global Tech Distributors',
    contactPerson: 'Alice Chen',
    email: 'alice@globaltechdist.com',
    phone: '+1-555-0101',
    address: '100 Tech Park, San Jose, CA 95101',
    products: [
      { variantId: t1LaptopVariants[0]._id, unitPrice: 650, leadTimeDays: 14 },
      { variantId: t1LaptopVariants[1]._id, unitPrice: 850, leadTimeDays: 14 },
      { variantId: t1PhoneVariants[0]._id, unitPrice: 450, leadTimeDays: 10 },
    ],
  });

  const t1Supplier2 = await Supplier.create({
    tenantId: tenant1._id,
    name: 'AccessoryWorld',
    contactPerson: 'Mike Ross',
    email: 'mike@accessoryworld.com',
    phone: '+1-555-0202',
    address: '50 Gadget Blvd, Austin, TX 73301',
    products: [
      { variantId: t1HeadphoneVariants[0]._id, unitPrice: 120, leadTimeDays: 7 },
      { variantId: t1ChargerVariants[0]._id, unitPrice: 8, leadTimeDays: 5 },
    ],
  });

  // PO for Tenant 1 (pending - affects low stock alerts)
  const t1PO = await PurchaseOrder.create({
    tenantId: tenant1._id,
    poNumber: 'PO-SEED-001',
    supplierId: t1Supplier2._id,
    status: 'confirmed',
    items: [
      { variantId: t1HeadphoneVariants[2]._id, productId: t1Headphones._id, quantityOrdered: 50, unitPrice: 125 },
    ],
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notes: 'Restock blue headphones',
    createdBy: t1Owner._id,
  });

  // Sample orders for Tenant 1
  const t1Order1 = await Order.create({
    tenantId: tenant1._id,
    orderNumber: generateOrderNumber('ORD'),
    status: 'delivered',
    items: [
      { variantId: t1PhoneVariants[0]._id, productId: t1Phone._id, productName: 'SmartPhone X', variantSku: 'SPX-BLK-128', quantity: 2, unitPrice: 699.99, total: 1399.98 },
      { variantId: t1ChargerVariants[0]._id, productId: t1Charger._id, productName: 'USB-C Fast Charger', variantSku: 'USC-20W', quantity: 2, unitPrice: 29.99, total: 59.98 },
    ],
    totalAmount: 1459.96,
    customerName: 'David Park',
    customerEmail: 'david@example.com',
    createdBy: t1Staff._id,
  });

  const t1Order2 = await Order.create({
    tenantId: tenant1._id,
    orderNumber: generateOrderNumber('ORD'),
    status: 'confirmed',
    items: [
      { variantId: t1LaptopVariants[1]._id, productId: t1Laptop._id, productName: 'ProBook Laptop', variantSku: 'PBL-16-512', quantity: 1, unitPrice: 1299.99, total: 1299.99 },
      { variantId: t1HeadphoneVariants[0]._id, productId: t1Headphones._id, productName: 'NoiseCancel Pro Headphones', variantSku: 'NCP-BLK', quantity: 1, unitPrice: 249.99, total: 249.99 },
    ],
    totalAmount: 1549.98,
    customerName: 'Sarah Lee',
    customerEmail: 'sarah@example.com',
    createdBy: t1Manager._id,
  });

  // Stock movements for Tenant 1
  await StockMovement.create([
    { tenantId: tenant1._id, variantId: t1PhoneVariants[0]._id, productId: t1Phone._id, type: 'sale', quantity: -2, previousStock: 52, newStock: 50, reference: `Order ${t1Order1.orderNumber}`, createdBy: t1Staff._id },
    { tenantId: tenant1._id, variantId: t1ChargerVariants[0]._id, productId: t1Charger._id, type: 'sale', quantity: -2, previousStock: 202, newStock: 200, reference: `Order ${t1Order1.orderNumber}`, createdBy: t1Staff._id },
    { tenantId: tenant1._id, variantId: t1LaptopVariants[1]._id, productId: t1Laptop._id, type: 'sale', quantity: -1, previousStock: 16, newStock: 15, reference: `Order ${t1Order2.orderNumber}`, createdBy: t1Manager._id },
    { tenantId: tenant1._id, variantId: t1HeadphoneVariants[0]._id, productId: t1Headphones._id, type: 'sale', quantity: -1, previousStock: 101, newStock: 100, reference: `Order ${t1Order2.orderNumber}`, createdBy: t1Manager._id },
    { tenantId: tenant1._id, variantId: t1PhoneVariants[3]._id, productId: t1Phone._id, type: 'adjustment', quantity: -7, previousStock: 10, newStock: 3, notes: 'Inventory audit correction', createdBy: t1Owner._id },
  ]);

  console.log('Seeding Tenant 2: Fashion Hub...');

  // ===== TENANT 2: Fashion Hub =====
  const tenant2 = await Tenant.create({
    name: 'Fashion Hub',
    slug: 'fashion-hub',
    settings: { currency: 'USD', lowStockThreshold: 15 },
  });

  const [t2Owner, t2Manager, t2Staff] = await Promise.all([
    User.create({ tenantId: tenant2._id, name: 'Emma Wilson', email: 'owner@fashionhub.com', password: 'password123', role: 'owner' }),
    User.create({ tenantId: tenant2._id, name: 'Liam Johnson', email: 'manager@fashionhub.com', password: 'password123', role: 'manager' }),
    User.create({ tenantId: tenant2._id, name: 'Olivia Brown', email: 'staff@fashionhub.com', password: 'password123', role: 'staff' }),
  ]);

  // Products for Tenant 2
  const t2Tshirt = await Product.create({
    tenantId: tenant2._id,
    name: 'Classic Cotton T-Shirt',
    description: 'Soft premium cotton t-shirt, available in multiple sizes and colors',
    category: 'Tops',
    basePrice: 29.99,
    variantAttributes: ['size', 'color'],
  });

  const t2TshirtVariants = await Variant.create([
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-S-BLK', attributes: new Map([['size', 'S'], ['color', 'Black']]), price: 29.99, costPrice: 8, stock: 60, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-S-WHT', attributes: new Map([['size', 'S'], ['color', 'White']]), price: 29.99, costPrice: 8, stock: 55, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-S-NVY', attributes: new Map([['size', 'S'], ['color', 'Navy']]), price: 29.99, costPrice: 8, stock: 40, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-M-BLK', attributes: new Map([['size', 'M'], ['color', 'Black']]), price: 29.99, costPrice: 8, stock: 80, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-M-WHT', attributes: new Map([['size', 'M'], ['color', 'White']]), price: 29.99, costPrice: 8, stock: 75, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-M-NVY', attributes: new Map([['size', 'M'], ['color', 'Navy']]), price: 29.99, costPrice: 8, stock: 10, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-L-BLK', attributes: new Map([['size', 'L'], ['color', 'Black']]), price: 29.99, costPrice: 8, stock: 70, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-L-WHT', attributes: new Map([['size', 'L'], ['color', 'White']]), price: 29.99, costPrice: 8, stock: 65, lowStockThreshold: 15 },
    { tenantId: tenant2._id, productId: t2Tshirt._id, sku: 'CCT-L-NVY', attributes: new Map([['size', 'L'], ['color', 'Navy']]), price: 29.99, costPrice: 8, stock: 4, lowStockThreshold: 15 },
  ]);

  const t2Jeans = await Product.create({
    tenantId: tenant2._id,
    name: 'Slim Fit Jeans',
    description: 'Modern slim fit denim jeans',
    category: 'Bottoms',
    basePrice: 59.99,
    variantAttributes: ['size', 'color'],
  });

  const t2JeansVariants = await Variant.create([
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-30-BLU', attributes: new Map([['size', '30'], ['color', 'Blue']]), price: 59.99, costPrice: 22, stock: 35, lowStockThreshold: 10 },
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-32-BLU', attributes: new Map([['size', '32'], ['color', 'Blue']]), price: 59.99, costPrice: 22, stock: 45, lowStockThreshold: 10 },
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-34-BLU', attributes: new Map([['size', '34'], ['color', 'Blue']]), price: 59.99, costPrice: 22, stock: 30, lowStockThreshold: 10 },
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-30-BLK', attributes: new Map([['size', '30'], ['color', 'Black']]), price: 59.99, costPrice: 22, stock: 25, lowStockThreshold: 10 },
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-32-BLK', attributes: new Map([['size', '32'], ['color', 'Black']]), price: 59.99, costPrice: 22, stock: 40, lowStockThreshold: 10 },
    { tenantId: tenant2._id, productId: t2Jeans._id, sku: 'SFJ-34-BLK', attributes: new Map([['size', '34'], ['color', 'Black']]), price: 64.99, costPrice: 24, stock: 20, lowStockThreshold: 10 },
  ]);

  const t2Sneakers = await Product.create({
    tenantId: tenant2._id,
    name: 'Urban Runner Sneakers',
    description: 'Comfortable urban running sneakers',
    category: 'Footwear',
    basePrice: 89.99,
    variantAttributes: ['size', 'color'],
  });

  const t2SneakerVariants = await Variant.create([
    { tenantId: tenant2._id, productId: t2Sneakers._id, sku: 'URS-8-WHT', attributes: new Map([['size', '8'], ['color', 'White']]), price: 89.99, costPrice: 35, stock: 20, lowStockThreshold: 8 },
    { tenantId: tenant2._id, productId: t2Sneakers._id, sku: 'URS-9-WHT', attributes: new Map([['size', '9'], ['color', 'White']]), price: 89.99, costPrice: 35, stock: 25, lowStockThreshold: 8 },
    { tenantId: tenant2._id, productId: t2Sneakers._id, sku: 'URS-10-WHT', attributes: new Map([['size', '10'], ['color', 'White']]), price: 89.99, costPrice: 35, stock: 18, lowStockThreshold: 8 },
    { tenantId: tenant2._id, productId: t2Sneakers._id, sku: 'URS-9-BLK', attributes: new Map([['size', '9'], ['color', 'Black']]), price: 89.99, costPrice: 35, stock: 2, lowStockThreshold: 8 },
  ]);

  const t2Jacket = await Product.create({
    tenantId: tenant2._id,
    name: 'Winter Puffer Jacket',
    description: 'Warm quilted puffer jacket for cold weather',
    category: 'Outerwear',
    basePrice: 149.99,
    variantAttributes: ['size', 'color'],
  });

  const t2JacketVariants = await Variant.create([
    { tenantId: tenant2._id, productId: t2Jacket._id, sku: 'WPJ-M-BLK', attributes: new Map([['size', 'M'], ['color', 'Black']]), price: 149.99, costPrice: 55, stock: 15, lowStockThreshold: 5 },
    { tenantId: tenant2._id, productId: t2Jacket._id, sku: 'WPJ-L-BLK', attributes: new Map([['size', 'L'], ['color', 'Black']]), price: 149.99, costPrice: 55, stock: 12, lowStockThreshold: 5 },
    { tenantId: tenant2._id, productId: t2Jacket._id, sku: 'WPJ-XL-OLV', attributes: new Map([['size', 'XL'], ['color', 'Olive']]), price: 159.99, costPrice: 60, stock: 8, lowStockThreshold: 5 },
  ]);

  // Suppliers for Tenant 2
  const t2Supplier1 = await Supplier.create({
    tenantId: tenant2._id,
    name: 'FabricFirst Wholesale',
    contactPerson: 'Sarah Kim',
    email: 'sarah@fabricfirst.com',
    phone: '+1-555-0301',
    address: '200 Fashion Ave, New York, NY 10001',
    products: [
      { variantId: t2TshirtVariants[0]._id, unitPrice: 8, leadTimeDays: 10 },
      { variantId: t2JeansVariants[0]._id, unitPrice: 22, leadTimeDays: 14 },
    ],
  });

  const t2Supplier2 = await Supplier.create({
    tenantId: tenant2._id,
    name: 'SoleSource Footwear',
    contactPerson: 'Tom Davis',
    email: 'tom@solesource.com',
    phone: '+1-555-0401',
    address: '75 Shoe Lane, Portland, OR 97201',
    products: [
      { variantId: t2SneakerVariants[0]._id, unitPrice: 35, leadTimeDays: 21 },
    ],
  });

  // PO for Tenant 2
  await PurchaseOrder.create({
    tenantId: tenant2._id,
    poNumber: 'PO-SEED-002',
    supplierId: t2Supplier1._id,
    status: 'sent',
    items: [
      { variantId: t2TshirtVariants[5]._id, productId: t2Tshirt._id, quantityOrdered: 100, unitPrice: 8 },
      { variantId: t2TshirtVariants[8]._id, productId: t2Tshirt._id, quantityOrdered: 80, unitPrice: 8 },
    ],
    expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    notes: 'Urgent restock of Navy t-shirts',
    createdBy: t2Owner._id,
  });

  await PurchaseOrder.create({
    tenantId: tenant2._id,
    poNumber: 'PO-SEED-003',
    supplierId: t2Supplier2._id,
    status: 'confirmed',
    items: [
      { variantId: t2SneakerVariants[3]._id, productId: t2Sneakers._id, quantityOrdered: 30, unitPrice: 35 },
    ],
    expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    notes: 'Restock black sneakers size 9',
    createdBy: t2Manager._id,
  });

  // Orders for Tenant 2
  const t2Order1 = await Order.create({
    tenantId: tenant2._id,
    orderNumber: generateOrderNumber('ORD'),
    status: 'delivered',
    items: [
      { variantId: t2TshirtVariants[3]._id, productId: t2Tshirt._id, productName: 'Classic Cotton T-Shirt', variantSku: 'CCT-M-BLK', quantity: 3, unitPrice: 29.99, total: 89.97 },
      { variantId: t2JeansVariants[1]._id, productId: t2Jeans._id, productName: 'Slim Fit Jeans', variantSku: 'SFJ-32-BLU', quantity: 1, unitPrice: 59.99, total: 59.99 },
    ],
    totalAmount: 149.96,
    customerName: 'Alex Rivera',
    customerEmail: 'alex@example.com',
    createdBy: t2Staff._id,
  });

  const t2Order2 = await Order.create({
    tenantId: tenant2._id,
    orderNumber: generateOrderNumber('ORD'),
    status: 'processing',
    items: [
      { variantId: t2SneakerVariants[1]._id, productId: t2Sneakers._id, productName: 'Urban Runner Sneakers', variantSku: 'URS-9-WHT', quantity: 1, unitPrice: 89.99, total: 89.99 },
      { variantId: t2JacketVariants[0]._id, productId: t2Jacket._id, productName: 'Winter Puffer Jacket', variantSku: 'WPJ-M-BLK', quantity: 1, unitPrice: 149.99, total: 149.99 },
    ],
    totalAmount: 239.98,
    customerName: 'Nina Patel',
    customerEmail: 'nina@example.com',
    createdBy: t2Manager._id,
  });

  // Stock movements for Tenant 2
  await StockMovement.create([
    { tenantId: tenant2._id, variantId: t2TshirtVariants[3]._id, productId: t2Tshirt._id, type: 'sale', quantity: -3, previousStock: 83, newStock: 80, reference: `Order ${t2Order1.orderNumber}`, createdBy: t2Staff._id },
    { tenantId: tenant2._id, variantId: t2JeansVariants[1]._id, productId: t2Jeans._id, type: 'sale', quantity: -1, previousStock: 46, newStock: 45, reference: `Order ${t2Order1.orderNumber}`, createdBy: t2Staff._id },
    { tenantId: tenant2._id, variantId: t2SneakerVariants[1]._id, productId: t2Sneakers._id, type: 'sale', quantity: -1, previousStock: 26, newStock: 25, reference: `Order ${t2Order2.orderNumber}`, createdBy: t2Manager._id },
    { tenantId: tenant2._id, variantId: t2JacketVariants[0]._id, productId: t2Jacket._id, type: 'sale', quantity: -1, previousStock: 16, newStock: 15, reference: `Order ${t2Order2.orderNumber}`, createdBy: t2Manager._id },
    { tenantId: tenant2._id, variantId: t2SneakerVariants[3]._id, productId: t2Sneakers._id, type: 'adjustment', quantity: -8, previousStock: 10, newStock: 2, notes: 'Damaged items removed', createdBy: t2Owner._id },
  ]);

  console.log('\n✅ Seed complete!');
  console.log('\nTenant 1 - TechGear Electronics:');
  console.log('  Owner:   owner@techgear.com / password123');
  console.log('  Manager: manager@techgear.com / password123');
  console.log('  Staff:   staff@techgear.com / password123');
  console.log('  Products: 5 | Variants: 14 | Suppliers: 2 | Orders: 2 | POs: 1');
  console.log('\nTenant 2 - Fashion Hub:');
  console.log('  Owner:   owner@fashionhub.com / password123');
  console.log('  Manager: manager@fashionhub.com / password123');
  console.log('  Staff:   staff@fashionhub.com / password123');
  console.log('  Products: 4 | Variants: 22 | Suppliers: 2 | Orders: 2 | POs: 2');

  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
