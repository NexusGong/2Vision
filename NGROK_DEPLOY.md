# 🌐 ngrok 公网临时部署指南

本指南介绍如何使用 ngrok 将 2Vision 项目临时部署到公网。

## 📋 前置要求

### 1. 安装 ngrok

```bash
# macOS (推荐)
brew install ngrok

# 或者手动下载
# https://ngrok.com/download
```

### 2. 配置 ngrok authtoken

1. 访问 [ngrok 官网](https://ngrok.com) 注册账号
2. 在 [Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) 获取 authtoken
3. 配置 authtoken：

```bash
ngrok config add-authtoken <你的authtoken>
```

---

## 🚀 部署方式

### 方式一：单端口部署（⭐ 推荐）

这是最简单的部署方式，只需要一个公网 URL。

```bash
# 一键部署
./deploy_ngrok_prod.sh
```

**工作原理**：
- 构建前端静态文件
- 后端同时服务 API 和前端静态文件
- 只需暴露 8000 端口

**优点**：
- ✅ 只需一个 URL
- ✅ 无需配置 CORS
- ✅ 部署简单

---

### 方式二：开发模式双隧道

适合开发调试时使用。

```bash
# 启动服务
./deploy_ngrok.sh
```

然后使用 ngrok 配置文件启动双隧道：

```bash
ngrok start --all --config ngrok.yml
```

或者分别启动两个隧道：

```bash
# 终端 1 - 前端
ngrok http 8080

# 终端 2 - 后端
ngrok http 8000
```

---

## 📱 分享访问

ngrok 启动后会显示类似以下信息：

```
Session Status    online
Account           your-email@example.com
Forwarding        https://xxxx-xxx-xxx.ngrok-free.app -> http://localhost:8000
```

将 `https://xxxx-xxx-xxx.ngrok-free.app` 分享给他人即可访问。

---

## ⚙️ 高级配置

### 自定义域名（需付费版）

```bash
ngrok http 8000 --domain=your-custom-domain.ngrok.io
```

### 基本认证保护

```bash
ngrok http 8000 --basic-auth="user:password"
```

### 查看请求日志

访问 http://localhost:4040 可以查看所有经过 ngrok 的请求。

---

## 🔧 常见问题

### Q: 前端页面空白？

确保已经构建前端：

```bash
cd frontend
pnpm build
```

### Q: API 请求失败？

1. 检查后端是否正常运行：
   ```bash
   curl http://localhost:8000/api/health
   ```

2. 查看后端日志：
   ```bash
   cat /tmp/2vision_prod.log
   ```

### Q: ngrok 连接不稳定？

免费版 ngrok 有连接限制，如需稳定服务请考虑：
- 升级 ngrok 付费版
- 使用其他内网穿透工具（如 frp、cloudflared）

### Q: 需要长期公网访问？

ngrok 免费版适合临时演示，长期使用建议：
- 购买云服务器部署
- 使用 Vercel/Netlify 等 PaaS 平台

---

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| `deploy_ngrok_prod.sh` | 单端口部署脚本（推荐） |
| `deploy_ngrok.sh` | 开发模式部署脚本 |
| `ngrok.yml` | ngrok 多隧道配置 |
| `backend/app/main_prod.py` | 生产模式后端入口 |

---

## 🛑 停止服务

在运行脚本的终端按 `Ctrl+C` 即可停止所有服务。
