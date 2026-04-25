# FlowCart Bundles - 详细部署手册

**版本：** v1.0
**日期：** 2026-04-24
**目标：** 60天内获得第一个付费商家

---

## 📋 部署前检查清单

### ✅ 代码已完成

- [x] 前端3步创建向导
- [x] 后端API + Prisma Schema
- [x] Shopify Functions折扣引擎
- [x] CI/CD配置（GitHub Actions）
- [x] QA测试 42/42 通过

### ⏳ 待手动完成

- [ ] 配置GitHub Secrets
- [ ] 配置Shopify Partner Dashboard
- [ ] 触发首次部署

---

## 第一部分：配置 GitHub Secrets

### 1.1 获取 Shopfiy API 凭据

你已有：
- **Client ID:** `a9ef12c6032df330fb6df6a796a7161a`
- **Client Secret:** `<YOUR_SHOPIFY_API_SECRET>`

### 1.2 配置 GitHub Secrets

**步骤：**

1. 打开 GitHub 仓库页面
2. 点击 **Settings**（设置）
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**

添加以下 Secrets：

| Secret Name | Value |
|-------------|-------|
| `SHOPIFY_API_KEY` | `a9ef12c6032df330fb6df6a796a7161a` |
| `SHOPIFY_API_SECRET` | `<YOUR_SHOPIFY_API_SECRET>` |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/flowcart` |

**注意：** `DATABASE_URL` 需要根据你的实际数据库连接字符串填写。如果是 Shopify Cloudflare Workers 的数据库，请使用对应的连接字符串。

---

## 第二部分：配置 Shopify Partner Dashboard

### 2.1 登录 Shopify Partner Dashboard

1. 打开 [partners.shopify.com](https://partners.shopify.com)
2. 登录你的 Partner 账号
3. 进入 **Apps** → **FlowCart Bundles**

### 2.2 配置 App 凭据

1. 进入 **App setup** → **Credentials**
2. 确认 API Key 和 API Secret Key 已填写
3. 如需更新，点击 **Reset** 并复制新凭据到 GitHub Secrets

### 2.3 配置 Webhooks（可选）

进入 **App setup** → **Webhooks**：

| Event | Endpoint |
|-------|----------|
| `app/uninstalled` | `https://your-app-url/webhooks/app/uninstalled` |
| `app/scopes_update` | `https://your-app-url/webhooks/app/scopes_update` |

### 2.4 创建 App 版本

1. 进入 **App releases**
2. 点击 **Create new release**
3. 填写版本号（如 `1.0.0`）
4. 添加发布说明
5. 点击 **Save and publish**

---

## 第三部分：本地开发商店测试

### 3.1 安装 Shopify CLI

```bash
# 使用 npm 安装
npm install -g @shopify/cli@latest

# 验证安装
shopify version
```

### 3.2 连接开发商店

```bash
cd C:\Users\Everpretty1\Desktop\Shopify APP\flow-bundles

# 登录 Shopify
shopify auth login

# 连接商店
shopify link
```

### 3.3 本地运行测试

```bash
# 安装依赖
npm install

# 启动开发服务器
shopify app dev
```

访问显示的 URL（通常是 `https://localhost:3000`）测试 App。

### 3.4 推送数据库迁移

```bash
# 推送 Prisma 迁移到数据库
npx prisma migrate deploy
```

---

## 第四部分：通过 CLI 部署到 Shopify

### 4.1 部署命令

```bash
cd C:\Users\Everpretty1\Desktop\Shopify APP\flow-bundles

# 确保已登录
shopify auth login

# 部署 App
shopify app deploy
```

### 4.2 部署 Shopify Functions

```bash
cd extensions/discount-bundle-function

# 运行测试
cargo test

# 构建发布版本
cargo build --release

# 部署扩展
shopify extension deploy
```

### 4.3 部署检查清单

```
[ ] shopify app deploy 成功
[ ] shopify extension deploy 成功
[ ] 数据库迁移完成
[ ] App 出现在 Partner Dashboard
```

---

## 第五部分：GitHub Actions 自动部署

### 5.1 触发 CI/CD

当你 push 到 `main` 分支时，CI/CD 会自动运行：

1. **CI Job:**
   - 运行 `npm ci` 安装依赖
   - 运行 `npm run test` 测试
   - 运行 `npm run build` 构建

2. **CD Job:**
   - 部署到 Shopify
   - 运行 Prisma 迁移

### 5.2 手动触发部署

1. 打开 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Deploy to Shopify** workflow
4. 点击 **Run workflow**
5. 选择 `main` 分支
6. 点击 **Run workflow**

### 5.3 监控部署状态

1. **Actions** 标签显示所有 workflow runs
2. 点击具体的 run 查看日志
3. 如有失败，日志会显示错误信息

---

## 第六部分：验证部署成功

### 6.1 检查清单

- [ ] App 在 Shopify Partner Dashboard 显示
- [ ] App 在 Shopify Admin → Apps 中可见
- [ ] Bundle 创建页面可访问
- [ ] Shopify Functions 在 Checkout 生效
- [ ] 数据库连接正常

### 6.2 功能测试

1. **创建 Bundle：**
   - 进入 FlowCart Bundles App
   - 点击 "创建捆绑"
   - 选择商品（如 3 件 T恤）
   - 设置固定价格（如 $99）
   - 点击 "激活"

2. **验证折扣：**
   - 打开商店前台
   - 将选中的商品加入购物车
   - 进入 Checkout
   - 验证价格已自动更新为 $99

---

## 第七部分：常见问题

### Q1: 部署失败 "Invalid API key"

**原因：** GitHub Secrets 中的 API Key 错误或过期

**解决：**
1. 登录 Shopify Partner Dashboard
2. 获取新的 API Key/Secret
3. 更新 GitHub Secrets

### Q2: 数据库迁移失败

**原因：** 数据库连接字符串错误

**解决：**
1. 检查 `DATABASE_URL` 环境变量
2. 确保数据库服务器运行中
3. 验证数据库用户权限

### Q3: Shopify Functions 不生效

**原因：** Functions 未正确部署

**解决：**
```bash
cd extensions/discount-bundle-function
shopify extension deploy
```

### Q4: CI/CD workflow 卡住

**原因：** Secrets 未配置或权限不足

**解决：**
1. 确认所有 Secrets 已配置
2. 检查 GitHub Actions 权限（Settings → Actions → Workflow permissions）
3. 勾选 "Read and write permissions"

---

## 第八部分：上线后操作

### 8.1 App Store 提交（可选）

如需发布到 Shopify App Store：

1. **准备材料：**
   - [ ] App 图标（1024x1024 PNG）
   - [ ] 5张截图（桌面端 1440x900 + 移动端 390x844）
   - [ ] 描述文案
   - [ ] 隐私政策 URL

2. **提交审核：**
   - Shopify Partner Dashboard → App listing
   - 填写所有信息
   - 点击 "Submit for review"

### 8.2 监控设置

部署完成后，监控系统会自动收集数据：

- Prometheus metrics: `docs/monitoring/`
- Grafana dashboards: Overview, API, Database
- 告警规则: P1-P4

---

## 📞 紧急联系

如部署遇到问题：

1. 查看 GitHub Actions 日志
2. 检查 Shopify Partner Dashboard 状态
3. 验证数据库连接
4. 联系团队：project-manager@team

---

**祝部署顺利！60天目标：第一个付费商家！** 🚀
