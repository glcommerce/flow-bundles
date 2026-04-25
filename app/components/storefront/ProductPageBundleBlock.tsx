/**
 * ProductPageBundleBlock
 *
 * Storefront block that displays bundle offers on Product Detail Pages.
 * Shows when a product is part of one or more active bundles.
 */

import { useState, useEffect } from 'react';

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

interface ProductPageBlockProps {
  productId: string;
  shopId: string;
  currency?: string;
  locale?: string;
  apiBaseUrl?: string;
  onAddBundleToCart?: (bundleId: string, productIds: string[]) => void;
  onNavigateToProduct?: (productId: string) => void;
}

interface ApiResponse {
  bundles: ProductBundle[];
}

export function ProductPageBundleBlock({
  productId,
  shopId,
  currency = 'USD',
  locale = 'en',
  apiBaseUrl = '/api',
  onAddBundleToCart,
  onNavigateToProduct,
}: ProductPageBlockProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [selectedBundleIndex, setSelectedBundleIndex] = useState(0);

  useEffect(() => {
    async function fetchProductBundles() {
      if (!shopId || !productId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/app/api/bundles/product/${productId}`);
        const data: ApiResponse = await response.json();

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
  }, [productId, shopId, apiBaseUrl]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Hide if no bundles or still loading
  if (loading || bundles.length === 0) {
    return null;
  }

  const selectedBundle = bundles[selectedBundleIndex];
  const isSingleBundle = bundles.length === 1;
  const hasMultipleBundles = bundles.length > 1;

  const calculateBundlePrice = (bundle: ProductBundle) => {
    if (bundle.discountType === 'percentage') {
      return bundle.originalPriceTotal * (1 - bundle.discountValue / 100);
    }
    return bundle.discountValue;
  };

  const handleAddToCart = () => {
    if (selectedBundle) {
      const productIds = selectedBundle.products.map(p => p.productId);
      onAddBundleToCart?.(selectedBundle.id, productIds);
    }
  };

  return (
    <div className="product-bundle-block">
      <div className="product-bundle-block__header">
        <span className="bundle-icon">🎁</span>
        <span>Buy Bundle, Save More</span>
      </div>

      {/* Bundle Selector (if multiple bundles) */}
      {hasMultipleBundles && (
        <div className="product-bundle-block__selector">
          {bundles.map((bundle, index) => (
            <button
              key={bundle.id}
              className={`bundle-selector-btn ${index === selectedBundleIndex ? 'active' : ''}`}
              onClick={() => setSelectedBundleIndex(index)}
            >
              {bundle.name}
            </button>
          ))}
        </div>
      )}

      {/* Bundle Products Preview */}
      <div className="product-bundle-block__products">
        {selectedBundle.products.map((product) => (
          <div
            key={product.productId}
            className="bundle-product-card"
            onClick={() => onNavigateToProduct?.(product.productId)}
          >
            <div className="bundle-product-card__image">
              {product.image ? (
                <img src={product.image} alt={product.title} />
              ) : (
                <div className="bundle-product-card__placeholder">📦</div>
              )}
            </div>
            <div className="bundle-product-card__title">{product.title}</div>
            <div className="bundle-product-card__price">{product.price}</div>
          </div>
        ))}
      </div>

      {/* Bundle Pricing */}
      <div className="product-bundle-block__pricing">
        <div className="pricing-row">
          <span className="pricing-original">
            Original: {formatPrice(selectedBundle.originalPriceTotal)}
          </span>
          <span className="pricing-arrow">→</span>
          <span className="pricing-bundle">
            Bundle: {formatPrice(selectedBundle.bundlePrice)}
          </span>
        </div>
        <div className="pricing-savings">
          Save {formatPrice(selectedBundle.savingsAmount)} ({selectedBundle.savingsPercent}% off)
        </div>
      </div>

      {/* Bundle How It Works */}
      <div className="product-bundle-block__how-it-works">
        <h4>How it works:</h4>
        <ol>
          <li>Add at least {selectedBundle.minQuantity} items to cart</li>
          <li>Discount is automatically applied at checkout</li>
          <li>Save {formatPrice(selectedBundle.savingsAmount)}</li>
        </ol>
      </div>

      {/* CTA Button */}
      <button className="bundle-btn bundle-btn--primary bundle-btn--full" onClick={handleAddToCart}>
        Add Bundle to Cart - {formatPrice(selectedBundle.bundlePrice)}
      </button>

      {hasMultipleBundles && (
        <button className="bundle-btn bundle-btn--link">
          View Bundle Details
        </button>
      )}
    </div>
  );
}

export default ProductPageBundleBlock;