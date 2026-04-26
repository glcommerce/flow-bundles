import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { json } from "../utils";
import { authenticate } from "../shopify.server";
import { BundleBuilder } from "../components/BundleBuilder";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`
    query {
      products(first: 50) {
        edges {
          node {
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
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const products = data.data.products.edges.map((edge: any) => ({
    id: edge.node.id,
    title: edge.node.title,
    price: `$${parseFloat(edge.node.priceRange.minVariantPrice.amount).toFixed(2)}`,
    image: edge.node.images.edges[0]?.node.url,
    variants: edge.node.variants.edges.map((v: any) => ({
      id: v.node.id,
      title: v.node.title,
      price: `$${parseFloat(v.node.price.amount).toFixed(2)}`,
    })),
  }));

  return json({ products });
};

export default function BundleNew() {
  const { products } = useLoaderData<typeof loader>();

  return <BundleBuilder products={products} />;
}
