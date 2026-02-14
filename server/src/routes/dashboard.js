const express = require('express');
const mongoose = require('mongoose');
const { Variant, Order, StockMovement, Product, PurchaseOrder } = require('../models');
const { auth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const getCached = (key) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// GET /api/dashboard/summary
router.get(
  '/summary',
  auth,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const cacheKey = `summary:${tenantId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const tenantObjId = new mongoose.Types.ObjectId(tenantId);

    const [
      inventoryStats,
      orderStats,
      lowStockCount,
      pendingPOs,
      totalProducts,
    ] = await Promise.all([
      // Total inventory value and count
      Variant.aggregate([
        { $match: { tenantId: tenantObjId, isActive: true } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
            totalCostValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
            totalStock: { $sum: '$stock' },
            totalVariants: { $sum: 1 },
          },
        },
      ]),

      // Order stats (last 30 days)
      Order.aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]),

      // Low stock items count
      Variant.countDocuments({
        tenantId: tenantObjId,
        isActive: true,
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      }),

      // Pending POs count
      PurchaseOrder.countDocuments({
        tenantId: tenantObjId,
        status: { $in: ['draft', 'sent', 'confirmed', 'partially_received'] },
      }),

      // Total products
      Product.countDocuments({ tenantId: tenantObjId, isActive: true }),
    ]);

    const inv = inventoryStats[0] || {
      totalValue: 0,
      totalCostValue: 0,
      totalStock: 0,
      totalVariants: 0,
    };

    const ordersByStatus = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    orderStats.forEach((s) => {
      ordersByStatus[s._id] = { count: s.count, amount: s.totalAmount };
      if (s._id !== 'cancelled') {
        totalRevenue += s.totalAmount;
        totalOrders += s.count;
      }
    });

    const result = {
      inventory: {
        totalProducts,
        totalVariants: inv.totalVariants,
        totalStock: inv.totalStock,
        totalValue: Math.round(inv.totalValue * 100) / 100,
        totalCostValue: Math.round(inv.totalCostValue * 100) / 100,
      },
      orders: {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        byStatus: ordersByStatus,
      },
      alerts: {
        lowStockItems: lowStockCount,
        pendingPurchaseOrders: pendingPOs,
      },
    };

    setCache(cacheKey, result);
    res.json(result);
  })
);

// GET /api/dashboard/top-sellers - Top 5 products (30 days)
router.get(
  '/top-sellers',
  auth,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const cacheKey = `topSellers:${tenantId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenantObjId = new mongoose.Types.ObjectId(tenantId);

    const topSellers = await Order.aggregate([
      {
        $match: {
          tenantId: tenantObjId,
          status: { $ne: 'cancelled' },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    const result = { topSellers };
    setCache(cacheKey, result);
    res.json(result);
  })
);

// GET /api/dashboard/stock-movements - Movement graph (7 days)
router.get(
  '/stock-movements',
  auth,
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const cacheKey = `stockMovements:${tenantId}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const tenantObjId = new mongoose.Types.ObjectId(tenantId);

    const movements = await StockMovement.aggregate([
      {
        $match: {
          tenantId: tenantObjId,
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$type',
          },
          totalQuantity: { $sum: { $abs: '$quantity' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Transform into chart-friendly format
    const dateMap = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      dateMap[key] = { date: key, purchase: 0, sale: 0, return: 0, adjustment: 0 };
    }

    movements.forEach((m) => {
      if (dateMap[m._id.date]) {
        dateMap[m._id.date][m._id.type] = m.totalQuantity;
      }
    });

    const result = { movements: Object.values(dateMap) };
    setCache(cacheKey, result);
    res.json(result);
  })
);

module.exports = router;
