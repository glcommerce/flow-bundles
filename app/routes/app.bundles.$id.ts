import type { LoaderFunctionArgs } from "react-router";
import { json } from "react-router";
import { authenticate } from "../shopify.server";
import { getBundleById } from "../bundle.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const id = params.id;

    if (!id) {
      return json({ error: 'Bundle ID is required' }, { status: 400 });
    }

    const bundle = await getBundleById(id, session.shop);

    if (!bundle) {
      return json({ error: 'Bundle not found' }, { status: 404 });
    }

    return json({ bundle });
  } catch (error: any) {
    console.error('Loader error:', error);
    return json({ error: error.message || 'Failed to fetch bundle' }, { status: 500 });
  }
};
