import React, { useState, useEffect } from 'react';
import { useCartCheckoutScope } from '@shopify/checkout-ui-extensions-react';

interface BundleProduct {
  productId: string;
  variantId: string | null;
  title: string;
  price: string;
  image?: string;
}

interface BundleRecommendation {
  bundle: {
    id: string;
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    minQuantity: number;
  };
  matchType: 'cart_match' | 'similar_products' | 'upgrade';
  currentQuantity: number;
  eligible: boolean;
  savingsAmount?: number;
  originalPriceTotal?: number;
  finalPrice?: number;
  missingProducts?: Array<{
    productId: string;
    title: string;
    price: string;
  }>;
  remainingToUnlock?: number;
  potentialSavings?: number;
}

interface CartWidgetProps {
  apiBaseUrl?: string;
}

export function CartBundleWidget({
  apiBaseUrl = '/app/api',
}: CartWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicableBundles, setApplicableBundles] = useState<BundleRecommendation[]>([]);
  const [potentialBundles, setPotentialBundles] = useState<BundleRecommendation[]>([]);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setLoading(true);

        // Fetch cart contents from Shopify
        const cartResponse = await fetch(`${apiBaseUrl}/bundles/cart/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartProductIds: [], // Will be populated by actual cart line items
            cartQuantity: {},
          }),
        });

        const data = await cartResponse.json();

        if (data.applicableBundles || data.recommendations) {
          setApplicableBundles(data.applicableBundles || []);
          setPotentialBundles(data.recommendations || []);
        }
      } catch (err) {
        setError('Unable to load bundle recommendations');
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [apiBaseUrl]);

  const formatPrice = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Hide when loading, error, or no bundles
  if (loading || error || (applicableBundles.length === 0 && potentialBundles.length === 0)) {
    return null;
  }

  return (
    <view
      background="subtle"
      padding="16px"
      border-radius="12px"
      border="1px solid #e3e3e3"
    >
      {/* Header */}
      <inline-layout gap="8px" inline-align="center" padding="0 0 12px 0">
        <text variant="headingSm">🎁 Bundle Offers</text>
      </inline-layout>

      {/* Applicable Bundles */}
      {applicableBundles.map((rec) => (
        <view
          key={rec.bundle.id}
          padding="12px"
          background="surface"
          border-radius="8px"
          margin="0 0 8px 0"
        >
          <inline-layout gap="8px" inline-align="center">
            <text appearance="success" font-weight="semibold">✓</text>
            <text font-weight="semibold">{rec.bundle.name}</text>
          </inline-layout>

          <text appearance="subdued" size="sm">
            {formatPrice(rec.originalPriceTotal || 0)} → {formatPrice(rec.finalPrice || 0)}
          </text>

          <text appearance="success" size="sm" font-weight="medium">
            Save {formatPrice(rec.savingsAmount || 0)}
          </text>

          <button
            type="submit"
            appearance="primary"
            width="100%"
            padding="8px 16px"
            margin="8px 0 0 0"
          >
            Apply Bundle
          </button>
        </view>
      ))}

      {/* Potential Bundles (Upsell) */}
      {potentialBundles.map((rec) => (
        <view
          key={rec.bundle.id}
          padding="12px"
          background="surface2"
          border-radius="8px"
          margin="0 0 8px 0"
          border="1px dashed #ccc"
        >
          <inline-layout gap="8px" inline-align="center">
            <text appearance="warning" font-weight="semibold">🔥</text>
            <text size="sm" font-weight="medium">
              Add {rec.remainingToUnlock} more for "{rec.bundle.name}"
            </text>
          </inline-layout>

          {/* Progress Bar */}
          <view padding="8px 0">
            <view
              background="subtle"
              height="8px"
              border-radius="4px"
              overflow="hidden"
            >
              <view
                background="success"
                height="100%"
                width={`${Math.min((rec.currentQuantity / rec.bundle.minQuantity) * 100, 100)}%`}
              />
            </view>
            <text size="xs" appearance="subdued" alignment="center" padding="4px 0 0 0">
              {rec.currentQuantity}/{rec.bundle.minQuantity} items
            </text>
          </view>

          {rec.missingProducts && rec.missingProducts.length > 0 && (
            <text size="xs" appearance="subdued">
              Missing: {rec.missingProducts.map(p => p.title).join(', ')}
            </text>
          )}

          <text appearance="success" size="sm" font-weight="medium">
            Save {formatPrice(rec.potentialSavings || 0)} more
          </text>

          <button
            type="submit"
            appearance="secondary"
            width="100%"
            padding="8px 16px"
            margin="8px 0 0 0"
          >
            Add Items
          </button>
        </view>
      ))}
    </view>
  );
}

export default CartBundleWidget;