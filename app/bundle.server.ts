import prisma from "./db.server";
import type { Bundle, BundleType, DiscountType, BundleStatus } from "@prisma/client";

export interface CreateBundleInput {
  shop: string;
  name: string;
  description?: string;
  bundleType: BundleType;
  discountType: DiscountType;
  discountValue: number;
  minQuantity: number;
  productIds: string[];
  productFilter?: Record<string, any>;
}

export interface UpdateBundleInput {
  name?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  minQuantity?: number;
  productIds?: string[];
  productFilter?: Record<string, any>;
  status?: BundleStatus;
}

export interface BundleWithParsedFields extends Bundle {
  productIdsList: string[];
  productFilterObj?: Record<string, any>;
}

function parseBundleFields(bundle: Bundle): BundleWithParsedFields {
  return {
    ...bundle,
    productIdsList: JSON.parse(bundle.productIds),
    productFilterObj: bundle.productFilter ? JSON.parse(bundle.productFilter) : undefined,
  };
}

export async function createBundle(input: CreateBundleInput) {
  // Input validation
  if (!input.name || input.name.trim() === '') {
    throw new Error('Bundle name is required');
  }
  if (input.name.length > 255) {
    throw new Error('Bundle name must be 255 characters or less');
  }
  if (input.description && input.description.length > 1000) {
    throw new Error('Description must be 1000 characters or less');
  }
  if (!input.productIds || input.productIds.length === 0) {
    throw new Error('At least one product is required');
  }
  if (input.minQuantity <= 0) {
    throw new Error('Minimum quantity must be greater than 0');
  }
  if (input.discountValue <= 0) {
    throw new Error('Discount value must be greater than 0');
  }
  if (input.discountType === 'percentage' && input.discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%');
  }

  const bundle = await prisma.bundle.create({
    data: {
      shop: input.shop,
      name: input.name,
      description: input.description,
      bundleType: input.bundleType,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minQuantity: input.minQuantity,
      productIds: JSON.stringify(input.productIds),
      productFilter: input.productFilter ? JSON.stringify(input.productFilter) : null,
    },
  });

  return parseBundleFields(bundle);
}

export async function getBundleById(id: string, shop: string) {
  const bundle = await prisma.bundle.findFirst({
    where: { id, shop },
  });

  if (!bundle) return null;
  return parseBundleFields(bundle);
}

export async function getBundlesByShop(shop: string, status?: BundleStatus) {
  const bundles = await prisma.bundle.findMany({
    where: { shop, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return bundles.map(parseBundleFields);
}

export async function updateBundle(id: string, shop: string, input: UpdateBundleInput) {
  // Input validation
  if (input.name !== undefined && input.name.trim() === '') {
    throw new Error('Bundle name cannot be empty');
  }
  if (input.name !== undefined && input.name.length > 255) {
    throw new Error('Bundle name must be 255 characters or less');
  }
  if (input.description !== undefined && input.description.length > 1000) {
    throw new Error('Description must be 1000 characters or less');
  }
  if (input.productIds !== undefined && input.productIds.length === 0) {
    throw new Error('At least one product is required');
  }
  if (input.minQuantity !== undefined && input.minQuantity <= 0) {
    throw new Error('Minimum quantity must be greater than 0');
  }
  if (input.discountValue !== undefined && input.discountValue <= 0) {
    throw new Error('Discount value must be greater than 0');
  }
  if (input.discountType === 'percentage' && input.discountValue !== undefined && input.discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%');
  }

  const updateData: any = { ...input };

  if (input.productIds) {
    updateData.productIds = JSON.stringify(input.productIds);
  }
  if (input.productFilter) {
    updateData.productFilter = JSON.stringify(input.productFilter);
  }

  const bundle = await prisma.bundle.updateMany({
    where: { id, shop },
    data: updateData,
  });

  if (bundle.count === 0) return null;

  return getBundleById(id, shop);
}

export async function deleteBundle(id: string, shop: string) {
  const bundle = await prisma.bundle.updateMany({
    where: { id, shop },
    data: { status: "deleted" },
  });

  return bundle.count > 0;
}

export async function pauseBundle(id: string, shop: string) {
  const bundle = await prisma.bundle.updateMany({
    where: { id, shop },
    data: { status: "paused" },
  });

  return bundle.count > 0;
}

export async function activateBundle(id: string, shop: string) {
  const bundle = await prisma.bundle.updateMany({
    where: { id, shop },
    data: { status: "active" },
  });

  return bundle.count > 0;
}

export function buildMetafieldValue(bundle: BundleWithParsedFields) {
  return {
    bundleType: bundle.bundleType,
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    minQuantity: bundle.minQuantity,
    productIds: bundle.productIdsList,
  };
}

// Phase 2: Product Page Block & Cart Widget APIs

export interface BundleProductInfo {
  id: string;
  title: string;
  price: string;
  image?: string;
}

export interface BundleWithProducts extends BundleWithParsedFields {
  products: BundleProductInfo[];
  savings: string;
  savingsPercent: number;
  originalPriceTotal: number;
  bundlePrice: number;
  savingsAmount: number;
}

export interface CartEvaluationResult {
  id: string;
  name: string;
  discountValue: number;
  minQuantity: number;
  currentQuantity: number;
  isQualified: boolean;
  missingProducts: string[];
  addToCartUrl?: string;
  potentialSavings?: number; // Additional savings if upgrade to this bundle
  amountToQualify?: number; // Dollar amount needed to add to cart to qualify
  remainingToUnlock?: number; // Quantity of items needed to unlock
}

export interface CartEvaluationResponse {
  applicableBundles: CartEvaluationResult[];
  potentialBundles: CartEvaluationResult[];
  missingProducts: string[];
}

/**
 * Get product prices from Shopify Admin API
 * Returns map of productId -> { price, title, image }
 */
export async function getProductPricesFromShopify(
  admin: any,
  productIds: string[]
): Promise<Map<string, { price: number; title: string; image?: string }>> {
  if (productIds.length === 0) return new Map();

  const response = await admin.graphql(
    `#graphql
      query getProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            priceRange {
              minVariantPrice {
                amount
              }
            }
            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }
          }
        }
      }
    `,
    { variables: { ids: productIds.map(id => `gid://shopify/Product/${id}`) } }
  );

  const result = await response.json();
  const priceMap = new Map<string, { price: number; title: string; image?: string }>();

  if (result.data?.nodes) {
    for (const node of result.data.nodes) {
      if (node) {
        const numericId = node.id.split("/").pop();
        priceMap.set(numericId, {
          price: parseFloat(node.priceRange?.minVariantPrice?.amount || "0"),
          title: node.title,
          image: node.images?.edges?.[0]?.node?.url,
        });
      }
    }
  }

  return priceMap;
}

/**
 * Get bundles that contain a specific product
 */
export async function getBundlesByProductId(productId: string, shop: string): Promise<BundleWithProducts[]> {
  const bundles = await prisma.bundle.findMany({
    where: {
      shop,
      status: "active",
    },
  });

  const parsedBundles = bundles.map(parseBundleFields);
  const matchingBundles = parsedBundles.filter(bundle =>
    bundle.productIdsList.includes(productId)
  );

  return matchingBundles.map(bundle => {
    // Calculate savings
    const bundleProducts = bundle.productIdsList;
    // For simplicity, assume each product's price is retrieved from metafield or use discountValue to calculate savings
    const originalTotal = bundleProducts.length * 29.99; // Placeholder - should come from Shopify API
    const savingsAmount = originalTotal - bundle.discountValue;
    const savingsPercent = originalTotal > 0 ? Math.round((savingsAmount / originalTotal) * 100) : 0;

    return {
      ...bundle,
      products: bundle.productIdsList.map((pid, idx) => ({
        id: `gid://shopify/Product/${pid}`,
        title: `Product ${pid}`,
        price: `$${29.99 + idx * 10}`,
      })),
      savings: `$${savingsAmount.toFixed(2)}`,
      savingsPercent,
      originalPriceTotal: originalTotal,
      bundlePrice: bundle.discountValue,
      savingsAmount,
    };
  });
}

/**
 * Evaluate cart against all active bundles
 * If priceMap is provided, uses real prices from Shopify; otherwise uses placeholder prices
 */
export async function evaluateCart(
  shop: string,
  cartProductIds: string[],
  cartQuantity: Record<string, number>,
  priceMap?: Map<string, { price: number; title: string; image?: string }>
): Promise<CartEvaluationResponse> {
  const bundles = await prisma.bundle.findMany({
    where: {
      shop,
      status: "active",
    },
  });

  // Default price if not provided from Shopify
  const getPrice = (productId: string): number => {
    if (priceMap && priceMap.has(productId)) {
      return priceMap.get(productId)!.price;
    }
    return 29.99; // Placeholder
  };

  const parsedBundles = bundles.map(parseBundleFields);
  const applicableBundles: CartEvaluationResult[] = [];
  const potentialBundles: CartEvaluationResult[] = [];
  const allMissingProducts = new Set<string>();

  for (const bundle of parsedBundles) {
    const bundleProductIds = bundle.productIdsList;
    const cartProductIdSet = new Set(cartProductIds);

    // Find matching products in cart
    const matchingProducts = bundleProductIds.filter(pid => cartProductIdSet.has(pid));

    // Calculate current quantity from cart
    let currentQuantity = 0;
    let cartTotal = 0;
    const missingProducts: string[] = [];
    for (const pid of bundleProductIds) {
      const productPrice = getPrice(pid);
      if (cartQuantity[pid]) {
        currentQuantity += cartQuantity[pid];
        cartTotal += productPrice * cartQuantity[pid];
      } else {
        missingProducts.push(pid);
        allMissingProducts.add(pid);
      }
    }

    const isQualified = currentQuantity >= bundle.minQuantity;
    const baseUrl = "/cart/add";

    // Calculate potential savings using real prices
    const potentialSavings = bundle.discountType === "percentage"
      ? cartTotal * (bundle.discountValue / 100)
      : bundle.discountValue;

    // Calculate amount needed to qualify using real prices
    let amountToQualify = 0;
    for (const pid of missingProducts) {
      amountToQualify += getPrice(pid);
    }

    const result: CartEvaluationResult = {
      id: bundle.id,
      name: bundle.name,
      discountValue: bundle.discountValue,
      minQuantity: bundle.minQuantity,
      currentQuantity,
      isQualified,
      missingProducts,
      addToCartUrl: isQualified ? undefined : `${baseUrl}?bundle=${bundle.id}`,
      potentialSavings: isQualified ? potentialSavings : undefined,
      amountToQualify: isQualified ? undefined : amountToQualify,
      remainingToUnlock: isQualified ? undefined : bundle.minQuantity - currentQuantity,
    };

    if (isQualified) {
      applicableBundles.push(result);
    } else {
      // Potential bundles are ones that are close to qualification (50%+ progress)
      if (currentQuantity >= bundle.minQuantity * 0.5) {
        potentialBundles.push(result);
      }
    }
  }

  // Sort potential bundles by how close they are to qualification
  potentialBundles.sort((a, b) => {
    const aProgress = a.currentQuantity / a.minQuantity;
    const bProgress = b.currentQuantity / b.minQuantity;
    return bProgress - aProgress;
  });

  return {
    applicableBundles,
    potentialBundles,
    missingProducts: Array.from(allMissingProducts)
  };
}

/**
 * Validate if cart qualifies for a specific bundle
 */
export async function validateBundleForCart(
  bundleId: string,
  shop: string,
  cartItems: { productId: string; quantity: number }[],
  priceMap?: Map<string, { price: number; title: string; image?: string }>
): Promise<{ eligible: boolean; discountAmount: number; finalPrice: number; message: string }> {
  const bundle = await prisma.bundle.findFirst({
    where: { id: bundleId, shop },
  });

  if (!bundle) {
    return { eligible: false, discountAmount: 0, finalPrice: 0, message: "Bundle not found" };
  }

  const parsedBundle = parseBundleFields(bundle);
  const bundleProductIds = new Set(parsedBundle.productIdsList);
  const cartProductIds = new Set(cartItems.map(item => item.productId));

  // Default price if not provided from Shopify
  const getPrice = (productId: string): number => {
    if (priceMap && priceMap.has(productId)) {
      return priceMap.get(productId)!.price;
    }
    return 29.99; // Placeholder
  };

  // Check if cart has all required products
  const hasAllProducts = [...bundleProductIds].every(pid => cartProductIds.has(pid));

  if (!hasAllProducts) {
    const missing = [...bundleProductIds].filter(pid => !cartProductIds.has(pid));
    return {
      eligible: false,
      discountAmount: 0,
      finalPrice: 0,
      message: `Missing products: ${missing.join(", ")}`,
    };
  }

  // Calculate total quantity and value of bundle products in cart
  let currentQuantity = 0;
  let cartValue = 0;
  for (const item of cartItems) {
    if (bundleProductIds.has(item.productId)) {
      currentQuantity += item.quantity;
      cartValue += item.quantity * getPrice(item.productId);
    }
  }

  if (currentQuantity < parsedBundle.minQuantity) {
    return {
      eligible: false,
      discountAmount: 0,
      finalPrice: 0,
      message: `Add ${parsedBundle.minQuantity - currentQuantity} more item(s) to unlock this bundle!`,
    };
  }

  // Calculate discount using real prices
  let discountAmount = 0;
  if (parsedBundle.discountType === "percentage") {
    discountAmount = cartValue * (parsedBundle.discountValue / 100);
  } else {
    discountAmount = parsedBundle.discountValue;
  }

  const finalPrice = Math.max(0, cartValue - discountAmount);

  return {
    eligible: true,
    discountAmount,
    finalPrice,
    message: `Bundle applied! You save $${discountAmount.toFixed(2)}`,
  };
}
