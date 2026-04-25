import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { buildMetafieldValue, type BundleWithParsedFields } from "./bundle.server";

const METAFIELD_NAMESPACE = "flowcart_bundles";

export async function syncBundleToMetafield(
  admin: AdminApiContext,
  bundle: BundleWithParsedFields,
  shop: string
) {
  const metafieldValue = buildMetafieldValue(bundle);
  const metafieldKey = `bundle_${bundle.id}`;

  const response = await admin.graphql(
    `#graphql
      mutation metafieldUpsert($metafield: MetafieldInput!) {
        metafieldUpsert(metafield: $metafield) {
          metafield {
            id
            key
            namespace
            value
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafield: {
          namespace: METAFIELD_NAMESPACE,
          key: metafieldKey,
          type: "json",
          value: JSON.stringify(metafieldValue),
          ownerId: `gid://shopify/Shop/${shop}`,
        },
      },
    }
  );

  const result = await response.json();

  if (result.data?.metafieldUpsert?.userErrors?.length > 0) {
    throw new Error(
      `Metafield sync failed: ${result.data.metafieldUpsert.userErrors.map((e: any) => e.message).join(", ")}`
    );
  }

  return result.data?.metafieldUpsert?.metafield;
}

export async function deleteBundleMetafield(admin: AdminApiContext, bundleId: string, shop: string) {
  const metafieldKey = `bundle_${bundleId}`;

  const response = await admin.graphql(
    `#graphql
      mutation metafieldDelete($input: MetafieldDeleteInput!) {
        metafieldDelete(input: $input) {
          deletedMetafieldId
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: {
          key: metafieldKey,
          namespace: METAFIELD_NAMESPACE,
          ownerId: `gid://shopify/Shop/${shop}`,
        },
      },
    }
  );

  const result = await response.json();

  if (result.data?.metafieldDelete?.userErrors?.length > 0) {
    throw new Error(
      `Metafield delete failed: ${result.data.metafieldDelete.userErrors.map((e: any) => e.message).join(", ")}`
    );
  }

  return true;
}

export async function getBundleMetafields(admin: AdminApiContext, shop: string) {
  const response = await admin.graphql(
    `#graphql
      query getMetafields($ownerId: ID!) {
        metafields(
          first: 100
          ownerId: $ownerId
          namespace: $namespace
        ) {
          edges {
            node {
              id
              key
              namespace
              value
              type
            }
          }
        }
      }
    `,
    {
      variables: {
        ownerId: `gid://shopify/Shop/${shop}`,
        namespace: METAFIELD_NAMESPACE,
      },
    }
  );

  const result = await response.json();
  return result.data?.metafields?.edges?.map((edge: any) => edge.node) || [];
}
