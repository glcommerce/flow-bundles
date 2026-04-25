import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { trackBundlePurchase } from "../analytics.server";

const METAFIELD_NAMESPACE = "flowcart_bundles";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] Received ${topic} webhook for ${shop}`);

  try {
    const orderId = payload.id?.toString();
    const totalPrice = parseFloat(payload.total_price || "0");
    const lineItems = payload.line_items || [];

    if (!orderId || lineItems.length === 0) {
      console.log("[Webhook] Invalid order data, skipping");
      return new Response(null, { status: 200 });
    }

    // Extract product IDs from line items (normalize to numeric IDs)
    const orderProductIds = lineItems.map((item: any) => {
      const pid = item.product_id?.toString() || "";
      return pid.includes("/") ? pid.split("/").pop() || pid : pid;
    }).filter(Boolean);

    // Also extract variant IDs for more precise matching
    const orderVariantIds = lineItems.map((item: any) => {
      const vid = item.variant_id?.toString() || "";
      return vid.includes("/") ? vid.split("/").pop() || vid : vid;
    }).filter(Boolean);

    // Find active bundles for this shop
    const bundles = await prisma.bundle.findMany({
      where: { shop, status: "active" },
    });

    // Build a map of metafield keys to bundle for quick lookup
    // Metafield key format: "bundle_{bundleId}"
    const metafieldBundleMap = new Map<string, typeof bundles[0]>();
    for (const bundle of bundles) {
      metafieldBundleMap.set(`bundle_${bundle.id}`, bundle);
    }

    // Method 1: Match by metafield bundle key in line items
    // Shopify Functions stores bundle data in line item properties or metafields
    for (const item of lineItems) {
      // Check properties for bundle info (set by Shopify Functions)
      const properties = item.properties || [];
      for (const prop of properties) {
        if (prop.name === "_bundle_id") {
          const bundleId = prop.value;
          const matchingBundle = bundles.find(b => b.id === bundleId);
          if (matchingBundle) {
            await trackBundlePurchase(
              shop,
              bundleId,
              orderId,
              parseFloat(item.price) * item.quantity,
              [item.product_id?.toString().split("/").pop() || ""]
            );
            console.log(`[Webhook] Tracked bundle purchase via property: bundle=${bundleId}`);
          }
        }
      }
    }

    // Method 2: Match by product IDs (fallback for manual bundle detection)
    const processedBundleIds = new Set<string>();

    for (const bundle of bundles) {
      // Skip if already processed via metafield
      if (processedBundleIds.has(bundle.id)) continue;

      const bundleProductIds: string[] = JSON.parse(bundle.productIds || "[]");
      const normalizedBundleIds = bundleProductIds.map(pid =>
        pid.includes("/") ? pid.split("/").pop() || pid : pid
      );

      // Find matching products in order
      const matchingProductIds = orderProductIds.filter(pid =>
        normalizedBundleIds.includes(pid)
      );

      // Bundle applies if order has >= minQuantity of matching products
      if (matchingProductIds.length >= bundle.minQuantity) {
        await trackBundlePurchase(
          shop,
          bundle.id,
          orderId,
          totalPrice * (matchingProductIds.length / orderProductIds.length), // Proportional value
          matchingProductIds
        );
        processedBundleIds.add(bundle.id);
        console.log(`[Webhook] Tracked bundle purchase via product match: bundle=${bundle.id}`);
      }
    }

  } catch (error) {
    console.error("[Webhook] Error processing order webhook:", error);
  }

  return new Response(null, { status: 200 });
};