import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBundle,
  getBundleById,
  getBundlesByShop,
  updateBundle,
  deleteBundle,
  pauseBundle,
  activateBundle,
  buildMetafieldValue,
  parseBundleFields,
  type BundleWithParsedFields,
} from '../../app/bundle.server';
import prisma from '../../app/db.server';
import type { Bundle, BundleType, DiscountType, BundleStatus } from '@prisma/client';

// Mock data factory
function createMockBundle(overrides: Partial<Bundle> = {}): Bundle {
  return {
    id: 'bundle-123',
    shop: 'test-shop.myshopify.com',
    name: 'Test Bundle',
    description: 'Test description',
    bundleType: 'FIXED' as BundleType,
    discountType: 'fixed_amount' as DiscountType,
    discountValue: 99.00,
    minQuantity: 3,
    productIds: JSON.stringify(['product-1', 'product-2', 'product-3']),
    productFilter: null,
    status: 'active' as BundleStatus,
    metafieldNamespace: 'flowcart_bundles',
    metafieldKey: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('Bundle Server Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseBundleFields', () => {
    it('should parse productIds from JSON string to array', () => {
      const bundle = createMockBundle();
      const result = parseBundleFields(bundle);

      expect(result.productIdsList).toEqual(['product-1', 'product-2', 'product-3']);
    });

    it('should parse productFilter from JSON string to object', () => {
      const bundle = createMockBundle({
        productFilter: JSON.stringify({ category: 'tops', season: 'summer' }),
      });
      const result = parseBundleFields(bundle);

      expect(result.productFilterObj).toEqual({ category: 'tops', season: 'summer' });
    });

    it('should return undefined for productFilterObj when productFilter is null', () => {
      const bundle = createMockBundle({ productFilter: null });
      const result = parseBundleFields(bundle);

      expect(result.productFilterObj).toBeUndefined();
    });
  });

  describe('buildMetafieldValue', () => {
    it('should build correct metafield value structure', () => {
      const bundle = createMockBundle();
      const parsedBundle: BundleWithParsedFields = {
        ...bundle,
        productIdsList: ['product-1', 'product-2', 'product-3'],
        productFilterObj: undefined,
      };

      const result = buildMetafieldValue(parsedBundle);

      expect(result).toEqual({
        bundleType: 'FIXED',
        discountType: 'fixed_amount',
        discountValue: 99.00,
        minQuantity: 3,
        productIds: ['product-1', 'product-2', 'product-3'],
      });
    });

    it('should handle percentage discount type', () => {
      const bundle = createMockBundle({
        discountType: 'percentage' as DiscountType,
        discountValue: 15.00,
      });
      const parsedBundle: BundleWithParsedFields = {
        ...bundle,
        productIdsList: ['product-1', 'product-2'],
        productFilterObj: undefined,
      };

      const result = buildMetafieldValue(parsedBundle);

      expect(result.discountType).toBe('percentage');
      expect(result.discountValue).toBe(15.00);
    });
  });

  describe('createBundle', () => {
    it('should create a bundle with all required fields', async () => {
      const mockBundle = createMockBundle();
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.create.mockResolvedValue(mockBundle);

      const input = {
        shop: 'test-shop.myshopify.com',
        name: 'Test Bundle',
        description: 'Test description',
        bundleType: 'FIXED' as BundleType,
        discountType: 'fixed_amount' as DiscountType,
        discountValue: 99.00,
        minQuantity: 3,
        productIds: ['product-1', 'product-2', 'product-3'],
      };

      const result = await createBundle(input);

      expect(prismaBundleMock.create).toHaveBeenCalledWith({
        data: {
          shop: 'test-shop.myshopify.com',
          name: 'Test Bundle',
          description: 'Test description',
          bundleType: 'FIXED',
          discountType: 'fixed_amount',
          discountValue: 99.00,
          minQuantity: 3,
          productIds: '["product-1","product-2","product-3"]',
          productFilter: null,
        },
      });

      expect(result.productIdsList).toEqual(['product-1', 'product-2', 'product-3']);
    });

    it('should create a bundle with productFilter', async () => {
      const mockBundle = createMockBundle({
        productFilter: JSON.stringify({ category: 'tops' }),
      });
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.create.mockResolvedValue(mockBundle);

      const input = {
        shop: 'test-shop.myshopify.com',
        name: 'Test Bundle',
        bundleType: 'FIXED' as BundleType,
        discountType: 'percentage' as DiscountType,
        discountValue: 10.00,
        minQuantity: 2,
        productIds: ['product-1'],
        productFilter: { category: 'tops' },
      };

      const result = await createBundle(input);

      expect(prismaBundleMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productFilter: '{"category":"tops"}',
        }),
      });

      expect(result.productFilterObj).toEqual({ category: 'tops' });
    });
  });

  describe('getBundleById', () => {
    it('should return bundle with parsed fields when found', async () => {
      const mockBundle = createMockBundle();
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.findFirst.mockResolvedValue(mockBundle);

      const result = await getBundleById('bundle-123', 'test-shop.myshopify.com');

      expect(result).not.toBeNull();
      expect(result?.productIdsList).toEqual(['product-1', 'product-2', 'product-3']);
    });

    it('should return null when bundle not found', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.findFirst.mockResolvedValue(null);

      const result = await getBundleById('non-existent', 'test-shop.myshopify.com');

      expect(result).toBeNull();
    });
  });

  describe('getBundlesByShop', () => {
    it('should return all bundles for a shop', async () => {
      const mockBundles = [createMockBundle({ id: 'bundle-1' }), createMockBundle({ id: 'bundle-2' })];
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.findMany.mockResolvedValue(mockBundles);

      const result = await getBundlesByShop('test-shop.myshopify.com');

      expect(result).toHaveLength(2);
      expect(result[0].productIdsList).toEqual(['product-1', 'product-2', 'product-3']);
    });

    it('should filter bundles by status when provided', async () => {
      const mockBundles = [createMockBundle({ id: 'bundle-1', status: 'active' })];
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.findMany.mockResolvedValue(mockBundles);

      await getBundlesByShop('test-shop.myshopify.com', 'active');

      expect(prismaBundleMock.findMany).toHaveBeenCalledWith({
        where: { shop: 'test-shop.myshopify.com', status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateBundle', () => {
    it('should update bundle and return updated bundle with parsed fields', async () => {
      const mockBundle = createMockBundle({ name: 'Updated Bundle' });
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 1 });
      prismaBundleMock.findFirst.mockResolvedValue(mockBundle);

      const result = await updateBundle('bundle-123', 'test-shop.myshopify.com', { name: 'Updated Bundle' });

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Bundle');
    });

    it('should return null when bundle not found', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 0 });

      const result = await updateBundle('non-existent', 'test-shop.myshopify.com', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should serialize productIds when updating', async () => {
      const mockBundle = createMockBundle();
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 1 });
      prismaBundleMock.findFirst.mockResolvedValue(mockBundle);

      await updateBundle('bundle-123', 'test-shop.myshopify.com', {
        productIds: ['new-product-1', 'new-product-2'],
      });

      expect(prismaBundleMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'bundle-123', shop: 'test-shop.myshopify.com' },
        data: expect.objectContaining({
          productIds: '["new-product-1","new-product-2"]',
        }),
      });
    });
  });

  describe('deleteBundle', () => {
    it('should soft delete bundle by setting status to deleted', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 1 });

      const result = await deleteBundle('bundle-123', 'test-shop.myshopify.com');

      expect(result).toBe(true);
      expect(prismaBundleMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'bundle-123', shop: 'test-shop.myshopify.com' },
        data: { status: 'deleted' },
      });
    });

    it('should return false when bundle not found', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 0 });

      const result = await deleteBundle('non-existent', 'test-shop.myshopify.com');

      expect(result).toBe(false);
    });
  });

  describe('pauseBundle', () => {
    it('should pause an active bundle', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 1 });

      const result = await pauseBundle('bundle-123', 'test-shop.myshopify.com');

      expect(result).toBe(true);
      expect(prismaBundleMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'bundle-123', shop: 'test-shop.myshopify.com' },
        data: { status: 'paused' },
      });
    });
  });

  describe('activateBundle', () => {
    it('should activate a paused bundle', async () => {
      const prismaBundleMock = vi.mocked(prisma.bundle);

      prismaBundleMock.updateMany.mockResolvedValue({ count: 1 });

      const result = await activateBundle('bundle-123', 'test-shop.myshopify.com');

      expect(result).toBe(true);
      expect(prismaBundleMock.updateMany).toHaveBeenCalledWith({
        where: { id: 'bundle-123', shop: 'test-shop.myshopify.com' },
        data: { status: 'active' },
      });
    });
  });
});
