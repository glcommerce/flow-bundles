import type { ActionFunctionArgs } from "react-router";
import { json } from "../utils";
import { authenticate } from "../shopify.server";
import { validateBundleForCart, getProductPricesFromShopify } from "../bundle.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const body = await request.json();

    const { bundleId, cartItems } = body;

    if (!bundleId) {
      return json({ error: "bundleId is required" }, { status: 400 });
    }

    if (!cartItems || !Array.isArray(cartItems)) {
      return json({ error: "cartItems is required and must be an array" }, { status: 400 });
    }

    // Normalize cart items (extract numeric IDs from GIDs)
    const normalizedCartItems = cartItems.map((item: any) => ({
      productId: item.productId.replace("gid://shopify/Product/", ""),
      quantity: item.quantity,
    }));

    // Fetch real prices from Shopify Admin API
    const productIds = normalizedCartItems.map(item => item.productId);
    const priceMap = await getProductPricesFromShopify(admin, productIds);

    const result = await validateBundleForCart(bundleId, session.shop, normalizedCartItems, priceMap);

    return json(result);
  } catch (error: any) {
    console.error('Bundle validate API error:', error);
    return json({ error: error.message || "Failed to validate bundle" }, { status: 500 });
  }
};