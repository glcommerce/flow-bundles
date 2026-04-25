import React, { useState, useEffect } from 'react';
import {
  useJsonAnalytics,
  useShop,
  useCurrency,
  useLocalization,
} from '@shopify/checkout-ui-extensions-react';

interface BundleProduct {
  productId: string;
  variantId: string | null;
  title: string;
  price: string;
  image?: string;
}

interface ProductBundle {
  id: string;
  name: string;
  description?: string;
  bundleType: 'FIXED';
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minQuantity: number;
  products: BundleProduct[];
  originalPriceTotal: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercent: number;
}

interface ProductBundleBlockProps {
  productId: string;
  apiBaseUrl?: string;
}

export function ProductBundleBlock({
  productId,
  apiBaseUrl = '/app/api',
}: ProductBundleBlockProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [selectedBundleIndex, setSelectedBundleIndex] = useState(0);

  const shop = useShop();
  const currency = useCurrency();
  const locale = useLocalization();

  useEffect(() => {
    async function fetchProductBundles() {
      if (!shop?.id || !productId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/bundles/product/${productId}`);
        const data = await response.json();

        if (data.bundles && data.bundles.length > 0) {
          setBundles(data.bundles);
        }
      } catch (err) {
        setError('Unable to load bundle offers');
      } finally {
        setLoading(false);
      }
    }

    fetchProductBundles();
  }, [productId, shop?.id, apiBaseUrl]);

  // Hide if no bundles or still loading
  if (loading || bundles.length === 0) {
    return null;
  }

  const selectedBundle = bundles[selectedBundleIndex];
  const hasMultipleBundles = bundles.length > 1;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(locale.isoCode, {
      style: 'currency',
      currency: currency.currencyCode,
    }).format(amount);
  };

  return (
    <block extend={{ padding: '16px', border: '1px solid #e3e3e3', borderRadius: '12px', margin: '16px 0' }}>
      {/* Header */}
      <inline-layout gap="8px" inline-align="center">
        <text variant="headingSm">🎁 Buy Bundle, Save More</text>
      </inline-layout>

      {/* Bundle Selector (if multiple bundles) */}
      {hasMultipleBundles && (
        <inline-layout gap="8px" padding="12px 0">
          {bundles.map((bundle, index) => (
            <button
              key={bundle.id}
              onPress={() => setSelectedBundleIndex(index)}
              appearance={index === selectedBundleIndex ? 'primary' : 'secondary'}
            >
              {bundle.name}
            </button>
          ))}
        </inline-layout>
      )}

      {/* Bundle Products Preview */}
      <grid columns="repeat(auto-fill, minmax(80px, 1fr))" gap="8px" padding="12px 0">
        {selectedBundle.products.map((product) => (
          <view key={product.productId} border="1px solid #e5e7eb" border-radius="8px" padding="8px">
            <image
              source={product.image || 'https://cdn.shopify.com/s/files/placeholder.png'}
              alt={product.title}
              aspectRatio={1}
            />
            <text size="xs" font-weight="medium">{product.title}</text>
            <text size="xs" appearance="subdued">{product.price}</text>
          </view>
        ))}
      </grid>

      {/* Bundle Pricing */}
      <view padding="12px" background="subtle" border-radius="8px">
        <inline-layout gap="8px" inline-align="center">
          <text appearance="subdued" text-decoration="line-through">
            {formatPrice(selectedBundle.originalPriceTotal)}
          </text>
          <text>→</text>
          <text font-weight="bold" size="lg">
            {formatPrice(selectedBundle.bundlePrice)}
          </text>
        </inline-layout>
        <text appearance="success" font-weight="semibold" alignment="center">
          Save {formatPrice(selectedBundle.savingsAmount)} ({selectedBundle.savingsPercent}% off)
        </text>
      </view>

      {/* How It Works */}
      <view padding="12px" background="surface2" border-radius="8px">
        <text font-weight="semibold" size="sm">How it works:</text>
        <list>
          <text size="xs">Add at least {selectedBundle.minQuantity} items to cart</text>
          <text size="xs">Discount is automatically applied at checkout</text>
          <text size="xs">Save {formatPrice(selectedBundle.savingsAmount)}</text>
        </list>
      </view>

      {/* CTA Button */}
      <button type="submit" appearance="primary" full-width>
        Add Bundle to Cart - {formatPrice(selectedBundle.bundlePrice)}
      </button>
    </block>
  );
}

export default ProductBundleBlock;