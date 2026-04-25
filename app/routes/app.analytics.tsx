import type { LoaderFunctionArgs } from "react-router";
import { json, useLoaderData, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getMerchantKPIs,
  getBundleReport,
  getCohortAnalysis,
} from "../analytics.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  ProgressBar,
  DataTable,
  Select,
  EmptyState,
} from "@shopify/polaris";
import styles from "./app.analytics.css?url";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";
  const bundleId = url.searchParams.get("bundle") || undefined;

  // Calculate date range using immutable pattern
  const endDate = new Date();
  let startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  switch (period) {
    case "7d":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch all data in parallel
  const [kpis, report, cohort] = await Promise.all([
    getMerchantKPIs(shop),
    getBundleReport(shop, startDate, endDate, bundleId),
    getCohortAnalysis(shop, bundleId),
  ]);

  return json({
    kpis,
    report,
    cohort,
    period,
    bundleId: bundleId || null,
  });
}

export default function AnalyticsDashboard() {
  const { kpis, report, cohort, period, bundleId } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handlePeriodChange = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("period", value);
    setSearchParams(newParams);
  };

  // Calculate conversion bar width
  const conversionRate = parseFloat(kpis.avgConversionRate.replace("%", ""));
  const conversionBarWidth = Math.min(conversionRate, 100);

  // Determine change colors
  const revenueChangePositive = kpis.periodChange.revenue.startsWith("+");
  const conversionChangePositive = kpis.periodChange.conversion.startsWith("+");

  return (
    <Page title="数据看板" fullWidth>
      <Layout>
        {/* Header Controls */}
        <Layout.Section>
          <Card>
            <div className={styles.analyticsHeader}>
              <Text variant="headingMd" as="h2">捆绑销售分析</Text>
              <div className={styles.periodSelector}>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "最近7天", value: "7d" },
                    { label: "最近30天", value: "30d" },
                    { label: "最近90天", value: "90d" },
                  ]}
                  value={period}
                  onChange={handlePeriodChange}
                />
              </div>
            </div>
          </Card>
        </Layout.Section>

        {/* KPI Cards */}
        <Layout.Section>
          <div className={styles.kpiGrid}>
            {/* Total Bundles */}
            <Card>
              <BlockStack align="center" gap="2">
                <Text variant="headingLg" as="p" fontWeight="bold">{kpis.totalBundles}</Text>
                <Text variant="bodySm" as="p" tone="subdued">总套餐数</Text>
                <Badge tone="success">{kpis.activeBundles} 活跃</Badge>
              </BlockStack>
            </Card>

            {/* Total Revenue */}
            <Card>
              <BlockStack align="center" gap="2">
                <Text variant="headingLg" as="p" fontWeight="bold">
                  ${kpis.totalRevenue.toFixed(2)}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">总营收</Text>
                <Text
                  variant="bodySm"
                  as="p"
                  tone={revenueChangePositive ? "success" : "critical"}
                >
                  {kpis.periodChange.revenue} 环比
                </Text>
              </BlockStack>
            </Card>

            {/* Conversion Rate */}
            <Card>
              <BlockStack align="center" gap="2">
                <Text variant="headingLg" as="p" fontWeight="bold">
                  {kpis.avgConversionRate}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">平均转化率</Text>
                <div className={styles.progressBarWrapper}>
                  <ProgressBar
                    progress={conversionBarWidth}
                    color="success"
                    size="small"
                  />
                </div>
              </BlockStack>
            </Card>

            {/* Period Change */}
            <Card>
              <BlockStack align="center" gap="2">
                <Text variant="headingLg" as="p" fontWeight="bold" tone="success">
                  {kpis.periodChange.conversion}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">转化率变化</Text>
                <Text
                  variant="bodySm"
                  as="p"
                  tone={conversionChangePositive ? "success" : "critical"}
                >
                  vs 上期
                </Text>
              </BlockStack>
            </Card>
          </div>
        </Layout.Section>

        {/* Summary Metrics */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h3" className={styles.sectionTitle}>关键指标概览</Text>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <Text variant="headingMd" as="p" fontWeight="bold">
                    {report.summary.totalImpressions.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">总展示次数</Text>
                </div>
                <div className={styles.metricCard}>
                  <Text variant="headingMd" as="p" fontWeight="bold">
                    {report.summary.totalClicks.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">总点击次数</Text>
                </div>
                <div className={styles.metricCard}>
                  <Text variant="headingMd" as="p" fontWeight="bold">
                    {report.summary.totalPurchases.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">总购买次数</Text>
                </div>
              </div>
              <div className={styles.metricsRow}>
                <div className={`${styles.metricCard} ${styles.metricHighlight}`}>
                  <Text variant="headingMd" as="p" fontWeight="bold">
                    {report.summary.clickThroughRate}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">点击率 (CTR)</Text>
                </div>
                <div className={`${styles.metricCard} ${styles.metricHighlight}`}>
                  <Text variant="headingMd" as="p" fontWeight="bold">
                    ${report.summary.overallAov}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">平均订单价值 (AOV)</Text>
                </div>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Top Bundles Performance */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h3" className={styles.sectionTitle}>热门套餐 TOP 5</Text>
              {report.topBundles.length === 0 ? (
                <EmptyState
                  heading="暂无数据"
                  image="https://cdn.shopify.com/s/files/1/0266/0559/6564/files/emptystate-files.svg"
                >
                  <p>创建套餐并开始销售后，这里将显示性能数据。</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "numeric"]}
                  headings={["套餐名称", "购买次数", "营收", "转化率"]}
                  rows={report.topBundles.map((bundle) => [
                    bundle.bundleName,
                    bundle.totalPurchases.toString(),
                    `$${bundle.totalRevenue.toFixed(2)}`,
                    bundle.conversionRate,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Cohort Analysis */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h3" className={styles.sectionTitle}>周趋势分析</Text>
              {cohort.cohorts.length === 0 ? (
                <EmptyState
                  heading="暂无趋势数据"
                  image="https://cdn.shopify.com/s/files/1/0266/0559/6564/files/emptystate-files.svg"
                >
                  <p>积累销售数据后，将显示周趋势分析。</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "text"]}
                  headings={["周期", "活跃套餐数", "营收", "平均转化率"]}
                  rows={cohort.cohorts.map((c) => [
                    c.period,
                    c.bundles.toString(),
                    `$${c.revenue.toFixed(2)}`,
                    c.avgConversion,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Daily Data Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="4">
              <Text variant="headingMd" as="h3" className={styles.sectionTitle}>每日详细数据</Text>
              {report.dailyData.length === 0 ? (
                <EmptyState
                  heading="暂无每日数据"
                  image="https://cdn.shopify.com/s/files/1/0266/0559/6564/files/emptystate-files.svg"
                >
                  <p>每日销售数据将显示在这里。</p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric", "numeric", "text"]}
                  headings={["日期", "展示", "点击", "加购", "购买", "营收", "转化率"]}
                  rows={report.dailyData.slice(-14).reverse().map((day) => [
                    day.date,
                    day.impressions.toString(),
                    day.clicks.toString(),
                    day.addToCarts.toString(),
                    day.purchases.toString(),
                    `$${day.revenue.toFixed(2)}`,
                    (day.conversionRate > 0 ? day.conversionRate.toFixed(2) : "0") + "%",
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}