/**
 * CartBundleWidget
 *
 * App Block that displays bundle recommendations in the cart.
 * Shows applicable bundles and upsell opportunities based on cart contents.
 *
 * This component is migrated from app/components/storefront/CartWidget.tsx
 */

import { useState, useEffect, useCallback } from 'react';

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

interface ApiResponse {
  applicableBundles: BundleRecommendation[];
  recommendations: BundleRecommendation[];  // potentialBundles
}

export function CartBundleWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicableBundles, setApplicableBundles] = useState<BundleRecommendation[]>([]);
  const [potentialBundles, setPotentialBundles] = useState<BundleRecommendation[]>([]);

  // Get cart data from Shopify context - for now use placeholder
  const cartProductIds: string[] = []; // TODO: Get from Shopify cart context

  useEffect(() => {
    async function fetchRecommendations() {
      if (cartProductIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('/app/api/bundles/cart/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartProductIds,
            cartQuantity: {}
          }),
        });
        const data: ApiResponse = await response.json();

        if (data.applicableBundles || data.recommendations) {
          setApplicableBundles(data.applicableBundles || []);
          setPotentialBundles(data.recommendations || []);
        } else {
          setError('Failed to load bundle recommendations');
        }
      } catch (err) {
        setError('Unable to load recommendations');
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [cartProductIds.join(',')]);

  const handleApplyBundle = useCallback((bundleId: string) => {
    // TODO: Integrate with Shopify Cart API
    console.log('Apply bundle:', bundleId);
  }, []);

  const handleUpsellNavigate = useCallback((bundleId: string, missingProductIds: string[]) => {
    // TODO: Navigate to product selection
    console.log('Upsell navigate:', bundleId, missingProductIds);
  }, []);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatSavings = (amount: number, percent?: number) => {
    const savings = formatPrice(amount);
    return percent ? `${savings} (${percent}% off)` : savings;
  };

  // Loading state
  if (loading) {
    return (
      <div className="bundle-cart-widget bundle-cart-widget--loading">
        <div className="bundle-cart-widget__header">
          <span className="bundle-icon">🎁</span>
          <span>Bundle Offers</span>
        </div>
        <div className="bundle-cart-widget__skeleton">
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--medium" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bundle-cart-widget bundle-cart-widget--error">
        <div className="bundle-cart-widget__header">
          <span className="bundle-icon">🎁</span>
          <span>Bundle Offers</span>
        </div>
        <p className="bundle-cart-widget__error">{error}</p>
      </div>
    );
  }

  // No bundles available - silent hide
  if (applicableBundles.length === 0 && potentialBundles.length === 0) {
    return null;
  }

  return (
    <div className="bundle-cart-widget">
      <div className="bundle-cart-widget__header">
        <span className="bundle-icon">🎁</span>
        <span>Bundle Offers</span>
      </div>

      {/* Applicable Bundles */}
      {applicableBundles.map((rec) => (
        <div key={rec.bundle.id} className="bundle-cart-widget__applicable">
          <div className="bundle-badge bundle-badge--success">✓</div>
          <div className="bundle-info">
            <div className="bundle-name">"{rec.bundle.name}"</div>
            <div className="bundle-pricing">
              {formatPrice(rec.originalPriceTotal || 0)} → {formatPrice(rec.finalPrice || 0)}
            </div>
            <div className="bundle-savings">
              Save {formatSavings(rec.savingsAmount || 0)}
            </div>
          </div>
          <button
            className="bundle-btn bundle-btn--primary"
            onClick={() => handleApplyBundle(rec.bundle.id)}
          >
            Apply Bundle
          </button>
        </div>
      ))}

      {/* Potential Bundles (Upsell) */}
      {potentialBundles.map((rec) => (
        <div key={rec.bundle.id} className="bundle-cart-widget__potential">
          <div className="bundle-badge bundle-badge--upgrade">🔥</div>
          <div className="bundle-info">
            <div className="bundle-name">
              Add {rec.remainingToUnlock} more for "{rec.bundle.name}"
            </div>
            <div className="bundle-progress">
              <div className="bundle-progress__bar">
                <div
                  className="bundle-progress__fill"
                  style={{ width: `${Math.min((rec.currentQuantity / rec.bundle.minQuantity) * 100, 100)}%` }}
                />
              </div>
              <span className="bundle-progress__text">
                {rec.currentQuantity}/{rec.bundle.minQuantity} items
              </span>
            </div>
            {rec.missingProducts && rec.missingProducts.length > 0 && (
              <div className="bundle-missing">
                Missing: {rec.missingProducts.map(p => p.title).join(', ')}
              </div>
            )}
            <div className="bundle-potential-savings">
              Save {formatPrice(rec.potentialSavings || 0)} more
            </div>
          </div>
          <button
            className="bundle-btn bundle-btn--secondary"
            onClick={() => handleUpsellNavigate(
              rec.bundle.id,
              rec.missingProducts?.map(p => p.productId) || []
            )}
          >
            Add Items
          </button>
        </div>
      ))}
    </div>
  );
}

export default CartBundleWidget;