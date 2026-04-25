// Mock data for Cart Widget and Product Page Bundle Block UI development

export const mockCartRecommendations = {
  success: true,
  data: {
    applicableBundles: [
      {
        bundle: {
          id: "bundle123",
          name: "3件套餐",
          discountType: "percentage",
          discountValue: 20,
          minQuantity: 3,
        },
        matchType: "cart_match",
        currentQuantity: 4,
        eligible: true,
        savingsAmount: 15.99,
        originalPriceTotal: 79.95,
        finalPrice: 63.96,
      },
    ],
    potentialBundles: [
      {
        bundle: {
          id: "bundle456",
          name: "5件更划算",
          discountType: "fixed_amount",
          discountValue: 99.99,
          minQuantity: 5,
        },
        matchType: "upgrade",
        currentQuantity: 4,
        eligible: false,
        missingProducts: [
          { productId: "prod5", title: "产品E", price: "$29.99" },
        ],
        remainingToUnlock: 1,
        potentialSavings: 24.96,
      },
    ],
  },
};

export const mockProductBundles = {
  success: true,
  data: {
    bundles: [
      {
        id: "bundle123",
        name: "Summer Bundle",
        description: "Buy 3 get 20% off",
        bundleType: "FIXED",
        discountType: "percentage",
        discountValue: 20,
        minQuantity: 3,
        products: [
          {
            productId: "prod1",
            variantId: null,
            title: "T-Shirt",
            price: "$29.99",
            image: "https://cdn.shopify.com/s/files/t-shirt.jpg",
          },
          {
            productId: "prod2",
            variantId: null,
            title: "Shorts",
            price: "$39.99",
            image: "https://cdn.shopify.com/s/files/shorts.jpg",
          },
          {
            productId: "prod3",
            variantId: null,
            title: "Hat",
            price: "$19.99",
            image: "https://cdn.shopify.com/s/files/hat.jpg",
          },
        ],
        originalPriceTotal: 89.97,
        bundlePrice: 71.98,
        savingsAmount: 17.99,
        savingsPercent: 20,
      },
    ],
  },
};

export const mockEmptyCart = {
  success: true,
  data: {
    applicableBundles: [],
    potentialBundles: [],
  },
};

export const mockNoProductBundles = {
  success: true,
  data: {
    bundles: [],
  },
};

// TypeScript types for the mock data
export interface MockCartRecommendation {
  bundle: {
    id: string;
    name: string;
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
    minQuantity: number;
  };
  matchType: "cart_match" | "similar_products" | "upgrade";
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

export interface MockProductBundle {
  id: string;
  name: string;
  description?: string;
  bundleType: "FIXED";
  discountType: "percentage" | "fixed_amount";
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