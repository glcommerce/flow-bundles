import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBundleReport,
  getMerchantKPIs,
  getCohortAnalysis,
  getBundlesWithStats,
  trackBundlePurchase,
  trackBundleImpression,
  trackBundleClick,
  trackBundleAddToCart,
} from '../../app/analytics.server';
import prisma from '../../app/db.server';
import type { Bundle, BundleType, DiscountType, BundleStatus } from '@prisma/client';

function createMockBundleStats(overrides: any = {}) {
  return {
    id: 'stats-1',
    shop: 'test-shop.myshopify.com',
    bundleId: 'bundle-123',
    date: new Date('2024-01-15'),
    impressions: 100,
    clicks: 20,
    addToCarts: 10,
    purchases: 5,
    revenue: 500.00,
    orderCount: 5,
    totalOrderValue: 500.00,
    conversionRate: 5.0,
    aov: 100.00,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockBundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    id: 'bundle-123',
    shop: 'test-shop.myshopify.com',
    name: 'Test Bundle',
    description: 'Test description',
    bundleType: 'FIXED' as BundleType,
    discountType: 'fixed_amount' as DiscountType,
    discountValue: 99.00,
    minQuantity: 3,
    productIds: JSON.stringify(['product-1', 'product-2', 'product-3']),
    productFilter: null,
    status: 'active' as BundleStatus,
    metafieldNamespace: 'flowcart_bundles',
    metafieldKey: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('Analytics Server Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBundleReport', () => {
    it('should return empty report when no stats exist', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleStatsMock.findMany.mockResolvedValue([]);
      prismaBundleMock.findMany.mockResolvedValue([]);

      const result = await getBundleReport(
        'test-shop.myshopify.com',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.summary.totalImpressions).toBe(0);
      expect(result.summary.totalPurchases).toBe(0);
      expect(result.dailyData).toHaveLength(0);
      expect(result.topBundles).toHaveLength(0);
    });

    it('should aggregate stats correctly', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);
      const prismaBundleMock = vi.mocked(prisma.bundle);

      const mockStats = [
        createMockBundleStats({ date: new Date('2024-01-15'), impressions: 100, clicks: 20, purchases: 5, revenue: 500 }),
        createMockBundleStats({ date: new Date('2024-01-16'), impressions: 150, clicks: 30, purchases: 8, revenue: 800 }),
      ];

      prismaBundleStatsMock.findMany.mockResolvedValue(mockStats);
      prismaBundleMock.findMany.mockResolvedValue([createMockBundle()]);

      const result = await getBundleReport(
        'test-shop.myshopify.com',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.summary.totalImpressions).toBe(250);
      expect(result.summary.totalClicks).toBe(50);
      expect(result.summary.totalPurchases).toBe(13);
      expect(result.summary.totalRevenue).toBe(1300);
      expect(result.summary.overallConversionRate).toBe('5.20%');
    });

    it('should calculate click-through rate correctly', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);
      const prismaBundleMock = vi.mocked(prisma.bundle);

      const mockStats = [
        createMockBundleStats({ impressions: 100, clicks: 25, purchases: 5 }),
      ];

      prismaBundleStatsMock.findMany.mockResolvedValue(mockStats);
      prismaBundleMock.findMany.mockResolvedValue([createMockBundle()]);

      const result = await getBundleReport(
        'test-shop.myshopify.com',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.summary.clickThroughRate).toBe('25.00%');
    });

    it('should filter by bundleId when provided', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleStatsMock.findMany.mockResolvedValue([]);
      prismaBundleMock.findMany.mockResolvedValue([]);

      await getBundleReport(
        'test-shop.myshopify.com',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        'bundle-456'
      );

      expect(prismaBundleStatsMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bundleId: 'bundle-456',
          }),
        })
      );
    });
  });

  describe('getMerchantKPIs', () => {
    it('should return correct KPI structure', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleMock.findMany.mockResolvedValue([
        createMockBundle({ id: 'bundle-1', status: 'active' }),
        createMockBundle({ id: 'bundle-2', status: 'active' }),
        createMockBundle({ id: 'bundle-3', status: 'paused' }),
      ]);

      prismaBundleStatsMock.findMany.mockResolvedValue([]);

      const result = await getMerchantKPIs('test-shop.myshopify.com');

      expect(result.totalBundles).toBe(3);
      expect(result.activeBundles).toBe(2);
      expect(result.totalRevenue).toBe(0);
      expect(result.periodChange).toHaveProperty('revenue');
      expect(result.periodChange).toHaveProperty('conversion');
    });

    it('should calculate period-over-period changes', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleMock.findMany.mockResolvedValue([createMockBundle()]);

      // Current period: 100 revenue, 10 purchases / 1000 impressions = 1% conversion
      // Previous period: 50 revenue, 5 purchases / 500 impressions = 1% conversion
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      prismaBundleStatsMock.findMany.mockImplementation(async ({ where }: any) => {
        if (where.date.gte && where.date.lt) {
          // Previous period
          return [createMockBundleStats({ impressions: 500, purchases: 5, revenue: 50 })];
        }
        // Current period
        return [createMockBundleStats({ impressions: 1000, purchases: 10, revenue: 100 })];
      });

      const result = await getMerchantKPIs('test-shop.myshopify.com');

      expect(result.totalRevenue).toBe(100);
      expect(result.periodChange.revenue).toBe('+100.0%');
    });
  });

  describe('getCohortAnalysis', () => {
    it('should return empty cohorts when no data', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleStatsMock.findMany.mockResolvedValue([]);

      const result = await getCohortAnalysis('test-shop.myshopify.com');

      expect(result.cohorts).toHaveLength(0);
    });

    it('should group stats by week', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      // Two stats in the same week
      const weekStart = new Date('2024-01-15');
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

      const mockStats = [
        createMockBundleStats({ date: new Date('2024-01-15'), revenue: 100, purchases: 2, impressions: 50 }),
        createMockBundleStats({ date: new Date('2024-01-17'), revenue: 200, purchases: 4, impressions: 100 }),
      ];

      prismaBundleStatsMock.findMany.mockResolvedValue(mockStats);

      const result = await getCohortAnalysis('test-shop.myshopify.com');

      expect(result.cohorts.length).toBeGreaterThan(0);
    });

    it('should filter by bundleId when provided', async () => {
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleStatsMock.findMany.mockResolvedValue([]);

      await getCohortAnalysis('test-shop.myshopify.com', 'bundle-123');

      expect(prismaBundleStatsMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bundleId: 'bundle-123',
          }),
        })
      );
    });
  });

  describe('getBundlesWithStats', () => {
    it('should return bundles with null stats when no stats exist', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleMock.findMany.mockResolvedValue([createMockBundle()]);
      prismaBundleStatsMock.findMany.mockResolvedValue([]);

      const result = await getBundlesWithStats('test-shop.myshopify.com');

      expect(result).toHaveLength(1);
      expect(result[0].stats).toBeNull();
    });

    it('should aggregate stats for each bundle', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      const bundles = [
        createMockBundle({ id: 'bundle-1' }),
        createMockBundle({ id: 'bundle-2' }),
      ];

      prismaBundleMock.findMany.mockResolvedValue(bundles);
      prismaBundleStatsMock.findMany.mockResolvedValue([
        createMockBundleStats({ bundleId: 'bundle-1', revenue: 100, purchases: 2 }),
        createMockBundleStats({ bundleId: 'bundle-1', revenue: 50, purchases: 1 }),
        createMockBundleStats({ bundleId: 'bundle-2', revenue: 200, purchases: 5 }),
      ]);

      const result = await getBundlesWithStats('test-shop.myshopify.com');

      expect(result).toHaveLength(2);
      expect(result[0].stats).not.toBeNull();
      expect(result[0].stats?.revenue).toBe(150);
      expect(result[0].stats?.purchases).toBe(3);
    });
  });

  describe('trackBundlePurchase', () => {
    it('should create BundleEvent and update BundleStats', async () => {
      const prismaBundleEventMock = vi.mocked(prisma.bundleEvent);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleEventMock.create.mockResolvedValue({ id: 'event-1' } as any);
      prismaBundleStatsMock.findUnique.mockResolvedValue(null);
      prismaBundleStatsMock.create.mockResolvedValue(createMockBundleStats() as any);

      await trackBundlePurchase(
        'test-shop.myshopify.com',
        'bundle-123',
        'order-456',
        99.99,
        ['product-1', 'product-2']
      );

      expect(prismaBundleEventMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shop: 'test-shop.myshopify.com',
          bundleId: 'bundle-123',
          eventType: 'purchase',
          orderId: 'order-456',
          orderValue: 99.99,
          productIds: '["product-1","product-2"]',
        }),
      });
    });

    it('should update existing daily stats', async () => {
      const prismaBundleEventMock = vi.mocked(prisma.bundleEvent);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      const existingStats = createMockBundleStats({ revenue: 100, purchases: 2, orderCount: 2 });

      prismaBundleEventMock.create.mockResolvedValue({ id: 'event-1' } as any);
      prismaBundleStatsMock.findUnique.mockResolvedValue(existingStats as any);
      prismaBundleStatsMock.update.mockResolvedValue(existingStats as any);

      await trackBundlePurchase(
        'test-shop.myshopify.com',
        'bundle-123',
        'order-789',
        50.00,
        ['product-1']
      );

      expect(prismaBundleStatsMock.update).toHaveBeenCalledWith({
        where: { id: existingStats.id },
        data: expect.objectContaining({
          purchases: 3,
          revenue: 150,
          orderCount: 3,
        }),
      });
    });
  });

  describe('trackBundleImpression', () => {
    it('should create impression event and update stats', async () => {
      const prismaBundleEventMock = vi.mocked(prisma.bundleEvent);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleEventMock.create.mockResolvedValue({ id: 'event-1' } as any);
      prismaBundleStatsMock.findUnique.mockResolvedValue(null);
      prismaBundleStatsMock.create.mockResolvedValue(createMockBundleStats() as any);

      await trackBundleImpression('test-shop.myshopify.com', 'bundle-123', 'session-456');

      expect(prismaBundleEventMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'impression',
          sessionId: 'session-456',
        }),
      });
    });
  });

  describe('trackBundleClick', () => {
    it('should create click event and update stats', async () => {
      const prismaBundleEventMock = vi.mocked(prisma.bundleEvent);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleEventMock.create.mockResolvedValue({ id: 'event-1' } as any);
      prismaBundleStatsMock.findUnique.mockResolvedValue(null);
      prismaBundleStatsMock.create.mockResolvedValue(createMockBundleStats() as any);

      await trackBundleClick('test-shop.myshopify.com', 'bundle-123', 'session-456');

      expect(prismaBundleEventMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'click',
          sessionId: 'session-456',
        }),
      });
    });
  });

  describe('trackBundleAddToCart', () => {
    it('should create add_to_cart event with cart value', async () => {
      const prismaBundleEventMock = vi.mocked(prisma.bundleEvent);
      const prismaBundleStatsMock = vi.mocked(prisma.bundleStats);

      prismaBundleEventMock.create.mockResolvedValue({ id: 'event-1' } as any);
      prismaBundleStatsMock.findUnique.mockResolvedValue(null);
      prismaBundleStatsMock.create.mockResolvedValue(createMockBundleStats() as any);

      await trackBundleAddToCart(
        'test-shop.myshopify.com',
        'bundle-123',
        'session-456',
        149.99
      );

      expect(prismaBundleEventMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'add_to_cart',
          cartValue: 149.99,
        }),
      });
    });
  });
});