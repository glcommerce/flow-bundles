# FlowCart Bundles - 测试框架

## 概述

本项目使用三层测试架构：
- **单元测试 (Unit Tests)** - Vitest
- **集成测试 (Integration Tests)** - Vitest + Prisma Test Utils
- **E2E测试 (E2E Tests)** - Playwright

## 测试工具栈

| 类型 | 工具 | 用途 |
|------|------|------|
| 单元/集成测试 | Vitest | 快速测试运行 + TypeScript支持 |
| 组件测试 | React Testing Library | React组件行为测试 |
| Mock | Vitest Mock | 数据库、外部API模拟 |
| E2E测试 | Playwright | 跨浏览器UI自动化测试 |
| 覆盖率 | Vitest Coverage (v8) | 代码覆盖率报告 |

## 目录结构

```
tests/
├── setup.ts           # 测试全局配置和Mock
├── unit/              # 单元测试
│   ├── bundle.server.test.ts   # Bundle业务逻辑测试
│   └── validation.test.ts      # 验证函数测试
├── integration/       # 集成测试 (待实现)
│   └── api/
└── e2e/               # E2E测试
    └── bundle-flow.spec.ts     # 捆绑创建流程测试
```

## 执行命令

### 开发环境

```bash
# 运行所有测试
npm run test

# 运行单元测试
npm run test:unit

# 运行单元测试 (监视模式)
npm test

# 运行E2E测试 (需要本地开发服务器)
npm run test:e2e

# E2E测试 (UI模式 - 可视化调试)
npm run test:e2e:ui

# 生成覆盖率报告
npm run test:coverage
```

### CI环境

```bash
# 仅运行单元和集成测试 (不包含E2E)
npm run test:ci
```

## 测试覆盖目标

- **单元测试覆盖率**: 80%+
- **集成测试覆盖**: 核心API端点
- **E2E测试覆盖**: MVP关键用户流程

## 核心测试用例 (MVP)

### Bundle业务逻辑

| 测试用例 | 描述 | 优先级 |
|---------|------|--------|
| createBundle | 创建捆绑 | P0 |
| getBundleById | 按ID获取捆绑 | P0 |
| getBundlesByShop | 获取店铺所有捆绑 | P0 |
| updateBundle | 更新捆绑 | P0 |
| deleteBundle | 软删除捆绑 | P0 |
| pauseBundle | 暂停捆绑 | P1 |
| activateBundle | 激活捆绑 | P1 |
| buildMetafieldValue | 构建Metafield值 | P0 |

### 数据验证

| 测试用例 | 描述 | 优先级 |
|---------|------|--------|
| discountValue validation | 折扣值验证 | P0 |
| minQuantity validation | 最小数量验证 | P0 |
| productIds validation | 产品ID数组验证 | P0 |
| shop domain validation | 店铺域名验证 | P1 |

### E2E用户流程

| 测试用例 | 描述 | 优先级 |
|---------|------|--------|
| 3步创建捆绑 | 完整创建流程 | P0 |
| 产品搜索选择 | Step 1测试 | P0 |
| 折扣规则配置 | Step 2测试 | P0 |
| 预览发布 | Step 3测试 | P0 |
| 响应式设计 | 多设备适配 | P2 |

## Mock策略

### Prisma Client Mock

```typescript
// tests/setup.ts
vi.mock('../app/db.server', () => ({
  default: {
    bundle: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));
```

### Shopify API Mock (E2E)

E2E测试使用真实的Shopify开发商店配置环境变量。

## 故障排查

### Vitest常见问题

**模块解析错误**
```bash
# 重新生成Prisma Client
npx prisma generate
```

**测试超时**
```bash
# 增加超时时间
vi.setConfig({ testTimeout: 20000 })
```

### Playwright常见问题

**浏览器未安装**
```bash
npx playwright install chromium
```

**需要认证状态**
```bash
# 运行setup项目生成认证状态
npx playwright test --project=setup
```

## 持续集成

GitHub Actions配置示例：

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:ci
      - run: npm run test:coverage
```

## 后续计划

- [ ] 添加API集成测试
- [ ] 添加组件单元测试
- [ ] 配置CI/CD覆盖率检查
- [ ] 添加视觉回归测试
