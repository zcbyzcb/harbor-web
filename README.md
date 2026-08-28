# Harbor Hotel Web

酒店前台 MVP 的 Web 前端。供前台员工登录后查看今日看板、按房型创建预订、查询订单、为多间客房办理入住，以及取消预订。

## 技术栈

- Vue 3、TypeScript、Vite
- Vue Router、Pinia
- Element Plus、Axios、SCSS
- Vitest、Playwright、ESLint、Prettier

## 前置条件

- Node.js `24.19.0`（见 `.node-version`）
- pnpm `10.32.1`
- 已启动后端服务，默认地址为 `http://127.0.0.1:18080`

## 本地启动

安装依赖并启动开发服务器：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

访问 `http://127.0.0.1:5173/login`。

开发服务器会将 `/api` 代理到 `http://127.0.0.1:18080`。若后端地址不同，请在启动前设置：

```bash
VITE_API_PROXY='http://127.0.0.1:18080' pnpm dev
```

登录使用数据库初始化时创建的员工账号和密码；密码不保存在前端代码、浏览器持久化存储或仓库中。

## 页面与功能

| 路径 | 功能 |
| --- | --- |
| `/login` | 员工登录 |
| `/` | 今日已入住、待入住、剩余房间看板 |
| `/booking` | 查询房型可用库存并创建预订 |
| `/orders` | 按订单号、姓名、电话、日期和状态查询订单 |
| `/orders/:id` | 查看订单、办理多房入住或取消预订 |

## 目录

```text
src/api/          HTTP 实例、认证与酒店 API
src/assets/       默认房型图片
src/composables/  可复用查询逻辑
src/layouts/      已登录页面布局
src/router/       路由与认证守卫
src/stores/       跨页面认证状态
src/views/        登录、看板、预订和订单页面
tests/            单元测试
```

## 认证与请求约定

- 启动及路由跳转时通过 `GET /api/auth/me` 恢复会话；未登录返回 401 属于正常状态。
- 登录前获取 CSRF Token；所有 POST 请求携带对应请求头和 Cookie。
- 创建预订、办理入住、取消预订使用原始 `Idempotency-Key` 重试，页面不会自动重放写请求。
- 遇到网络中断或结果不确定时，先查询订单或用原请求键重试，不要创建新的操作。

## 验证与构建

```bash
pnpm lint
pnpm test:unit
pnpm build
```

端到端测试命令为：

```bash
pnpm test:e2e
```

构建产物输出至 `dist/`。Vite 开发服务器会在源文件修改后自动热更新；若浏览器仍显示旧资源，可进行一次强制刷新。
