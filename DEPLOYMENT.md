# FlowCart Bundles - 部署方案

## 项目概述

**项目**: FlowCart Bundles - Shopify捆绑销售应用
**技术栈**: Node.js 20, React Router 7, Prisma, PostgreSQL, Docker, Shopify Functions

---

## 部署前置条件

### 必须满足的条件

| 条件 | 状态 | 说明 |
|------|------|------|
| Shopify Functions代码审查完成 | 待确认 | 需要shopify-functions-engineer确认 |
| QA测试通过 | 待确认 | 需要qa-tester确认 |
| Shopify Partner Dashboard配置 | 待配置 | App已注册，需配置环境 |

### Shopify Partner Dashboard配置清单

1. **应用注册**
   - [ ] 创建新应用并获取API Key/Secret
   - [ ] 配置应用URL (APP_URL)
   - [ ] 配置重定向URL

2. **Webhook配置**
   - [ ] `app/uninstalled` 订阅
   - [ ] `app/scopes_update` 订阅

3. **Shopify Functions配置**
   - [ ] 创建Checkout UI Extension
   - [ ] 创建Product Bundle Function (如有)
   - [ ] 配置函数API版本

---

## 部署内容

### 1. 前端App (React Router)

```bash
npm run build  # 构建产物到 build/ 目录
shopify app deploy  # 部署到Shopify
```

### 2. Shopify Functions扩展

Shopify Functions会通过`shopify.app.toml`自动部署，包含:
- Webhooks处理
- Checkout UI Extension
- 自定义商务逻辑

### 3. 数据库迁移 (Prisma)

```bash
# 生产环境迁移
npx prisma migrate deploy

# 或开发环境
npx prisma db push
```

---

## 三环境架构

| 环境 | 用途 | Shopify Store |
|------|------|---------------|
| development | 本地开发 | 开发商店 |
| staging | 预发布测试 | 测试商店 |
| production | 正式生产 | 生产商店 |

### 环境变量清单

#### 必需环境变量

```
# Application
NODE_ENV=production|development|staging
PORT=3000

# Database (Prisma/PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/flowbundles

# Shopify Authentication
SHOPIFY_API_KEY=<shopify_api_key>
SHOPIFY_API_SECRET=<shopify_api_secret>
SHOPIFY_SCOPES=write_products,write_metaobjects,write_metaobject_definitions

# App Configuration
APP_URL=https://your-app-domain.com
APP_HOST=your-app-domain.com

# Security
SESSION_SECRET=<random-32-char-secret>

# Webhooks
WEBHOOK_SECRET=<webhook-signing-secret>
```

#### 环境特定配置

**development (.env.local)**
```
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flowbundles_dev
APP_URL=http://localhost:3000
SHOPIFY_API_KEY=dev_api_key
SHOPIFY_API_SECRET=dev_api_secret
```

**staging (.env.staging)**
```
NODE_ENV=staging
DATABASE_URL=postgresql://user:password@staging-db:5432/flowbundles_staging
APP_URL=https://staging.flowbundles.example.com
SHOPIFY_API_KEY=staging_api_key
SHOPIFY_API_SECRET=staging_api_secret
```

**production (.env.production)**
```
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db:5432/flowbundles
APP_URL=https://app.flowbundles.example.com
SHOPIFY_API_KEY=prod_api_key
SHOPIFY_API_SECRET=prod_api_secret
```

---

## CI/CD流程设计

### 流水线阶段

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Build  │ -> │  Test   │ -> │  Lint   │ -> │ Deploy  │ -> │ Verify  │
│         │    │         │    │         │    │  Image  │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### GitHub Actions CI/CD配置

#### 1. 主CI流程 (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run typecheck
        run: npm run typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: flowbundles_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/flowbundles_test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: |
            build/
            !build/node_modules/
          retention-days: 7
```

#### 2. 部署流程 (.github/workflows/deploy.yml)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        type: choice
        options:
          - staging
          - production

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  deploy:
    name: Deploy to ${{ inputs.environment || 'staging' }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'staging' }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run typecheck
        run: npm run typecheck

      - name: Build Docker image
        run: |
          docker build \
            --tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            --tag ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest \
            .

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Push Docker images
        run: |
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to ${{ inputs.environment || 'staging' }}
        run: |
          # 使用Shopify CLI部署
          npm run deploy -- --env=${{ inputs.environment || 'staging' }}
        env:
          SHOPIFY_API_KEY: ${{ secrets.SHOPIFY_API_KEY }}
          SHOPIFY_API_SECRET: ${{ secrets.SHOPIFY_API_SECRET }}
          APP_URL: ${{ vars.APP_URL }}
          DATABASE_URL: ${{ secrets[format('DATABASE_URL_{0}', (inputs.environment || 'staging') |> upper)] }}

  e2e-test:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [deploy]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          APP_URL: ${{ vars.APP_URL }}
          SHOPIFY_SHOP_DOMAIN: ${{ secrets.SHOPIFY_TEST_SHOP_DOMAIN }}
          SHOPIFY_TEST_PASSWORD: ${{ secrets.SHOPIFY_TEST_PASSWORD }}
```

---

## Docker配置

### 多阶段构建Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl

ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Prisma generate and migrate
RUN npx prisma generate && npx prisma migrate deploy

USER nodejs

CMD ["sh", "-c", "npm run setup && npm run start"]
```

### Docker Compose (本地开发)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/flowbundles
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: flowbundles
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## 部署策略

### Git Flow + 环境映射

| Git分支 | 部署环境 | 自动/手动 |
|---------|----------|-----------|
| feature/* | 不部署 | - |
| develop | staging | 自动 |
| main | production | 手动审批 |

### 回滚策略

1. **Docker镜像回滚**
   ```bash
   # 回滚到上一个镜像
   docker pull ghcr.io/flowcart/bundles:<previous-sha>
   ```

2. **数据库回滚**
   ```bash
   # 使用Prisma migrate回滚
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

3. **Shopify App回滚**
   ```bash
   # 重新部署上一个版本
   shopify app deploy --version <previous-version-id>
   ```

---

## 监控与健康检查

### 健康检查端点

- `GET /health` - 应用健康状态
- `GET /health/ready` - 就绪检查(包含数据库连接)
- `GET /health/live` - 存活检查

### 探针配置

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 安全配置

### 环境变量管理

- 使用GitHub Secrets存储敏感信息
- 使用GitHub Variables存储非敏感配置
- 生产环境变量通过CI/CD注入,不存储在代码库

### 必需Secrets

```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
WEBHOOK_SECRET
SESSION_SECRET
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
```

---

## 文件清单

```
flow-bundles/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # CI流程
│   │   └── deploy.yml      # 部署流程
│   └── dependabot.yml      # 依赖更新
├── Dockerfile             # 生产Dockerfile
├── Dockerfile.dev         # 开发Dockerfile
├── docker-compose.yml     # 本地开发
├── .env.example           # 环境变量示例
└── shopify.app.toml       # Shopify应用配置
```

---

## 部署检查清单

### 部署前
- [ ] 所有CI检查通过
- [ ] 已在staging环境测试
- [ ] 数据库迁移已准备
- [ ] 回滚计划已确认

### 部署后
- [ ] 健康检查通过
- [ ] E2E测试通过
- [ ] Shopify App可访问
- [ ] Webhooks正常工作
