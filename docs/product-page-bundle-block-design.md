# Product Page Bundle Block 设计规格

## 概述
在产品详情页 (PDP) 展示该产品参与的 Bundle 套餐优惠，引导顾客发现并购买套餐。

## 位置
- 产品详情页主区域下方（"Product information"下方）
- 或作为侧边栏 block
- 或作为产品图片下方tabs中的一个tab

## 显示时机
当产品存在于≥1个活跃的bundle中时显示。

## 组件状态

### 1. 无可用套餐 (No Bundle)
当产品不在任何活跃bundle中时：
- 完全隐藏，不占用页面空间

### 2. 单一套餐 (Single Bundle)
当产品只属于一个bundle时：
- 显示bundle名称、优惠、价格
- 显示参与产品列表（带图片）
- "添加套餐到购物车" 按钮

### 3. 多个套餐 (Multiple Bundles)
当产品属于多个bundles时：
- 切换式显示（类似 variant selector）
- 或折叠面板展示所有选项

## API Contract

### Request
```
GET /api/bundles/product/:productId?shopId={shopId}
```

### Response
```json
{
  "success": true,
  "data": {
    "bundles": [
      {
        "id": "bundle123",
        "name": "Summer Bundle",
        "description": "Buy 3 get 20% off",
        "bundleType": "FIXED",
        "discountType": "percentage",
        "discountValue": 20,
        "minQuantity": 3,
        "products": [
          { "productId": "prod1", "variantId": null, "title": "T-Shirt", "image": "..." },
          { "productId": "prod2", "variantId": null, "title": "Shorts", "image": "..." }
        ],
        "originalPriceTotal": 89.97,
        "bundlePrice": 71.98,
        "savingsAmount": 17.99,
        "savingsPercent": 20
      }
    ]
  }
}
```

## UI Layout

### Desktop
```
┌────────────────────────────────────────────────────────────┐
│  🎁 购买套餐更划算                                         │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [img] T-Shirt        [img] Shorts        [img] Hat  │  │
│  │      $29.99               $39.99           $19.99   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  3件套餐 原价 $89.97 → $71.98                              │
│  节省 $17.99 (20% off)                                    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  购买流程：                                         │    │
│  │  1. 选择至少3件商品放入购物车                      │    │
│  │  2. 系统自动应用20%折扣                            │    │
│  │  3. 节省 $17.99                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  [+ 添加套餐到购物车 - $71.98]                             │
│                                                            │
│  < 查看产品详情 >                                          │
└────────────────────────────────────────────────────────────┘
```

### Mobile
- 垂直堆叠布局
- 产品图片横向滚动
- 按钮全宽

## 组件 Props

```typescript
interface ProductPageBundleBlockProps {
  productId: string;
  shopId: string;
  currency: string;
  locale: string;
  onAddBundleToCart: (bundleId: string, productIds: string[]) => void;
  onNavigateToProduct: (productId: string) => void;
}

interface ProductBundle {
  id: string;
  name: string;
  description?: string;
  bundleType: 'FIXED';
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minQuantity: number;
  products: Array<{
    productId: string;
    variantId: string | null;
    title: string;
    price: string;
    image?: string;
  }>;
  originalPriceTotal: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercent: number;
}
```

## 行为

1. **加载状态**：显示 skeleton loader（与页面其他元素一致）
2. **无bundle**：组件完全隐藏
3. **单个bundle**：直接显示优惠信息
4. **多个bundle**：显示切换器，让用户选择
5. **点击"添加到购物车"**：
   - 如果产品足够，直接添加
   - 如果不够，显示弹窗引导用户补足数量
6. **查看产品详情**：点击其他产品图片可跳转到该产品页面

## 技术实现

- 位置：Storefront theme extension 或 App Block
- 框架：React (App Block) 或 Vanilla JS + Liquid
- 样式：使用 storefront 主题的 CSS
- 与购物车系统集成（Shopify Cart API 或 Storefront Cart API）

## 折扣计算逻辑 (前端预览)

```
discountType = 'percentage':
  bundlePrice = originalPriceTotal * (1 - discountValue / 100)

discountType = 'fixed_amount':
  bundlePrice = discountValue
```

## Accessibility

- 使用 semantic HTML
- 图片 alt text 包含产品名称
- 按钮有明确的 aria-label
- 颜色对比度符合 WCAG 2.1 AA