/**
 * ProductBundleBlock
 *
 * App Block that displays bundle offers on Product Detail Pages.
 * Shows when a product is part of one or more active bundles.
 *
 * This component is migrated from app/components/storefront/ProductPageBundleBlock.tsx
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

interface ApiResponse {
  bundles: ProductBundle[];
}

export function ProductBundleBlock() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [selectedBundleIndex, setSelectedBundleIndex] = useState(0);

  // Get product ID from URL params or context
  const productId = 'CURRENT_PRODUCT_ID'; // TODO: Get from Shopify context

  useEffect(() => {
    async function fetchProductBundles() {
      if (!productId) {
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
  }, [productId]);

  // Hide if no bundles or still loading
  if (loading || bundles.length === 0) {
    return null;
  }

  const selectedBundle = bundles[selectedBundleIndex];
  const hasMultipleBundles = bundles.length > 1;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleAddToCart = () => {
    if (selectedBundle) {
      const productIds = selectedBundle.products.map(p => p.productId);
      // TODO: Integrate with Shopify Cart API
      console.log('Add bundle to cart:', selectedBundle.id, productIds);
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
            onClick={() => console.log('Navigate to product:', product.productId)}
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

export default ProductBundleBlock;