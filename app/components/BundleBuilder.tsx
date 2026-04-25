import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  ChoiceList,
  InlineError,
  Checkbox,
  Text,
  BlockStack,
  Modal,
  Icon,
  InlineStack,
} from '@shopify/polaris';
import { useFetcher } from 'react-router';
import { X } from '@shopify/polaris-icons';

interface BundleBuilderProps {
  products: Array<{
    id: string;
    title: string;
    price: string;
    image?: string;
    variants?: Array<{ id: string; title: string; price: string }>;
  }>;
  onComplete?: (bundleId: string) => void;
}

type Step = 'select-products' | 'set-discount' | 'preview';

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: 'select-products', label: '选择产品', description: '选择参与Bundle的产品' },
  { id: 'set-discount', label: '设置规则', description: '配置Bundle规则' },
  { id: 'preview', label: '发布预览', description: '确认并发布Bundle' },
];

const MAX_PRODUCTS = 10;

export function BundleBuilder({ products, onComplete }: BundleBuilderProps) {
  const fetcher = useFetcher();
  const [currentStep, setCurrentStep] = useState<Step>('select-products');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage' | 'fixedDiscount'>('fixed');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [minQuantity, setMinQuantity] = useState<string>('3');
  const [bundleName, setBundleName] = useState<string>('');
  const [allowPartialMatch, setAllowPartialMatch] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [noEndDate, setNoEndDate] = useState(false);
  const [showSelectedModal, setShowSelectedModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => p.title.toLowerCase().includes(query));
  }, [products, searchQuery]);

  const selectedProducts = useMemo(
    () => products.filter(p => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const totalOriginalPrice = useMemo(
    () => selectedProducts.reduce((sum, p) => sum + parseFloat(p.price.replace('$', '')), 0),
    [selectedProducts]
  );

  const finalPrice = useMemo(() => {
    const value = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') {
      return totalOriginalPrice * (1 - value / 100);
    }
    return value;
  }, [discountType, discountValue, totalOriginalPrice]);

  const savings = useMemo(() => Math.max(0, totalOriginalPrice - finalPrice), [totalOriginalPrice, finalPrice]);

  const savingsPercent = useMemo(
    () => (totalOriginalPrice > 0 ? Math.round((savings / totalOriginalPrice) * 100) : 0),
    [totalOriginalPrice, savings]
  );

  const suggestedPriceRange = useMemo(() => {
    if (totalOriginalPrice === 0) return { min: 0, max: 0 };
    return {
      min: totalOriginalPrice * 0.85,
      max: totalOriginalPrice * 0.95,
    };
  }, [totalOriginalPrice]);

  const handleProductToggle = useCallback(
    (productId: string) => {
      if (selectedProductIds.includes(productId)) {
        setSelectedProductIds(prev => prev.filter(id => id !== productId));
      } else if (selectedProductIds.length < MAX_PRODUCTS) {
        setSelectedProductIds(prev => [...prev, productId]);
      }
    },
    [selectedProductIds]
  );

  const handleQuantityChange = useCallback((delta: number) => {
    setMinQuantity(prev => {
      const current = parseInt(prev, 10) || 1;
      const next = Math.max(2, Math.min(10, current + delta));
      return String(next);
    });
  }, []);

  const validateStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 'select-products') {
      if (selectedProductIds.length < 2) {
        newErrors.products = '请至少选择2个产品';
      }
    }

    if (currentStep === 'set-discount') {
      const qty = parseInt(minQuantity, 10);
      if (!qty || qty < 2 || qty > 10) {
        newErrors.minQuantity = '件数需在2-10之间';
      }
      const value = parseFloat(discountValue);
      if (!value || value <= 0) {
        newErrors.discountValue = '请输入有效的价格';
      } else if (discountType === 'fixed' && value > totalOriginalPrice) {
        newErrors.discountValue = 'Bundle价格不能高于原价';
      } else if (discountType === 'percentage' && (value < 1 || value > 100)) {
        newErrors.discountValue = '请输入1-100之间的数值';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStep, selectedProductIds, minQuantity, discountValue, discountType, totalOriginalPrice]);

  const handleNext = useCallback(() => {
    if (!validateStep()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [currentStepIndex, validateStep]);

  const handleBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex]);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append('intent', 'create');
    formData.append('name', bundleName || `Bundle ${new Date().toLocaleDateString()}`);
    formData.append('discountType', discountType === 'fixedDiscount' ? 'fixed_amount' : discountType);
    formData.append('discountValue', discountValue);
    formData.append('minQuantity', minQuantity);
    formData.append('productIds', JSON.stringify(selectedProductIds));
    if (startDate) formData.append('startDate', startDate);
    if (endDate && !noEndDate) formData.append('endDate', endDate);

    fetcher.submit(formData, { method: 'POST', action: '/app/bundles' });
  }, [bundleName, discountType, discountValue, minQuantity, selectedProductIds, startDate, endDate, noEndDate, fetcher]);

  // Show success modal after successful submission
  const isSubmitting = fetcher.state === 'submitting';
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.bundle && !isSubmitting) {
      setShowSuccessModal(true);
    }
  }, [fetcher.state, fetcher.data, isSubmitting]);

  return (
    <Page title="创建捆绑套餐">
      <Layout>
        <Layout.Section>
          {/* Stepper */}
          <Card>
            <div style={{ padding: '1.5rem' }}>
              <WizardProgress currentStep={currentStepIndex} steps={STEPS} />
            </div>
          </Card>

          {/* Current Step Content */}
          <Card style={{ marginTop: '1rem' }}>
            <div style={{ padding: '1.5rem' }}>
              {currentStep === 'select-products' && (
                <ProductSelectionStep
                  products={filteredProducts}
                  selectedProductIds={selectedProductIds}
                  onToggle={handleProductToggle}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  error={errors.products}
                />
              )}

              {currentStep === 'set-discount' && (
                <DiscountStep
                  discountType={discountType}
                  onDiscountTypeChange={setDiscountType}
                  discountValue={discountValue}
                  onDiscountValueChange={setDiscountValue}
                  minQuantity={minQuantity}
                  onQuantityChange={handleQuantityChange}
                  totalOriginalPrice={totalOriginalPrice}
                  savings={savings}
                  savingsPercent={savingsPercent}
                  suggestedPriceRange={suggestedPriceRange}
                  allowPartialMatch={allowPartialMatch}
                  onPartialMatchChange={setAllowPartialMatch}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  noEndDate={noEndDate}
                  setNoEndDate={setNoEndDate}
                  errors={errors}
                />
              )}

              {currentStep === 'preview' && (
                <PreviewStep
                  bundleName={bundleName}
                  onBundleNameChange={setBundleName}
                  selectedProducts={selectedProducts}
                  minQuantity={minQuantity}
                  finalPrice={finalPrice}
                  totalOriginalPrice={totalOriginalPrice}
                  savings={savings}
                  savingsPercent={savingsPercent}
                />
              )}
            </div>
          </Card>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <Button onClick={handleBack} disabled={currentStepIndex === 0}>
              上一步
            </Button>
            {currentStep !== 'preview' ? (
              <Button onClick={handleNext} primary>
                下一步
              </Button>
            ) : (
              <Button onClick={handleSubmit} primary loading={isSubmitting}>
                立即发布
              </Button>
            )}
          </div>
        </Layout.Section>

        {/* Live Preview Sidebar */}
        <Layout.Section variant="oneThird">
          <BundlePreviewCard
            selectedProducts={selectedProducts}
            minQuantity={minQuantity}
            totalOriginalPrice={totalOriginalPrice}
            finalPrice={finalPrice}
            savings={savings}
            savingsPercent={savingsPercent}
            onShowSelected={() => setShowSelectedModal(true)}
            onClearAll={() => setSelectedProductIds([])}
          />
        </Layout.Section>
      </Layout>

      {/* Selected Products Modal */}
      <Modal
        open={showSelectedModal}
        onClose={() => setShowSelectedModal(false)}
        title={`已选商品 (${selectedProductIds.length})`}
        primaryAction={{
          content: '完成',
          onAction: () => setShowSelectedModal(false),
        }}
      >
        <Modal.Section>
          <BlockStack gap="3">
            {selectedProducts.map(product => (
              <InlineStack key={product.id} align="space-between" blockAlign="center">
                <InlineStack gap="3" align="center">
                  <div
                    style={{
                      width: '3rem',
                      height: '3rem',
                      backgroundColor: '#F1F1F1',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    {product.image ? (
                      <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        📦
                      </div>
                    )}
                  </div>
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {product.title}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {product.price}
                    </Text>
                  </div>
                </InlineStack>
                <Button
                  variant="tertiary"
                  icon={<Icon source={X} />}
                  onClick={() => handleProductToggle(product.id)}
                />
              </InlineStack>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="🎉 套餐发布成功！"
        primaryAction={{
          content: '查看套餐',
          onAction: () => {
            setShowSuccessModal(false);
            onComplete?.('bundle-created');
          },
        }}
        secondaryActions={[
          {
            content: '创建新套餐',
            onAction: () => {
              setShowSuccessModal(false);
              setCurrentStep('select-products');
              setSelectedProductIds([]);
              setDiscountValue('');
              setBundleName('');
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="3" align="center">
            <Text as="p" alignment="center">
              消费者可以在商店中看到 "{bundleName || '新套餐'}" 捆绑优惠
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function WizardProgress({ currentStep, steps }: { currentStep: number; steps: typeof STEPS }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  backgroundColor: isCompleted ? '#008060' : isCurrent ? '#006EFF' : '#E3E3E3',
                  color: isCompleted || isCurrent ? '#FFFFFF' : '#666666',
                  fontSize: '0.75rem',
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: isCurrent ? '#006EFF' : '#666666',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: '4rem',
                  height: '2px',
                  margin: '0 0.5rem',
                  marginBottom: '1.5rem',
                  backgroundColor: index < currentStep ? '#008060' : '#E3E3E3',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ProductSelectionStepProps {
  products: Array<{
    id: string;
    title: string;
    price: string;
    image?: string;
  }>;
  selectedProductIds: string[];
  onToggle: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  error?: string;
}

function ProductSelectionStep({
  products,
  selectedProductIds,
  onToggle,
  searchQuery,
  onSearchChange,
  error,
}: ProductSelectionStepProps) {
  return (
    <div>
      <BlockStack gap="4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
            选择参与Bundle的产品 {selectedProductIds.length > 0 && `（已选: ${selectedProductIds.length}）`}
          </h2>
          <Text as="p" variant="bodySm" tone="subdued">
            最多10个
          </Text>
        </div>

        <TextField
          placeholder="搜索产品..."
          prefix={<span>🔍</span>}
          value={searchQuery}
          onChange={onSearchChange}
          clearButton
        />

        {error && <InlineError message={error} fieldId="products" />}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '1rem',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {products.map(product => {
            const isSelected = selectedProductIds.includes(product.id);
            const hasVariants = product.variants && product.variants.length > 1;
            return (
              <div
                key={product.id}
                onClick={() => onToggle(product.id)}
                style={{
                  position: 'relative',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: `2px solid ${isSelected ? '#008060' : '#E3E3E3'}`,
                  backgroundColor: isSelected ? '#F8FBF9' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '50%',
                      backgroundColor: '#008060',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                    }}
                  >
                    ✓
                  </div>
                )}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    backgroundColor: '#F1F1F1',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    overflow: 'hidden',
                  }}
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                      }}
                    >
                      📦
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {product.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666666' }}>{product.price}</div>
                {hasVariants && (
                  <div style={{ fontSize: '0.625rem', color: '#5C6AC4', marginTop: '0.25rem' }}>
                    包含 {product.variants!.length} 个变体
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </BlockStack>
    </div>
  );
}

interface DiscountStepProps {
  discountType: 'fixed' | 'percentage' | 'fixedDiscount';
  onDiscountTypeChange: (type: 'fixed' | 'percentage' | 'fixedDiscount') => void;
  discountValue: string;
  onDiscountValueChange: (value: string) => void;
  minQuantity: string;
  onQuantityChange: (delta: number) => void;
  totalOriginalPrice: number;
  savings: number;
  savingsPercent: number;
  suggestedPriceRange: { min: number; max: number };
  allowPartialMatch: boolean;
  onPartialMatchChange: (value: boolean) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  noEndDate: boolean;
  setNoEndDate: (value: boolean) => void;
  errors: Record<string, string>;
}

function DiscountStep({
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  minQuantity,
  onQuantityChange,
  totalOriginalPrice,
  savings,
  savingsPercent,
  suggestedPriceRange,
  allowPartialMatch,
  onPartialMatchChange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  noEndDate,
  setNoEndDate,
  errors,
}: DiscountStepProps) {
  return (
    <div>
      <BlockStack gap="4">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>设置Bundle规则</h2>
          <Text as="p" variant="bodySm" tone="subdued">
            配置顾客购买条件和优惠力度
          </Text>
        </div>

        {/* Quantity */}
        <Card>
          <BlockStack gap="2">
            <Text as="h3" variant="bodyMd" fontWeight="semibold">
              件数要求
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Text as="p">顾客需购买</Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Button variant="tertiary" onClick={() => onQuantityChange(-1)} disabled={parseInt(minQuantity, 10) <= 2}>
                  -
                </Button>
                <TextField
                  type="number"
                  value={minQuantity}
                  onChange={() => {}}
                  style={{ width: '3rem', textAlign: 'center' }}
                  disabled
                />
                <Button variant="tertiary" onClick={() => onQuantityChange(1)} disabled={parseInt(minQuantity, 10) >= 10}>
                  +
                </Button>
              </div>
              <Text as="p">件</Text>
            </div>
            <Text as="p" variant="bodySm" tone="subdued">
              范围: 2-10
            </Text>
            {errors.minQuantity && <InlineError message={errors.minQuantity} fieldId="minQuantity" />}
          </BlockStack>
        </Card>

        {/* Discount Type */}
        <Card>
          <BlockStack gap="2">
            <Text as="h3" variant="bodyMd" fontWeight="semibold">
              固定价格
            </Text>
            <TextField
              type="number"
              value={discountValue}
              onChange={onDiscountValueChange}
              prefix="$"
              placeholder="79.99"
              error={errors.discountValue}
            />
            {discountValue && totalOriginalPrice > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Text as="p" variant="bodySm" tone="success">
                  预计节省: ${savings.toFixed(2)} ({savingsPercent}%)
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  建议定价区间 ${suggestedPriceRange.min.toFixed(2)} - ${suggestedPriceRange.max.toFixed(2)}
                </Text>
              </div>
            )}
          </BlockStack>
        </Card>

        {/* Partial Match Option */}
        <Card>
          <BlockStack gap="2">
            <Checkbox
              label="允许凑单"
              helpText="顾客可添加其他产品凑足件数"
              checked={allowPartialMatch}
              onChange={onPartialMatchChange}
            />
          </BlockStack>
        </Card>

        {/* Date Settings */}
        <Card>
          <BlockStack gap="3">
            <Text as="h3" variant="bodyMd" fontWeight="semibold">
              活动时间（可选）
            </Text>
            <InlineStack gap="2" blockAlign="center">
              <Text as="span" variant="bodySm">开始日期:</Text>
              <TextField
                type="date"
                value={startDate}
                onChange={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </InlineStack>
            <InlineStack gap="2" blockAlign="center">
              <Text as="span" variant="bodySm">结束日期:</Text>
              <TextField
                type="date"
                value={endDate}
                onChange={setEndDate}
                placeholder="YYYY-MM-DD"
                disabled={noEndDate}
              />
            </InlineStack>
            <Checkbox
              label="不设置结束日期"
              checked={noEndDate}
              onChange={setNoEndDate}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </div>
  );
}

interface PreviewStepProps {
  bundleName: string;
  onBundleNameChange: (name: string) => void;
  selectedProducts: Array<{ id: string; title: string; price: string; image?: string }>;
  minQuantity: string;
  finalPrice: number;
  totalOriginalPrice: number;
  savings: number;
  savingsPercent: number;
}

function PreviewStep({
  bundleName,
  onBundleNameChange,
  selectedProducts,
  minQuantity,
  finalPrice,
  totalOriginalPrice,
  savings,
  savingsPercent,
}: PreviewStepProps) {
  return (
    <div>
      <BlockStack gap="4">
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>预览 & 发布</h2>
          <Text as="p" variant="bodySm" tone="subdued">
            确认Bundle配置，发布后立即生效
          </Text>
        </div>

        {/* Bundle Preview Card */}
        <Card>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {selectedProducts.slice(0, 3).map(product => (
                <div
                  key={product.id}
                  style={{
                    width: '4rem',
                    height: '4rem',
                    backgroundColor: '#F1F1F1',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      📦
                    </div>
                  )}
                </div>
              ))}
              {selectedProducts.length > 3 && (
                <div
                  style={{
                    width: '4rem',
                    height: '4rem',
                    backgroundColor: '#E3E3E3',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    color: '#666666',
                  }}
                >
                  +{selectedProducts.length - 3}
                </div>
              )}
            </div>

            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              {minQuantity}件 Bundle 仅需 ${finalPrice.toFixed(2)}
            </div>
            <div style={{ color: '#666666', marginBottom: '0.5rem' }}>
              原价 ${totalOriginalPrice.toFixed(2)} 节省 ${savings.toFixed(2)} ({savingsPercent}% off)
            </div>

            <Button fullWidth>🛒 加入购物车</Button>
          </div>
        </Card>

        {/* Bundle Name */}
        <Card>
          <BlockStack gap="2">
            <Text as="h3" variant="bodyMd" fontWeight="semibold">
              Bundle名称（可选）
            </Text>
            <TextField
              value={bundleName}
              onChange={onBundleNameChange}
              placeholder="例如：春夏新品3件套餐"
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </div>
  );
}

interface BundlePreviewCardProps {
  selectedProducts: Array<{ id: string; title: string; price: string; image?: string }>;
  minQuantity: string;
  totalOriginalPrice: number;
  finalPrice: number;
  savings: number;
  savingsPercent: number;
  onShowSelected: () => void;
  onClearAll: () => void;
}

function BundlePreviewCard({
  selectedProducts,
  minQuantity,
  totalOriginalPrice,
  finalPrice,
  savings,
  savingsPercent,
  onShowSelected,
  onClearAll,
}: BundlePreviewCardProps) {
  return (
    <Card>
      <div style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>📦 实时预览</h3>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {selectedProducts.slice(0, 2).map(product => (
            <div
              key={product.id}
              style={{
                width: '3rem',
                height: '3rem',
                backgroundColor: '#F1F1F1',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              {product.image ? (
                <img src={product.image} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  📦
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{minQuantity}件套餐</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#008060', marginBottom: '0.5rem' }}>
          ${finalPrice.toFixed(2)}
        </div>
        <div style={{ color: '#666666', textDecoration: 'line-through', marginBottom: '0.25rem' }}>
          原价 ${totalOriginalPrice.toFixed(2)}
        </div>
        <div style={{ color: '#008060', fontSize: '0.875rem', marginBottom: '1rem' }}>
          节省 ${savings.toFixed(2)} ({savingsPercent}% off)
        </div>

        <div style={{ borderTop: '1px solid #E3E3E3', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ color: selectedProducts.length > 0 ? '#008060' : '#666666' }}>●</span>
            <span style={{ fontSize: '0.875rem' }}>已选 {selectedProducts.length} 件商品</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: minQuantity ? '#008060' : '#666666' }}>●</span>
            <span style={{ fontSize: '0.875rem' }}>购买 {minQuantity || '?'} 件</span>
          </div>
          {selectedProducts.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Button size="micro" onClick={onShowSelected}>查看已选</Button>
              <Button size="micro" variant="tertiary" onClick={onClearAll}>清除</Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default BundleBuilder;
