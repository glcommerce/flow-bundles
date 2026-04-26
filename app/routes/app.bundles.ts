import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { json } from "../utils";
import { authenticate } from "../shopify.server";
import {
  createBundle,
  getBundlesByShop,
  getBundleById,
  updateBundle,
  deleteBundle,
  pauseBundle,
  activateBundle,
} from "../bundle.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const bundles = await getBundlesByShop(session.shop, status as any);

    return json({ bundles });
  } catch (error: any) {
    console.error('Loader error:', error);
    return json({ error: error.message || 'Failed to fetch bundles' }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    switch (intent) {
      case "create": {
        try {
          const bundle = await createBundle({
            shop: session.shop,
            name: String(formData.get("name")),
            description: formData.get("description") ? String(formData.get("description")) : undefined,
            bundleType: "FIXED" as const,
            discountType: String(formData.get("discountType")) as "percentage" | "fixed_amount",
            discountValue: Number(formData.get("discountValue")),
            minQuantity: Number(formData.get("minQuantity")),
            productIds: JSON.parse(String(formData.get("productIds"))),
            productFilter: formData.get("productFilter")
              ? JSON.parse(String(formData.get("productFilter")))
              : undefined,
          });

          return json({ bundle });
        } catch (error: any) {
          console.error('Create bundle error:', error);
          return json({ error: error.message || 'Failed to create bundle' }, { status: 400 });
        }
      }

      case "update": {
        try {
          const id = String(formData.get("id"));
          if (!id) {
            return json({ error: 'Bundle ID is required' }, { status: 400 });
          }
          const bundle = await updateBundle(id, session.shop, {
            name: formData.get("name") ? String(formData.get("name")) : undefined,
            description: formData.get("description") ? String(formData.get("description")) : undefined,
            discountType: formData.get("discountType") as any,
            discountValue: formData.get("discountValue") ? Number(formData.get("discountValue")) : undefined,
            minQuantity: formData.get("minQuantity") ? Number(formData.get("minQuantity")) : undefined,
            productIds: formData.get("productIds") ? JSON.parse(String(formData.get("productIds"))) : undefined,
            productFilter: formData.get("productFilter")
              ? JSON.parse(String(formData.get("productFilter")))
              : undefined,
          });

          if (!bundle) {
            return json({ error: 'Bundle not found' }, { status: 404 });
          }
          return json({ bundle });
        } catch (error: any) {
          console.error('Update bundle error:', error);
          return json({ error: error.message || 'Failed to update bundle' }, { status: 400 });
        }
      }

      case "delete": {
        try {
          const id = String(formData.get("id"));
          if (!id) {
            return json({ error: 'Bundle ID is required' }, { status: 400 });
          }
          const success = await deleteBundle(id, session.shop);
          return json({ success });
        } catch (error: any) {
          console.error('Delete bundle error:', error);
          return json({ error: error.message || 'Failed to delete bundle' }, { status: 400 });
        }
      }

      case "pause": {
        try {
          const id = String(formData.get("id"));
          if (!id) {
            return json({ error: 'Bundle ID is required' }, { status: 400 });
          }
          const success = await pauseBundle(id, session.shop);
          if (!success) {
            return json({ error: 'Bundle not found' }, { status: 404 });
          }
          return json({ success });
        } catch (error: any) {
          console.error('Pause bundle error:', error);
          return json({ error: error.message || 'Failed to pause bundle' }, { status: 400 });
        }
      }

      case "activate": {
        try {
          const id = String(formData.get("id"));
          if (!id) {
            return json({ error: 'Bundle ID is required' }, { status: 400 });
          }
          const success = await activateBundle(id, session.shop);
          if (!success) {
            return json({ error: 'Bundle not found' }, { status: 404 });
          }
          return json({ success });
        } catch (error: any) {
          console.error('Activate bundle error:', error);
          return json({ error: error.message || 'Failed to activate bundle' }, { status: 400 });
        }
      }

      default:
        return json({ error: "Invalid intent" }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Action error:', error);
    return json({ error: error.message || 'Authentication failed' }, { status: 401 });
  }
};
