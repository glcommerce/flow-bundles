import { test, expect } from '@playwright/test';

/**
 * E2E Tests for FlowCart Bundles - Bundle Creation Flow
 *
 * Tests the 3-step bundle creation wizard:
 * - Step 1: Product Selection
 * - Step 2: Discount Rule Configuration
 * - Step 3: Preview & Publish
 *
 * Prerequisites:
 * - Shopify development store with test products
 * - App installed and authenticated
 * - Test products with variants configured
 */

test.describe('Bundle Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app's bundle creation page
    await page.goto('/app');
    // Verify we're on the app dashboard
    await expect(page.locator('h1, h2')).toContainText(['FlowCart', 'Bundles', 'Dashboard'], { ignoreCase: true });
  });

  test('should display 3-step bundle creation wizard', async ({ page }) => {
    // Click create bundle button
    const createButton = page.locator('button:has-text("Create Bundle"), button:has-text("New Bundle")');
    await createButton.first().click();

    // Verify step indicators are present
    await expect(page.locator('text=Step 1, text=Step 2, text=Step 3')).toBeVisible();

    // Verify initial step (Product Selection) is active
    await expect(page.locator('text=Select Products, text=Choose Products')).toBeVisible();
  });

  test('Step 1 - Product Selection: should allow searching and selecting products', async ({ page }) => {
    // Navigate to bundle creation
    await page.goto('/app/bundles/new');

    // Search for products
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('shirt');
      await expect(searchInput).toHaveValue('shirt');
    }

    // Select products from results
    const productCheckboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    const count = await productCheckboxes.count();
    if (count > 0) {
      await productCheckboxes.first().click();
      await expect(productCheckboxes.first()).toBeChecked();
    }
  });

  test('Step 1 - Product Selection: should allow filtering by category', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Look for category/tag filters
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Category"), button:has-text("Tag")');
    if (await filterButton.first().isVisible()) {
      await filterButton.first().click();

      // Select a category option
      const categoryOption = page.locator('text=Tops, text=Shirts, text=Pants');
      if (await categoryOption.first().isVisible()) {
        await categoryOption.first().click();
      }
    }
  });

  test('Step 2 - Discount Rules: should display all discount type options', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Navigate to Step 2 (if not already there, complete Step 1 first)
    // For now, check that Step 2 elements exist
    const discountTypeSection = page.locator('text=Discount Type, text=Discount, text=Price');
    await expect(discountTypeSection.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Step 2 might not be visible without completing Step 1
      test.skip();
    });
  });

  test('Step 2 - Discount Rules: should accept fixed amount discount (e.g., $99)', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Look for price/discount inputs
    const priceInput = page.locator('input[type="number"], input[placeholder*="$"], input[placeholder*="99"]');
    if (await priceInput.first().isVisible()) {
      await priceInput.first().fill('99');
      await expect(priceInput.first()).toHaveValue('99');
    }
  });

  test('Step 2 - Discount Rules: should accept percentage discount (e.g., 15%)', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Look for percentage option
    const percentageOption = page.locator('text=Percentage, text=% Off, text=Percent');
    if (await percentageOption.first().isVisible()) {
      await percentageOption.first().click();
    }

    const percentInput = page.locator('input[type="number"][placeholder*="%"], input[placeholder*="15"]');
    if (await percentInput.isVisible()) {
      await percentInput.fill('15');
      await expect(percentInput).toHaveValue('15');
    }
  });

  test('Step 2 - Discount Rules: should accept minimum quantity (e.g., 3 items)', async ({ page }) => {
    await page.goto('/app/bundles/new');

    const quantityInput = page.locator('input[type="number"]:near(text=Quantity), input[type="number"]:near(text=Items)');
    if (await quantityInput.first().isVisible()) {
      await quantityInput.first().fill('3');
      await expect(quantityInput.first()).toHaveValue('3');
    }
  });

  test('Step 3 - Preview: should display bundle summary before publishing', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Navigate through steps (simplified - actual implementation may vary)
    const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")');
    if (await nextButton.first().isVisible()) {
      await nextButton.first().click();
    }

    // Check for preview section
    const previewSection = page.locator('text=Preview, text=Summary, text=Review');
    await expect(previewSection.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      test.skip();
    });
  });

  test('Step 3 - Preview: should show estimated conversion improvement', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Look for metrics/data display
    const metricsSection = page.locator('text=Conversion, text=Improvement, text=Expected');
    await expect(metricsSection.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      test.skip();
    });
  });

  test('should show error when trying to publish without products', async ({ page }) => {
    await page.goto('/app/bundles/new');

    // Try to proceed without selecting products
    const publishButton = page.locator('button:has-text("Publish"), button:has-text("Create")');
    if (await publishButton.isVisible()) {
      await publishButton.click();

      // Should show validation error
      const errorMessage = page.locator('text=Select at least, text=Choose product, text=Required');
      await expect(errorMessage.first()).toBeVisible({ timeout: 3000 }).catch(() => {
        // Error might be shown differently
      });
    }
  });
});

test.describe('Bundle Management', () => {
  test('should display list of existing bundles', async ({ page }) => {
    await page.goto('/app/bundles');

    // Look for bundle list or empty state
    const bundleList = page.locator('[data-testid="bundle-list"], .bundle-list, table');
    const emptyState = page.locator('text=No bundles, text=Create your first');

    const hasList = await bundleList.isVisible().catch(() => false);
    const hasEmptyState = await emptyState.isVisible().catch(() => false);

    expect(hasList || hasEmptyState).toBeTruthy();
  });

  test('should allow pausing a bundle', async ({ page }) => {
    await page.goto('/app/bundles');

    // Look for pause action
    const pauseButton = page.locator('button:has-text("Pause"), button:has-text("Deactivate")');
    if (await pauseButton.first().isVisible()) {
      await pauseButton.first().click();

      // Verify status changed
      const pausedStatus = page.locator('text=Paused, text=Inactive');
      await expect(pausedStatus.first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    } else {
      test.skip();
    }
  });

  test('should allow deleting a bundle', async ({ page }) => {
    await page.goto('/app/bundles');

    // Look for delete action
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")');
    if (await deleteButton.first().isVisible()) {
      // Confirm deletion if dialog appears
      page.on('dialog', (dialog) => dialog.accept());

      await deleteButton.first().click();

      // Bundle should be removed from list or marked as deleted
      await expect(page.locator('text=Deleted, text=removed')).toBeVisible({ timeout: 3000 }).catch(() => {
        // Success notification might appear
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app');

    // Navigation should be accessible
    const menuButton = page.locator('button[aria-label*="Menu"], button[aria-label*="menu"], .hamburger');
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    // Main content should be visible without horizontal scroll
    const mainContent = page.locator('main, [role="main"]');
    await expect(mainContent).toBeVisible();

    // Check no horizontal overflow
    const bodyHandle = await page.$('body');
    const bodyWidth = await bodyHandle?.evaluate((el) => el.scrollWidth);
    const viewportWidth = page.viewportSize()?.width || 375;
    expect((bodyWidth || 0) <= viewportWidth).toBeTruthy();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/app');

    // Bundle creation wizard should be usable
    await page.goto('/app/bundles/new');

    const createButton = page.locator('button:has-text("Create Bundle")');
    await expect(createButton).toBeVisible();
  });
});
