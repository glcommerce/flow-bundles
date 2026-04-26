import type { ActionFunctionArgs } from "react-router";
import { json } from "../utils";
import { authenticate } from "../shopify.server";
import { evaluateCart, getProductPricesFromShopify } from "../bundle.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const body = await request.json();

    const { cartProductIds, cartQuantity } = body;

    if (!cartProductIds || !Array.isArray(cartProductIds)) {
      return json({ error: "cartProductIds is required and must be an array" }, { status: 400 });
    }

    // Extract numeric IDs from GIDs if present
    const numericProductIds = cartProductIds.map((id: string) =>
      id.replace("gid://shopify/Product/", "")
    );

    const normalizedCartQuantity: Record<string, number> = {};
    for (const [key, value] of Object.entries(cartQuantity || {})) {
      const numericKey = key.replace("gid://shopify/Product/", "");
      normalizedCartQuantity[numericKey] = value as number;
    }

    // Fetch real prices from Shopify Admin API
    const priceMap = await getProductPricesFromShopify(admin, numericProductIds);

    // Evaluate cart with real prices
    const result = await evaluateCart(session.shop, numericProductIds, normalizedCartQuantity, priceMap);

    return json(result);
  } catch (error: any) {
    console.error('Cart evaluate API error:', error);
    return json({ error: error.message || "Failed to evaluate cart" }, { status: 500 });
  }
};