import prisma from "./db.server";
import type { Bundle } from "@prisma/client";

// Types for analytics data
export interface BundleStats {
  impressions: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
  orderCount: number;
  totalOrderValue: number;
  conversionRate: number;
  aov: number;
}

export interface DailyStats extends BundleStats {
  date: string;
}

export interface AnalyticsSummary {
  totalImpressions: number;
  totalClicks: number;
  totalAddToCarts: number;
  totalPurchases: number;
  totalRevenue: number;
  overallConversionRate: string;
  overallAov: string;
  clickThroughRate: string;
}

export interface BundleReport {
  summary: AnalyticsSummary;
  dailyData: DailyStats[];
  topBundles: BundlePerformance[];
}

export interface BundlePerformance {
  bundleId: string;
  bundleName: string;
  totalPurchases: number;
  totalRevenue: number;
  conversionRate: string;
}

/**
 * Get bundle performance report for a shop within a date range
 */
export async function getBundleReport(
  shop: string,
  startDate: Date,
  endDate: Date,
  bundleId?: string
): Promise<BundleReport> {
  // Build query filter
  const whereClause: any = {
    shop,
    date: { gte: startDate, lte: endDate },
  };
  if (bundleId) {
    whereClause.bundleId = bundleId;
  }

  // Fetch daily stats
  const stats = await prisma.bundleStats.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  // Fetch bundles for name lookup
  const bundles = await prisma.bundle.findMany({
    where: { shop },
    select: { id: true, name: true },
  });
  const bundleNameMap = new Map(bundles.map((b) => [b.id, b.name]));

  // Aggregate totals
  const totals = stats.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      addToCarts: acc.addToCarts + s.addToCarts,
      purchases: acc.purchases + s.purchases,
      revenue: acc.revenue + s.revenue,
    }),
    { impressions: 0, clicks: 0, addToCarts: 0, purchases: 0, revenue: 0 }
  );

  // Calculate summary metrics
  const summary: AnalyticsSummary = {
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalAddToCarts: totals.addToCarts,
    totalPurchases: totals.purchases,
    totalRevenue: totals.revenue,
    overallConversionRate:
      totals.impressions > 0
        ? ((totals.purchases / totals.impressions) * 100).toFixed(2) + "%"
        : "0%",
    overallAov:
      totals.purchases > 0
        ? (totals.revenue / totals.purchases).toFixed(2)
        : "0",
    clickThroughRate:
      totals.impressions > 0
        ? ((totals.clicks / totals.impressions) * 100).toFixed(2) + "%"
        : "0%",
  };

  // Format daily data
  const dailyData: DailyStats[] = stats.map((s) => ({
    date: s.date.toISOString().split("T")[0],
    impressions: s.impressions,
    clicks: s.clicks,
    addToCarts: s.addToCarts,
    purchases: s.purchases,
    revenue: s.revenue,
    orderCount: s.orderCount,
    totalOrderValue: s.totalOrderValue,
    conversionRate: s.conversionRate,
    aov: s.aov,
  }));

  // Aggregate by bundle for top bundles
  const bundleAggregates = stats.reduce((acc: Map<string, BundleStats>, s) => {
    const existing = acc.get(s.bundleId) || {
      impressions: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
      revenue: 0,
      orderCount: 0,
      totalOrderValue: 0,
      conversionRate: 0,
      aov: 0,
    };
    acc.set(s.bundleId, {
      impressions: existing.impressions + s.impressions,
      clicks: existing.clicks + s.clicks,
      addToCarts: existing.addToCarts + s.addToCarts,
      purchases: existing.purchases + s.purchases,
      revenue: existing.revenue + s.revenue,
      orderCount: existing.orderCount + s.orderCount,
      totalOrderValue: existing.totalOrderValue + s.totalOrderValue,
      conversionRate: 0,
      aov: 0,
    });
    return acc;
  }, new Map());

  const topBundles: BundlePerformance[] = Array.from(bundleAggregates.entries())
    .map(([id, data]) => ({
      bundleId: id,
      bundleName: bundleNameMap.get(id) || "Unknown Bundle",
      totalPurchases: data.purchases,
      totalRevenue: data.revenue,
      conversionRate:
        data.impressions > 0
          ? ((data.purchases / data.impressions) * 100).toFixed(2) + "%"
          : "0%",
    }))
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, 5);

  return { summary, dailyData, topBundles };
}

/**
 * Get KPIs for merchant dashboard
 */
export async function getMerchantKPIs(shop: string): Promise<{
  totalBundles: number;
  activeBundles: number;
  totalRevenue: number;
  avgConversionRate: string;
  periodChange: { revenue: string; conversion: string };
}> {
  const bundles = await prisma.bundle.findMany({
    where: { shop },
    select: { id: true, status: true },
  });

  const activeBundles = bundles.filter((b) => b.status === "active").length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [currentPeriod, previousPeriod] = await Promise.all([
    prisma.bundleStats.findMany({
      where: { shop, date: { gte: thirtyDaysAgo } },
    }),
    prisma.bundleStats.findMany({
      where: { shop, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
  ]);

  // Aggregate current period
  const current = currentPeriod.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      purchases: acc.purchases + s.purchases,
      revenue: acc.revenue + s.revenue,
    }),
    { impressions: 0, purchases: 0, revenue: 0 }
  );

  // Aggregate previous period
  const previous = previousPeriod.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      purchases: acc.purchases + s.purchases,
      revenue: acc.revenue + s.revenue,
    }),
    { impressions: 0, purchases: 0, revenue: 0 }
  );

  // Calculate changes
  const revenueChange =
    previous.revenue > 0
      ? (((current.revenue - previous.revenue) / previous.revenue) * 100).toFixed(1)
      : "0";

  const currentConversion =
    current.impressions > 0 ? (current.purchases / current.impressions) * 100 : 0;
  const previousConversion =
    previous.impressions > 0 ? (previous.purchases / previous.impressions) * 100 : 0;

  const conversionChange =
    previousConversion > 0
      ? (((currentConversion - previousConversion) / previousConversion) * 100).toFixed(1)
      : "0";

  return {
    totalBundles: bundles.length,
    activeBundles,
    totalRevenue: current.revenue,
    avgConversionRate: currentConversion.toFixed(2) + "%",
    periodChange: {
      revenue: (parseFloat(revenueChange) >= 0 ? "+" : "") + revenueChange + "%",
      conversion: (parseFloat(conversionChange) >= 0 ? "+" : "") + conversionChange + "%",
    },
  };
}

/**
 * Get cohort analysis data
 */
export async function getCohortAnalysis(
  shop: string,
  bundleId?: string
): Promise<{
  cohorts: { period: string; bundles: number; revenue: number; avgConversion: string }[];
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const whereClause: any = { shop, date: { gte: thirtyDaysAgo } };
  if (bundleId) {
    whereClause.bundleId = bundleId;
  }

  const stats = await prisma.bundleStats.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  // Group by week
  const weeklyData = new Map<string, { impressions: number; purchases: number; revenue: number; bundleIds: Set<string> }>();

  for (const stat of stats) {
    const weekStart = getWeekStart(stat.date);
    const weekKey = weekStart.toISOString().split("T")[0];

    const existing = weeklyData.get(weekKey) || {
      impressions: 0,
      purchases: 0,
      revenue: 0,
      bundleIds: new Set(),
    };

    existing.impressions += stat.impressions;
    existing.purchases += stat.purchases;
    existing.revenue += stat.revenue;
    existing.bundleIds.add(stat.bundleId);

    weeklyData.set(weekKey, existing);
  }

  const cohorts = Array.from(weeklyData.entries())
    .map(([period, data]) => ({
      period,
      bundles: data.bundleIds.size,
      revenue: data.revenue,
      avgConversion:
        data.impressions > 0
          ? ((data.purchases / data.impressions) * 100).toFixed(2) + "%"
          : "0%",
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { cohorts };
}

// Immutable date helpers
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

/**
 * Get all bundles with their latest stats
 */
export async function getBundlesWithStats(
  shop: string
): Promise<(Bundle & { stats: BundleStats | null })[]> {
  const bundles = await prisma.bundle.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const stats = await prisma.bundleStats.findMany({
    where: {
      shop,
      bundleId: { in: bundles.map((b) => b.id) },
      date: { gte: thirtyDaysAgo },
    },
  });

  // Aggregate stats by bundle
  const statsByBundle = new Map<string, BundleStats>();
  for (const stat of stats) {
    const existing = statsByBundle.get(stat.bundleId) || {
      impressions: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
      revenue: 0,
      orderCount: 0,
      totalOrderValue: 0,
      conversionRate: 0,
      aov: 0,
    };

    statsByBundle.set(stat.bundleId, {
      impressions: existing.impressions + stat.impressions,
      clicks: existing.clicks + stat.clicks,
      addToCarts: existing.addToCarts + stat.addToCarts,
      purchases: existing.purchases + stat.purchases,
      revenue: existing.revenue + stat.revenue,
      orderCount: existing.orderCount + stat.orderCount,
      totalOrderValue: existing.totalOrderValue + stat.totalOrderValue,
      conversionRate: 0,
      aov: 0,
    });
  }

  return bundles.map((bundle) => ({
    ...bundle,
    stats: statsByBundle.get(bundle.id) || null,
  }));
}

// ============================================
// Data Pipeline Functions for Analytics
// ============================================

/**
 * Track a bundle purchase event
 * Writes to BundleEvent and updates BundleStats
 */
export async function trackBundlePurchase(
  shop: string,
  bundleId: string,
  orderId: string,
  orderValue: number,
  productIds: string[]
): Promise<void> {
  const today = startOfDay(new Date());

  // 1. Create BundleEvent record for real-time event stream
  await prisma.bundleEvent.create({
    data: {
      shop,
      bundleId,
      eventType: "purchase",
      orderId,
      productIds: JSON.stringify(productIds),
      orderValue,
      createdAt: new Date(),
    },
  });

  // 2. Upsert BundleStats for today (real-time aggregation)
  const existingStats = await prisma.bundleStats.findUnique({
    where: {
      shop_bundleId_date: { shop, bundleId, date: today },
    },
  });

  if (existingStats) {
    // Update existing daily stats
    await prisma.bundleStats.update({
      where: { id: existingStats.id },
      data: {
        purchases: existingStats.purchases + 1,
        revenue: existingStats.revenue + orderValue,
        orderCount: existingStats.orderCount + 1,
        totalOrderValue: existingStats.totalOrderValue + orderValue,
        // Recalculate metrics
        conversionRate: existingStats.impressions > 0
          ? ((existingStats.purchases + 1) / existingStats.impressions) * 100
          : 0,
        aov: (existingStats.totalOrderValue + orderValue) / (existingStats.orderCount + 1),
      },
    });
  } else {
    // Create new daily stats record
    await prisma.bundleStats.create({
      data: {
        shop,
        bundleId,
        date: today,
        purchases: 1,
        revenue: orderValue,
        orderCount: 1,
        totalOrderValue: orderValue,
        conversionRate: 0, // Will be calculated when impressions are tracked
        aov: orderValue,
        impressions: 0,
        clicks: 0,
        addToCarts: 0,
      },
    });
  }
}

/**
 * Aggregate daily stats from BundleEvent
 * This is useful for re-processing or backfilling data
 * In production, stats are updated in real-time, but this can run as a verification job
 */
export async function aggregateDailyStats(targetDate?: Date): Promise<{
  processedEvents: number;
  updatedStats: number;
}> {
  const date = targetDate ? startOfDay(targetDate) : startOfDay(new Date());
  const nextDate = new Date(date.getTime() + 86400000);

  // Get all events for the target date
  const events = await prisma.bundleEvent.findMany({
    where: {
      createdAt: {
        gte: date,
        lt: nextDate,
      },
    },
  });

  // Group events by shop and bundle
  const eventGroups = new Map<string, typeof events>();
  for (const event of events) {
    const key = `${event.shop}:${event.bundleId}`;
    const group = eventGroups.get(key) || [];
    group.push(event);
    eventGroups.set(key, group);
  }

  let updatedStats = 0;

  // Process each group and update/insert BundleStats
  for (const [key, groupEvents] of eventGroups) {
    const [shop, bundleId] = key.split(":");

    // Calculate aggregates
    const totalOrderValue = groupEvents.reduce((sum, e) => sum + (e.orderValue || 0), 0);
    const orderIds = new Set(groupEvents.map(e => e.orderId)).size;

    // Upsert stats
    const existing = await prisma.bundleStats.findUnique({
      where: { shop_bundleId_date: { shop, bundleId, date } },
    });

    if (existing) {
      await prisma.bundleStats.update({
        where: { id: existing.id },
        data: {
          purchases: groupEvents.length,
          revenue: totalOrderValue,
          orderCount: orderIds,
          totalOrderValue,
          conversionRate: existing.impressions > 0
            ? (groupEvents.length / existing.impressions) * 100
            : 0,
          aov: orderIds > 0 ? totalOrderValue / orderIds : 0,
        },
      });
    } else {
      await prisma.bundleStats.create({
        data: {
          shop,
          bundleId,
          date,
          purchases: groupEvents.length,
          revenue: totalOrderValue,
          orderCount: orderIds,
          totalOrderValue,
          conversionRate: 0,
          aov: orderIds > 0 ? totalOrderValue / orderIds : 0,
          impressions: 0,
          clicks: 0,
          addToCarts: 0,
        },
      });
    }
    updatedStats++;
  }

  return { processedEvents: events.length, updatedStats };
}

/**
 * Track impression event (for conversion funnel)
 */
export async function trackBundleImpression(
  shop: string,
  bundleId: string,
  sessionId: string,
  source: string = "product_page"
): Promise<void> {
  const today = startOfDay(new Date());

  // Create impression event
  await prisma.bundleEvent.create({
    data: {
      shop,
      bundleId,
      eventType: "impression",
      sessionId,
      source,
      createdAt: new Date(),
    },
  });

  // Update daily stats
  const existingStats = await prisma.bundleStats.findUnique({
    where: { shop_bundleId_date: { shop, bundleId, date: today } },
  });

  if (existingStats) {
    await prisma.bundleStats.update({
      where: { id: existingStats.id },
      data: { impressions: existingStats.impressions + 1 },
    });
  } else {
    await prisma.bundleStats.create({
      data: { shop, bundleId, date: today, impressions: 1 },
    });
  }
}

/**
 * Track click event
 */
export async function trackBundleClick(
  shop: string,
  bundleId: string,
  sessionId: string,
  source: string = "product_page"
): Promise<void> {
  const today = startOfDay(new Date());

  await prisma.bundleEvent.create({
    data: {
      shop,
      bundleId,
      eventType: "click",
      sessionId,
      source,
      createdAt: new Date(),
    },
  });

  const existingStats = await prisma.bundleStats.findUnique({
    where: { shop_bundleId_date: { shop, bundleId, date: today } },
  });

  if (existingStats) {
    await prisma.bundleStats.update({
      where: { id: existingStats.id },
      data: { clicks: existingStats.clicks + 1 },
    });
  } else {
    await prisma.bundleStats.create({
      data: { shop, bundleId, date: today, clicks: 1 },
    });
  }
}

/**
 * Track add-to-cart event
 */
export async function trackBundleAddToCart(
  shop: string,
  bundleId: string,
  sessionId: string,
  cartValue: number,
  source: string = "product_page"
): Promise<void> {
  const today = startOfDay(new Date());

  await prisma.bundleEvent.create({
    data: {
      shop,
      bundleId,
      eventType: "add_to_cart",
      sessionId,
      cartValue,
      source,
      createdAt: new Date(),
    },
  });

  const existingStats = await prisma.bundleStats.findUnique({
    where: { shop_bundleId_date: { shop, bundleId, date: today } },
  });

  if (existingStats) {
    await prisma.bundleStats.update({
      where: { id: existingStats.id },
      data: { addToCarts: existingStats.addToCarts + 1 },
    });
  } else {
    await prisma.bundleStats.create({
      data: { shop, bundleId, date: today, addToCarts: 1 },
    });
  }
}