# Cart Widget 设计规格

## 概述
购物车内的 Bundle 推荐/加购组件，显示顾客当前购物车可以享受的套餐优惠。

## 位置
- 购物车页面 (cart page) - 通常在购物车摘要旁边或下方
- 作为 slide-out drawer 或 inline section 展示

## 组件状态

### 1. 无套餐适用 (No Bundle Applicable)
当购物车中没有可用套餐时：
- 显示："当前购物车暂无套餐优惠"
- 可选：展示推荐套餐（需要添加商品才能满足）

### 2. 有可用套餐 (Bundle Available)
当购物车已满足某套餐条件时：
- 高亮显示 bundle 名称和优惠
- 显示节省金额
- "应用套餐" 按钮

### 3. 凑单推荐 (Upsell Potential)
当购物车接近满足某套餐时：
- 显示进度条（如：已选3/5件）
- 显示还差什么产品
- 显示凑单后能节省的金额
- "去凑单" 按钮

## API Contract

### Request
```
GET /api/bundles/recommendations?shopId={shopId}&cartProductIds={ids}&cartTotal={amount}
```

### Response
```json
{
  "success": true,
  "data": {
    "applicableBundles": [
      {
        "bundle": {
          "id": "bundle123",
          "name": "3件套餐",
          "discountType": "percentage",
          "discountValue": 20,
          "minQuantity": 3
        },
        "matchType": "cart_match",
        "currentQuantity": 4,
        "eligible": true,
        "savingsAmount": 15.99,
        "originalPriceTotal": 79.95,
        "finalPrice": 63.96
      }
    ],
    "potentialBundles": [
      {
        "bundle": {
          "id": "bundle456",
          "name": "5件更划算",
          "discountType": "fixed_amount",
          "discountValue": 99.99,
          "minQuantity": 5
        },
        "matchType": "upgrade",
        "currentQuantity": 4,
        "eligible": false,
        "missingProducts": [
          { "productId": "prod5", "title": "产品E", "price": "$29.99" }
        ],
        "remainingToUnlock": 1,
        "potentialSavings": 24.96
      }
    ]
  }
}
```

## UI Layout

```
┌─────────────────────────────────────────────┐
│  🎁 套餐优惠                                 │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐│
│  │ ✅ 您已满足 "3件套餐" 条件              ││
│  │                                         ││
│  │ 原价 $79.95 → $63.96                    ││
│  │ 节省 $15.99 (20% off)                   ││
│  │                                         ││
│  │ [应用套餐]                               ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ 🔥 再加1件即可解锁 "5件更划算"           ││
│  │                                         ││
│  │ ████████░░░░░░░░░░░░ 4/5 件             ││
│  │                                         ││
│  │ 缺少: 产品E ($29.99)                     ││
│  │ 凑单后节省: $24.96                       ││
│  │                                         ││
│  │ [去凑单]                                ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## 组件 Props

```typescript
interface CartWidgetProps {
  shopId: string;
  cartProductIds: string[];
  cartTotal: number;
  currency: string;
  locale: string;
  onApplyBundle: (bundleId: string) => void;
  onNavigateTo凑单: (bundleId: string, missingProductIds: string[]) => void;
}

interface BundleRecommendation {
  bundle: {
    id: string;
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    minQuantity: number;
  };
  matchType: 'cart_match' | 'similar_products' | 'upgrade';
  currentQuantity: number;
  eligible: boolean;
  savingsAmount?: number;
  originalPriceTotal?: number;
  finalPrice?: number;
  missingProducts?: Array<{
    productId: string;
    title: string;
    price: string;
  }>;
  remainingToUnlock?: number;
  potentialSavings?: number;
}
```

## 行为

1. **加载状态**：显示 skeleton loader
2. **错误状态**：显示友好错误消息，不阻塞购物车使用
3. **成功状态**：根据API响应显示适用的和潜在的套餐
4. **点击"应用套餐"**：调用 `/api/bundles/validate` 确认后，更新购物车
5. **点击"去凑单"**：导航到缺少产品的页面或打开产品选择器

## 技术实现

- 位置：Storefront theme extension 或 App Block
- 框架：React (App Block) 或 Vanilla JS + Liquid
- 样式：使用 storefront 主题的 CSS 或独立 CSS
- 响应式：在移动端可折叠为底部抽屉