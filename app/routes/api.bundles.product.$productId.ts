import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { getBundlesByProductId, getProductPricesFromShopify } from "../bundle.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const { productId } = params;

    if (!productId) {
      return json({ error: "Product ID is required" }, { status: 400 });
    }

    // Extract numeric ID from GID if present
    const numericProductId = productId.replace("gid://shopify/Product/", "");

    // Get bundles for this product
    const bundles = await getBundlesByProductId(numericProductId, session.shop);

    // Collect all product IDs from all matching bundles
    const allProductIds = new Set<string>();
    for (const bundle of bundles) {
      for (const pid of bundle.productIdsList) {
        allProductIds.add(pid);
      }
    }

    // Fetch real prices from Shopify Admin API
    const priceMap = await getProductPricesFromShopify(admin, Array.from(allProductIds));

    // Update bundle products with real prices
    const bundlesWithRealPrices = bundles.map(bundle => ({
      ...bundle,
      products: bundle.products.map(p => {
        const numericId = p.id.replace("gid://shopify/Product/", "");
        const productInfo = priceMap.get(numericId);
        return {
          ...p,
          title: productInfo?.title || p.title,
          price: productInfo ? `$${productInfo.price.toFixed(2)}` : p.price,
          image: productInfo?.image || p.image,
        };
      }),
    }));

    return json({ bundles: bundlesWithRealPrices });
  } catch (error: any) {
    console.error('Product bundles API error:', error);
    return json({ error: error.message || "Failed to fetch bundles" }, { status: 500 });
  }
};