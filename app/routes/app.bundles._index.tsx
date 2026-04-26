import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useNavigate } from "react-router";
import { json } from "../utils";
import { authenticate } from "../shopify.server";
import { getBundlesByShop } from "../bundle.server";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  IndexTable,
  Badge,
  EmptyState,
  ChoiceList,
} from '@shopify/polaris';

type BundleStatus = 'active' | 'draft' | 'paused' | 'deleted' | 'expired';

interface Bundle {
  id: string;
  name: string;
  description?: string;
  status: BundleStatus;
  bundleType: string;
  discountType: string;
  discountValue: number;
  minQuantity: number;
  productIdsList: string[];
  createdAt: string;
  updatedAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') as BundleStatus | null || undefined;
  const search = url.searchParams.get('search') || '';

  // Fetch products from Shopify
  const response = await admin.graphql(`
    query {
      products(first: 100) {
        edges {
          node {
            id
            title
            images(first: 1) {
              edges {
                node {
                  url
                }
              }
            }
          }
        }
      }
    }
  `);
  const productsData = await response.json();
  const productMap = new Map(
    productsData.data.products.edges.map((edge: any) => [edge.node.id, edge.node])
  );

  // Fetch bundles directly from database via backend functions
  let bundles: Bundle[] = [];
  try {
    bundles = await getBundlesByShop(session.shop, status);
  } catch (error) {
    console.error('Failed to fetch bundles:', error);
    // Return empty bundles on error - will show empty state to user
  }

  const filteredBundles = bundles.filter((bundle: Bundle) => {
    if (search && !bundle.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return json({
    bundles: filteredBundles,
    productMap: Object.fromEntries(productMap),
    stats: {
      activeCount: bundles.filter((b: Bundle) => b.status === 'active').length,
      totalOrders: 0,
      totalSavings: 0,
    },
  });
};

export default function BundleList() {
  const { bundles, stats } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getStatusBadge = (status: BundleStatus) => {
    const statusConfig: Record<BundleStatus, { color: 'success' | 'warning' | 'critical' | 'subdued'; label: string }> = {
      active: { color: 'success', label: '活跃' },
      draft: { color: 'warning', label: '草稿' },
      paused: { color: 'critical', label: '已停用' },
      deleted: { color: 'critical', label: '已删除' },
      expired: { color: 'subdued', label: '已结束' },
    };
    const config = statusConfig[status] || { color: 'subdued', label: status };
    return <Badge color={config.color}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDiscount = (bundle: Bundle) => {
    if (bundle.discountType === 'percentage') {
      return `${bundle.minQuantity}件 ${bundle.discountValue}% off`;
    } else if (bundle.discountType === 'fixed_amount') {
      return `${bundle.minQuantity}件 $${bundle.discountValue.toFixed(2)}`;
    }
    return `${bundle.minQuantity}件`;
  };

  const rowMarkup = bundles.map((bundle: Bundle, index: number) => (
    <IndexTable.Row key={bundle.id} id={bundle.id} position={index}>
      <IndexTable.Cell>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2.5rem',
              height: '2.5rem',
              backgroundColor: '#F1F1F1',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
            }}
          >
            📦
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>{bundle.name || '未命名套餐'}</div>
            <div style={{ fontSize: '0.75rem', color: '#666666' }}>
              {formatDate(bundle.createdAt)}
            </div>
          </div>
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDiscount(bundle)}</IndexTable.Cell>
      <IndexTable.Cell>{getStatusBadge(bundle.status)}</IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            size="micro"
            onClick={() => navigate(`/app/bundles/${bundle.id}`)}
          >
            编辑
          </Button>
          {bundle.status === 'draft' && (
            <Button size="micro" primary onClick={() => handleActivate(bundle.id)}>
              激活
            </Button>
          )}
          {bundle.status === 'active' && (
            <Button size="micro" onClick={() => handlePause(bundle.id)}>
              停用
            </Button>
          )}
        </div>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const handleActivate = async (id: string) => {
    const formData = new FormData();
    formData.append('intent', 'activate');
    formData.append('id', id);

    await fetch('/app/bundles', {
      method: 'POST',
      body: formData,
    });

    window.location.reload();
  };

  const handlePause = async (id: string) => {
    const formData = new FormData();
    formData.append('intent', 'pause');
    formData.append('id', id);

    await fetch('/app/bundles', {
      method: 'POST',
      body: formData,
    });

    window.location.reload();
  };

  return (
    <Page
      title="FlowCart Bundles"
      primaryAction={
        <Button primary onClick={() => navigate('/app/bundle-new')}>
          创建套餐
        </Button>
      }
    >
      <Layout>
        {/* Stats Cards */}
        <Layout.Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#008060' }}>
                  {stats.activeCount}
                </div>
                <div style={{ color: '#666666', fontSize: '0.875rem' }}>活跃套餐</div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                  {stats.totalOrders}
                </div>
                <div style={{ color: '#666666', fontSize: '0.875rem' }}>本月订单</div>
              </div>
            </Card>
            <Card>
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                  ${stats.totalSavings.toFixed(0)}
                </div>
                <div style={{ color: '#666666', fontSize: '0.875rem' }}>节省金额</div>
              </div>
            </Card>
          </div>
        </Layout.Section>

        {/* Search and Filter */}
        <Layout.Section>
          <Card>
            <div style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <TextField
                placeholder="搜索套餐..."
                prefix={<span>🔍</span>}
                value={searchParams.get('search') || ''}
                onChange={(value) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (value) {
                    newParams.set('search', value);
                  } else {
                    newParams.delete('search');
                  }
                  setSearchParams(newParams);
                }}
                clearButton
              />
              <ChoiceList
                title=""
                choices={[
                  { label: '全部', value: '' },
                  { label: '活跃', value: 'active' },
                  { label: '草稿', value: 'draft' },
                  { label: '已停用', value: 'paused' },
                ]}
                selected={[searchParams.get('status') || '']}
                onChange={(value) => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('status', value[0]);
                  setSearchParams(newParams);
                }}
              />
            </div>
          </Card>
        </Layout.Section>

        {/* Bundle List */}
        <Layout.Section>
          <Card>
            {bundles.length === 0 ? (
              <EmptyState
                heading="还没有创建任何套餐"
                action={
                  <Button primary onClick={() => navigate('/app/bundle-new')}>
                    创建我的第一个套餐
                  </Button>
                }
                image="https://cdn.shopify.com/s/files/1/0266/0559/6564/files/emptystate-files.svg"
              >
                <p>创建你的第一个捆绑销售套餐，帮助顾客发现更多商品</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: '套餐', plural: '套餐' }}
                itemCount={bundles.length}
                headings={[
                  { title: '套餐' },
                  { title: '优惠' },
                  { title: '状态' },
                  { title: '操作' },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
