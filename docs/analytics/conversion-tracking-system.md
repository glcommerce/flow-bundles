# FlowCart Bundles - 转化率统计系统设计

## 1. 数据表结构

### 1.1 BundleStats - 捆绑统计聚合表

```prisma
model BundleStats {
  id              String   @id @default(cuid())
  shop            String   // 店铺域名
  bundleId        String   // 捆绑配置ID
  date            DateTime // 统计日期

  // 使用次数
  impressions     Int      @default(0)  // 展示次数
  clicks          Int      @default(0)  // 点击次数
  addToCarts      Int      @default(0)  // 加入购物车次数

  // 转化数据
  purchases       Int      @default(0)  // 购买次数
  revenue         Decimal  @default(0)  // 捆绑带来的收入

  // 订单数据
  orderCount      Int      @default(0)  // 包含捆绑的订单数
  totalOrderValue Decimal  @default(0)  // 总订单价值

  // 计算指标
  conversionRate  Decimal  @default(0)  // 转化率 (purchases/impressions)
  aov             Decimal  @default(0)  // 平均订单价值

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([shop, bundleId, date])
  @@index([shop, date])
  @@index([bundleId])
}
```

### 1.2 BundleEvent - 捆绑事件日志表

```prisma
model BundleEvent {
  id              String   @id @default(cuid())
  shop            String
  bundleId        String
  eventType       String   // impression | click | add_to_cart | purchase

  // 上下文
  sessionId       String?  // 用户会话ID
  customerId      String?  // 客户ID（如果已登录）
  orderId         String?  // 订单ID（购买事件）

  // 产品信息
  productIds      String?  // 产品ID列表 (JSON)

  // 金额数据
  cartValue       Decimal? // 购物车价值
  orderValue      Decimal? // 订单价值

  // 元数据
  source          String?  // 来源: product_page | cart | checkout | storefront
  deviceType      String?  // 设备类型: desktop | mobile | tablet
  referrer        String?  // 来源页面

  createdAt       DateTime @default(now())

  @@index([shop, bundleId, eventType, createdAt])
  @@index([shop, createdAt])
  @@index([bundleId])
}
```

### 1.3 BundleAnalytics - 分析汇总表（月/周）

```prisma
model BundleAnalytics {
  id              String   @id @default(cuid())
  shop            String
  bundleId        String?
  periodType      String   // daily | weekly | monthly
  periodStart     DateTime
  periodEnd       DateTime

  // 汇总指标
  totalImpressions     Int      @default(0)
  totalClicks          Int      @default(0)
  totalAddToCarts      Int      @default(0)
  totalPurchases       Int      @default(0)
  totalRevenue         Decimal  @default(0)

  // 计算指标
  avgConversionRate    Decimal  @default(0)
  avgAov               Decimal  @default(0)

  // 点击率
  clickThroughRate     Decimal  @default(0)  // clicks/impressions

  // 环比变化
  conversionRateChange Decimal? // 与上期相比变化
  revenueChange        Decimal?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([shop, bundleId, periodType, periodStart])
  @@index([shop, periodType, periodStart])
}
```

### 1.4 BundleConfig - 捆绑配置表（扩展现有）

```prisma
model Bundle {
  id              String   @id @default(cuid())
  shop            String
  name            String
  bundleType      String   // FIXED | VOLUME | MIX_MATCH
  discountType    String   // percentage | fixed_amount
  discountValue   Decimal
  minQuantity     Int
  applicableProducts String // JSON array of product IDs
  productQuery    String?  // 自动匹配规则
  status          String   @default("active") // active | paused | archived
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([shop])
  @@index([shop, status])
}
```

---

## 2. 埋点方案

### 2.1 事件定义

| 事件名 | 触发时机 | 携带数据 |
|--------|----------|----------|
| `bundle_shown` | 捆绑产品展示给用户 | shop, bundleId, productIds, source |
| `bundle_clicked` | 用户点击捆绑区域 | shop, bundleId, sessionId |
| `bundle_add_to_cart` | 捆绑产品加入购物车 | shop, bundleId, cartValue, productIds |
| `bundle_purchase` | 订单完成（含捆绑） | shop, bundleId, orderId, orderValue, revenue |

### 2.2 埋点位置

```
┌─────────────────────────────────────────────────────────┐
│                    埋点触发流程                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. bundle_shown                                        │
│     └─ 产品详情页 / 购物车 / Storefront                 │
│     └─ 触发: bundle产品展示在页面上                    │
│                                                         │
│  2. bundle_clicked                                      │
│     └─ 产品详情页 / Storefront                          │
│     └─ 触发: 用户点击捆绑提示区域                       │
│                                                         │
│  3. bundle_add_to_cart                                  │
│     └─ 购物车页面 / Checkout                            │
│     └─ 触发: 购物车添加事件成功                         │
│                                                         │
│  4. bundle_purchase                                     │
│     └─ Checkout完成 / 订单创建Webhook                   │
│     └─ 触发: 订单支付成功                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 追踪代码示例

```typescript
// app/lib/analytics.ts
import prisma from '~/db.server';

type EventType = 'impression' | 'click' | 'add_to_cart' | 'purchase';

interface TrackEventParams {
  shop: string;
  bundleId: string;
  eventType: EventType;
  sessionId?: string;
  customerId?: string;
  orderId?: string;
  productIds?: string[];
  cartValue?: number;
  orderValue?: number;
  source?: string;
  deviceType?: string;
  referrer?: string;
}

export async function trackBundleEvent(params: TrackEventParams) {
  const {
    shop,
    bundleId,
    eventType,
    sessionId,
    customerId,
    orderId,
    productIds,
    cartValue,
    orderValue,
    source,
    deviceType,
    referrer,
  } = params;

  // 1. 记录原始事件
  await prisma.bundleEvent.create({
    data: {
      shop,
      bundleId,
      eventType,
      sessionId,
      customerId,
      orderId,
      productIds: productIds ? JSON.stringify(productIds) : null,
      cartValue: cartValue ? new Decimal(cartValue) : null,
      orderValue: orderValue ? new Decimal(orderValue) : null,
      source,
      deviceType,
      referrer,
    },
  });

  // 2. 更新每日统计
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await prisma.bundleStats.upsert({
    where: {
      shop_bundleId_date: { shop, bundleId, date: today },
    },
    update: {
      ...(eventType === 'impression' && { impressions: { increment: 1 } }),
      ...(eventType === 'click' && { clicks: { increment: 1 } }),
      ...(eventType === 'add_to_cart' && { addToCarts: { increment: 1 } }),
      ...(eventType === 'purchase' && {
        purchases: { increment: 1 },
        revenue: revenue ? { increment: revenue } : undefined,
        orderCount: { increment: 1 },
        totalOrderValue: orderValue ? { increment: orderValue } : undefined,
      }),
    },
    create: {
      shop,
      bundleId,
      date: today,
      impressions: eventType === 'impression' ? 1 : 0,
      clicks: eventType === 'click' ? 1 : 0,
      addToCarts: eventType === 'add_to_cart' ? 1 : 0,
      purchases: eventType === 'purchase' ? 1 : 0,
      revenue: eventType === 'purchase' && revenue ? revenue : 0,
      orderCount: eventType === 'purchase' ? 1 : 0,
      totalOrderValue: eventType === 'purchase' && orderValue ? orderValue : 0,
    },
  });

  // 3. 更新计算指标
  await updateCalculatedMetrics(stats);
}

async function updateCalculatedMetrics(stats: BundleStats) {
  const conversionRate = stats.impressions > 0
    ? (stats.purchases / stats.impressions) * 100
    : 0;

  const aov = stats.orderCount > 0
    ? stats.totalOrderValue / stats.orderCount
    : 0;

  await prisma.bundleStats.update({
    where: { id: stats.id },
    data: {
      conversionRate: new Decimal(conversionRate),
      aov: new Decimal(aov),
    },
  });
}
```

### 2.4 Shopify Webhook 集成

```typescript
// app/routes/webhooks.app.purchase.tsx
// 监听订单创建事件，追踪购买

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const { order_id, total_price, line_items, shop } = body;

  // 识别订单中的捆绑产品
  const bundleProducts = await identifyBundleProducts(order_id);

  for (const bundleId of bundleProducts) {
    await trackBundleEvent({
      shop,
      bundleId,
      eventType: 'purchase',
      orderId: String(order_id),
      orderValue: total_price,
      productIds: bundleProducts[bundleId],
    });
  }

  return json({ success: true });
}
```

---

## 3. 关键指标计算

### 3.1 核心指标公式

| 指标 | 公式 | 说明 |
|------|------|------|
| **展示转化率** | purchases / impressions × 100% | 展示到购买的转化 |
| **点击率 (CTR)** | clicks / impressions × 100% | 展示到点击 |
| **加入购物车率** | addToCarts / clicks × 100% | 点击到加购 |
| **购买转化率** | purchases / addToCarts × 100% | 加购到购买 |
| **AOV** | totalOrderValue / orderCount | 平均订单价值 |
| **捆绑收入占比** | bundleRevenue / totalRevenue × 100% | 捆绑贡献度 |

### 3.2 数据聚合查询

```typescript
// 获取捆绑效果报表
async function getBundleReport(shop: string, bundleId: string, startDate: Date, endDate: Date) {
  const stats = await prisma.bundleStats.findMany({
    where: { shop, bundleId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
  });

  const totals = stats.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      addToCarts: acc.addToCarts + s.addToCarts,
      purchases: acc.purchases + s.purchases,
      revenue: acc.revenue + s.revenue,
    }),
    { impressions: 0, clicks: 0, addToCarts: 0, purchases: 0, revenue: new Decimal(0) }
  );

  return {
    summary: {
      totalImpressions: totals.impressions,
      totalClicks: totals.clicks,
      totalAddToCarts: totals.addToCarts,
      totalPurchases: totals.purchases,
      totalRevenue: totals.revenue.toNumber(),
      overallConversionRate: totals.impressions > 0
        ? (totals.purchases / totals.impressions * 100).toFixed(2) + '%'
        : '0%',
      overallAov: totals.purchases > 0
        ? (totals.revenue.toNumber() / totals.purchases).toFixed(2)
        : '0',
      clickThroughRate: totals.impressions > 0
        ? (totals.clicks / totals.impressions * 100).toFixed(2) + '%'
        : '0%',
    },
    dailyData: stats.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      impressions: s.impressions,
      clicks: s.clicks,
      addToCarts: s.addToCarts,
      purchases: s.purchases,
      revenue: s.revenue.toNumber(),
      conversionRate: s.conversionRate.toNumber().toFixed(2) + '%',
      aov: s.aov.toNumber().toFixed(2),
    })),
  };
}
```

---

## 4. 实现优先级

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| **Phase 1** | BundleEvent表 + 基础埋点 | P0 |
| **Phase 1** | BundleStats表 + 每日聚合 | P0 |
| **Phase 2** | BundleAnalytics表 + 月报聚合 | P1 |
| **Phase 2** | 报表API + Dashboard展示 | P1 |

---

## 5. Prisma Schema 完整更新

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:dev.sqlite"
}

model Session {
  id            String    @id
  shop          String
  state         String
  isOnline      Boolean   @default(false)
  scope         String?
  expires       DateTime?
  accessToken   String
  userId        BigInt?
  firstName     String?
  lastName      String?
  email         String?
  accountOwner  Boolean   @default(false)
  locale        String?
  collaborator  Boolean?  @default(false)
  emailVerified Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?
}

model Bundle {
  id               String   @id @default(cuid())
  shop             String
  name             String
  bundleType       String   // FIXED | VOLUME | MIX_MATCH
  discountType     String   // percentage | fixed_amount
  discountValue    Decimal
  minQuantity      Int
  applicableProducts String // JSON array
  productQuery     String?
  status           String   @default("active")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([shop])
  @@index([shop, status])
}

model BundleStats {
  id             String   @id @default(cuid())
  shop           String
  bundleId       String
  date           DateTime

  impressions    Int      @default(0)
  clicks         Int      @default(0)
  addToCarts     Int      @default(0)
  purchases      Int      @default(0)
  revenue        Decimal  @default(0)
  orderCount     Int      @default(0)
  totalOrderValue Decimal @default(0)
  conversionRate Decimal @default(0)
  aov            Decimal @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([shop, bundleId, date])
  @@index([shop, date])
  @@index([bundleId])
}

model BundleEvent {
  id           String   @id @default(cuid())
  shop         String
  bundleId     String
  eventType    String
  sessionId    String?
  customerId   String?
  orderId      String?
  productIds   String?
  cartValue    Decimal?
  orderValue   Decimal?
  source       String?
  deviceType   String?
  referrer     String?
  createdAt    DateTime @default(now())

  @@index([shop, bundleId, eventType, createdAt])
  @@index([shop, createdAt])
  @@index([bundleId])
}

model BundleAnalytics {
  id                   String   @id @default(cuid())
  shop                 String
  bundleId             String?
  periodType           String
  periodStart          DateTime
  periodEnd            DateTime
  totalImpressions     Int      @default(0)
  totalClicks         Int      @default(0)
  totalAddToCarts     Int      @default(0)
  totalPurchases      Int      @default(0)
  totalRevenue        Decimal  @default(0)
  avgConversionRate   Decimal  @default(0)
  avgAov              Decimal  @default(0)
  clickThroughRate    Decimal  @default(0)
  conversionRateChange Decimal?
  revenueChange        Decimal?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([shop, bundleId, periodType, periodStart])
  @@index([shop, periodType, periodStart])
}
```

---

## 6. 埋点追踪流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    完整用户旅程追踪                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [产品页展示] ──► bundle_shown ──► Stats.impressions++          │
│         │                                                        │
│         ▼                                                        │
│  [用户点击捆绑] ──► bundle_clicked ──► Stats.clicks++           │
│         │                                                        │
│         ▼                                                        │
│  [加入购物车] ──► bundle_add_to_cart ──► Stats.addToCarts++     │
│         │                                                        │
│         ▼                                                        │
│  [结账完成] ────► bundle_purchase ──► Stats.purchases++        │
│                                              │                   │
│                                              ▼                   │
│                                    Stats.revenue += orderValue  │
│                                    Stats.aov = revenue/purchases│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
