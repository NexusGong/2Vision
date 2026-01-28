# 古诗词古文图像化学习工具

一款面向学生和教师的古诗词与古文学习图像化理解辅助工具，通过 AI 驱动的可视化手段降低理解难度，同时保持对原文结构与多义性的尊重。

## 功能特性

### 核心功能

- **文本分析**：
  - 智能断句：支持句号、问号、感叹号、逗号、分号作为分句标记
  - 自动识别并过滤标题和作者行，只分析实际诗句内容
  - 语义分层、人物与场景识别、时间顺序与情感变化分析
  - 自动生成分镜脚本，为图像生成提供详细指导

- **图像生成**：
  - 自动生成与各句段一一对应的连环画或多图故事书
  - **连环画模式特殊功能**：
    - 封面显示标题、朝代、作者（文字用双引号包裹，可在图像中显示）
    - 每个画面显示对应的诗句（文字用双引号包裹，可在图像中显示）
  - 支持多种图片比例（9:16、16:9等）
  - 支持上传参考图片影响生成风格
  - 流式生成，实时查看进度

- **视频生成**：
  - 基于古诗词分析结果，生成动态视频内容
  - 包含场景、画面、音乐、朗诵等完整要素
  - 支持多种分辨率（720p、1080p）和时长（5秒、12秒）
  - 古风韵味的等待动画，包含进度、步骤和诗句提示

- **原文对照**：在画面中同步呈现原文对照、核心意象、情节关系与理解提示

- **编辑功能**：支持编辑画面内容、表现风格、句段对应关系与讲解标注

- **项目管理**：支持创建、保存、加载项目，用于课前预习、课堂讲解与课后复习

### 诗词雅集（古诗词库）

- **分级浏览**：支持按类型（古诗词/古文）、版本（苏教版等）、年级、学期四级分类浏览
- **树形导航**：可展开/收纳的级联导航，层级清晰
- **快速搜索**：支持按诗词标题、作者、内容关键词搜索
- **一键选用**：点击诗词卡片即可将内容填入输入框进行图像生成
- **自定义收藏**：支持添加、管理用户自定义的诗词/古文内容
- **状态记忆**：选择诗词后返回页面，再次进入时会自动恢复到上次选择的位置

### 墨迹留痕（作品管理）

- **自动保存**：成功生成的故事书/连环画/视频自动保存到作品库
- **作品预览**：以卡片形式展示作品封面、标题、创建时间
- **标题编辑**：支持修改作品标题，方便管理
- **一键查看**：点击卡片即可重新查看完整的故事书/连环画/视频
- **批量管理**：支持单个删除或一键清空所有作品
- **视频支持**：支持视频作品的预览、下载和全屏播放
- **智能删除**：只有在同时删除对话和卡片时，才在后端存储中删除对应的图片/视频文件，避免误删

### 用户系统

- **用户注册/登录**：支持手机号注册和登录（可选短信验证）
- **使用量管理**：基于 Token 的使用量统计和管理
- **支付系统**：支持支付宝收款码支付，自动验证支付状态
- **管理面板**：管理员可查看用户统计、使用量统计、收入统计等

### API监控告警系统

- **自动监控**：实时监控API调用状态、Cookie有效性、服务余额等
- **邮件告警**：当出现问题时自动发送邮件通知（支持QQ邮箱）
- **监控内容**：
  - 火山引擎API错误（文本分析、图像生成、视频生成）
  - 短信服务API错误和余额不足告警
  - 支付宝Cookie过期检测
  - 其他关键错误
- **告警限流**：同一问题在限流时间内最多发送1次告警，避免重复通知
- **余额监控**：短信余额低于阈值时自动发送告警邮件

## 技术栈

- **后端**：Python 3.10 + FastAPI + SQLAlchemy + SQLite
- **前端**：React + TypeScript + Modern.js + Arco Design + Tailwind CSS
- **AI 服务**：火山引擎 API（文本分析、图像生成、视频生成）
- **认证**：JWT Token
- **环境**：Conda
- **包管理**：pnpm（前端）

## 项目结构

```
2Vision/
├── backend/                    # 后端代码
│   ├── app/
│   │   ├── api/               # API 路由
│   │   │   ├── admin.py      # 管理面板接口
│   │   │   ├── auth.py        # 用户认证接口
│   │   │   ├── image.py       # 图像生成接口
│   │   │   ├── payment.py     # 支付接口
│   │   │   ├── project.py     # 项目管理接口
│   │   │   ├── text.py        # 文本分析接口
│   │   │   ├── user.py        # 用户管理接口
│   │   │   └── video.py       # 视频生成接口
│   │   ├── models/            # 数据模型
│   │   ├── services/          # 业务逻辑
│   │   │   ├── alipay_verifier.py  # 支付宝验证服务
│   │   │   ├── auth.py             # 认证服务
│   │   │   ├── email_notifier.py   # 邮件通知服务
│   │   │   ├── image_generator.py  # 图像生成服务
│   │   │   ├── monitor.py          # API监控告警服务
│   │   │   ├── payment_poller.py  # 支付轮询服务
│   │   │   ├── sms.py              # 短信服务（含余额监控）
│   │   │   ├── text_analyzer.py    # 文本分析服务
│   │   │   ├── usage_manager.py   # 使用量管理服务
│   │   │   └── video_generator.py  # 视频生成服务
│   │   ├── middleware/        # 中间件
│   │   │   └── usage_tracker.py   # 使用量追踪
│   │   ├── database.py        # 数据库配置
│   │   └── main.py            # 主应用
│   ├── config.py              # 配置文件
│   ├── ark_client.py          # 火山引擎客户端
│   ├── requirements.txt       # Python 依赖
│   ├── .env.example           # 环境变量示例
│   └── storage/               # 文件存储目录（自动创建）
│       ├── images/            # 图片存储
│       ├── videos/            # 视频存储
│       └── qrcode/            # 收款码图片（可选）
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── common/
│   │   │   └── components/    # 通用组件
│   │   │       ├── ChatBox/   # 聊天输入组件
│   │   │       └── StoryBook/ # 故事书展示组件
│   │   └── storybook-web/     # 主应用模块
│   │       ├── components/    # 页面组件
│   │       │   ├── HistorySidebar/    # 历史记录侧边栏
│   │       │   ├── PoetryLibrary/     # 诗词雅集页面
│   │       │   ├── GenerationsView/   # 墨迹留痕页面
│   │       │   └── AdminPanel/        # 管理面板
│   │       ├── apis/          # API 接口封装
│   │       ├── routes/        # 路由页面
│   │       └── utils/         # 工具函数
│   └── package.json           # 前端依赖
├── environment.yml            # Conda 环境配置
├── .env.example               # 环境变量示例（根目录，已废弃，使用 backend/.env.example）
├── .gitignore                 # Git 忽略配置
├── start_backend.sh          # 后端启动脚本
├── start_frontend.sh          # 前端启动脚本
└── README.md                  # 项目说明
```

## 快速开始

### 前置要求

1. **Conda**：用于 Python 环境管理
   - 下载地址：https://docs.conda.io/en/latest/miniconda.html
   - 安装后确保 `conda` 命令可用

2. **Node.js**：版本 >= 22
   - 下载地址：https://nodejs.org/
   - 安装后确保 `node` 和 `npm` 命令可用

3. **pnpm**：前端包管理器
   - 安装命令：`npm install -g pnpm`
   - 或使用项目指定的版本：`npm install -g pnpm@9.15.9`

4. **火山引擎 API Key**：用于 AI 服务
   - 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey)
   - 创建 API Key 并记录

### 安装步骤

#### 1. 克隆项目

```bash
git clone <repository-url>
cd 2Vision
```

#### 2. 创建 Conda 环境

```bash
conda env create -f environment.yml
conda activate 2vision
```

#### 3. 配置环境变量

复制环境变量示例文件：

```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env` 文件，配置以下**必需**的配置项：

```env
# 火山引擎配置（必需）
ARK_API_KEY=your_ark_api_key_here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
MODEL_NAME=doubao-seed-1-6-251015
VISION_MODEL_NAME=doubao-seedream-4-0-250828
VIDEO_MODEL_NAME=doubao-seedance-1-5-pro-251215

# JWT 配置（必需，生产环境请修改为强随机字符串）
SECRET_KEY=your-secret-key-change-in-production

# 数据库配置（默认即可）
DATABASE_URL=sqlite:///./app.db

# API 配置（默认即可）
API_HOST=127.0.0.1
API_PORT=8000

# CORS 配置（开发环境默认即可）
CORS_ORIGINS=*
```

**重要**：将 `ARK_API_KEY` 替换为你在火山引擎控制台获取的真实 API Key。

#### 4. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

**注意**：如果安装 `volcengine-python-sdk[ark]` 失败，可以尝试：
```bash
pip install 'volcengine-python-sdk[ark]>=1.0.0'
```

#### 5. 安装前端依赖

```bash
cd frontend
pnpm install
```

### 运行项目

#### 方式一：使用启动脚本（推荐）

**启动后端**（在项目根目录）：

```bash
./start_backend.sh
```

**启动前端**（在新的终端窗口，项目根目录）：

```bash
./start_frontend.sh
```

#### 方式二：手动启动

**启动后端**：

```bash
# 确保 Conda 环境已激活
conda activate 2vision

# 进入后端目录
cd backend

# 启动服务
python -m app.main
```

后端服务将在 `http://127.0.0.1:8000` 启动。

**启动前端**（在新的终端窗口）：

```bash
# 进入前端目录
cd frontend

# 启动服务
pnpm dev
```

前端服务将在 `http://localhost:3000` 启动（Modern.js 默认端口）。

#### 3. 访问应用

打开浏览器访问 `http://localhost:3000`，注册账号后即可使用。

## 环境变量配置说明

### 必需配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `ARK_API_KEY` | 火山引擎 API Key | 从火山引擎控制台获取 |
| `SECRET_KEY` | JWT 密钥（生产环境请使用强随机字符串） | 至少32位随机字符串 |

### 可选配置

#### OAuth 登录（可选）

如需启用 GitHub、Google 或微信登录：

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/auth/oauth/github/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/oauth/google/callback

# 微信 OAuth（需要企业认证）
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_REDIRECT_URI=http://localhost:8000/api/auth/oauth/wechat/callback

# 前端URL（用于OAuth回调重定向）
FRONTEND_URL=http://localhost:3000
```

#### 短信服务（可选）

如需启用真实短信验证（使用互亿无线）：

```env
# 是否启用短信服务（true/false），false时使用模拟发送
SMS_ENABLED=false
# APIID
SMS_ACCOUNT=your_sms_account
# APIKEY
SMS_PASSWORD=your_sms_password
# 短信模板ID（默认使用模板1）
SMS_TEMPLATE_ID=1
# 短信API地址（默认互亿无线）
SMS_API_URL=https://api.ihuyi.com/sms/Submit.json
# 短信余额阈值（条数），低于此值会发送告警邮件
# 例如：设置为100表示余额低于100条时发送告警
# 设置为0或留空则不检查余额
SMS_BALANCE_THRESHOLD=100
```

#### 支付宝支付（可选）

如需启用支付宝收款码支付：

```env
# 支付宝收款码图片URL（可以是本地路径或网络URL）
# 如果使用套餐对应的收款码，请将收款码图片放在 backend/storage/qrcode/ 目录下
ALIPAY_QR_CODE_URL=
# 支付宝账号名称（用于显示，如：张三的支付宝）
ALIPAY_ACCOUNT_NAME=

# 支付宝自动验证配置（用于自动查询收款记录并确认支付）
# 获取方法：
# 1. 登录网页版支付宝（https://b.alipay.com）
# 2. 打开浏览器开发者工具（F12），在Console中输入 document.cookie 并回车
# 3. 复制完整的cookie字符串，粘贴到下面的 ALIPAY_COOKIE 配置中
# 注意：Cookie会过期，建议每周更新一次。如果发现自动验证失败，请重新获取Cookie。
ALIPAY_COOKIE=your_alipay_cookie_string_here
# 以下两个参数可以从cookie中自动提取，也可以手动配置
ALIPAY_CTOKEN=
ALIPAY_BILL_USER_ID=
# 轮询间隔（秒），默认30秒
ALIPAY_POLLING_INTERVAL=30
# 轮询超时时间（秒），默认300秒（5分钟）
ALIPAY_POLLING_TIMEOUT=300
```

#### 邮件告警配置（可选）

如需启用API监控告警邮件通知（使用QQ邮箱）：

```env
# 是否启用邮件告警（true/false），false时不会发送告警邮件
EMAIL_ENABLED=false
# SMTP服务器地址（QQ邮箱）
EMAIL_SMTP_HOST=smtp.qq.com
# SMTP端口（QQ邮箱推荐使用587，如果不可用可尝试465）
EMAIL_SMTP_PORT=587
# SMTP用户名（QQ邮箱地址，格式：QQ号@qq.com）
EMAIL_SMTP_USER=your_qq_number@qq.com
# SMTP授权码（不是QQ邮箱登录密码！）
# 获取方法：登录QQ邮箱 -> 设置 -> 账户 -> 开启SMTP服务 -> 生成授权码
EMAIL_SMTP_PASSWORD=your_qq_authorization_code
# 发件人邮箱地址（通常与EMAIL_SMTP_USER相同）
EMAIL_FROM=your_qq_number@qq.com
# 收件人邮箱地址（支持多个，用逗号分隔）
EMAIL_TO=your_email@example.com
# 是否使用TLS加密（true/false）
# 使用587端口时设置为true，使用465端口时设置为false
EMAIL_USE_TLS=true

# 监控告警配置
# 告警限流时间（小时），同一问题在此时间内最多发送1次告警
ALERT_THROTTLE_HOURS=1.0
```

**详细配置步骤**：请参考 `backend/MONITORING_SETUP.md`（如果存在）或查看 `.env.example` 文件中的注释说明。

#### 其他配置

```env
# 文件上传配置
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.gif

# 内容验证配置
ENABLE_CONTENT_VALIDATION=true
CONTENT_VALIDATION_STRICT=true
MIN_CHINESE_RATIO=0.6

# 文件存储配置
STORAGE_DIR=./storage
STATIC_URL_PREFIX=/static/media
```

## 使用指南

### 基本使用流程

1. **注册/登录**：访问 `http://localhost:3000`，注册新账号或登录
2. **输入古诗词**：在主界面输入古诗词或古文内容
3. **选择模式**：选择故事书或连环画模式
4. **生成图像**：点击生成，等待 AI 分析和图像生成
5. **查看作品**：在"墨迹留痕"页面查看所有生成的作品

### 功能说明

- **文本分析**：系统会自动分析古诗词，识别句段、人物、场景等
- **图像生成**：支持上传参考图片，选择图片比例
- **视频生成**：选择视频分辨率、时长等参数
- **诗词库**：在"诗词雅集"页面浏览和选择古诗词
- **作品管理**：在"墨迹留痕"页面管理所有生成的作品

### 支付系统（可选）

如果配置了支付宝支付：

1. 在用户中心查看 Token 余额
2. 选择套餐并创建支付订单
3. 扫描收款码完成支付
4. 系统自动验证支付并充值 Token

## API 文档

后端服务启动后，可以访问以下地址查看 API 文档：

- **Swagger UI**：`http://127.0.0.1:8000/docs`
- **ReDoc**：`http://127.0.0.1:8000/redoc`

### 主要 API 端点

#### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

#### 文本分析
- `POST /api/text/analyze` - 分析古诗词或古文

#### 图像生成
- `POST /api/image/generate` - 生成图像
- `POST /api/image/generate_stream` - 流式生成图像
- `GET /api/image/tasks/active` - 获取活跃的图像生成任务
- `POST /api/image/delete` - 批量删除图片文件

#### 视频生成
- `POST /api/video/generate` - 生成视频（同步）
- `POST /api/video/generate_async` - 生成视频（异步）
- `GET /api/video/task/{task_id}` - 查询视频生成任务状态
- `POST /api/video/delete` - 批量删除视频文件

#### 用户管理
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息
- `GET /api/user/usage` - 获取使用量统计

#### 支付
- `POST /api/payment/create` - 创建支付订单
- `POST /api/payment/confirm` - 确认支付

#### 项目管理
- `POST /api/project/create` - 创建项目
- `GET /api/project/list` - 获取项目列表
- `GET /api/project/{id}` - 获取项目详情
- `PUT /api/project/{id}` - 更新项目

#### 管理面板（需要管理员权限）
- `GET /api/admin/stats` - 获取统计信息
- `GET /api/admin/users` - 获取用户列表
- `GET /api/admin/usage` - 获取使用量统计

## 数据库初始化

首次运行时会自动创建数据库表。如果需要手动初始化：

```bash
cd backend
python -c "from app.database import init_db; init_db()"
```

数据库文件默认保存在 `backend/app.db`。

## 常见问题

### 1. Conda 环境激活失败

**问题**：`conda activate 2vision` 命令不生效

**解决方案**：
```bash
# 初始化 conda
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate 2vision
```

或使用启动脚本 `./start_backend.sh`，脚本会自动处理环境激活。

### 2. 火山引擎 API 调用失败

**问题**：图像或视频生成失败，提示 API 错误

**解决方案**：
- 检查 `ARK_API_KEY` 是否正确配置
- 确认已开通相关模型服务（文本分析、图像生成、视频生成）
- 查看后端日志获取详细错误信息
- 确认 API Key 有足够的余额

### 3. 前端无法连接后端

**问题**：前端页面显示连接错误

**解决方案**：
- 检查后端服务是否启动（默认 `http://127.0.0.1:8000`）
- 确认 Modern.js 配置中的代理设置正确
- 检查 CORS 配置是否允许前端域名
- 查看浏览器控制台的错误信息

### 4. 图像生成失败或数据不完整

**问题**：生成的图像显示不完整或失败

**解决方案**：
- 检查消息状态，loading 状态下数据可能尚未准备好，这是正常现象
- 确认 API 返回的数据格式正确
- 查看浏览器控制台的错误信息（开发环境）
- 检查网络连接和 API 服务状态

### 5. 文本分析断句不正确

**问题**：系统断句不符合预期

**解决方案**：
- 系统会自动识别并过滤标题和作者行
- 支持逗号、分号作为分句标记
- 如果断句不正确，可以手动调整输入格式
- 确保输入的古诗词格式正确

### 6. 连环画模式文字不显示

**问题**：生成的连环画中文字不显示

**解决方案**：
- 确保 prompt 中包含用双引号包裹的文字
- 检查图像模型是否支持文字渲染
- 查看生成的图像提示词是否正确

### 7. pnpm 安装失败

**问题**：`pnpm install` 失败

**解决方案**：
```bash
# 确保 Node.js 版本 >= 22
node --version

# 使用项目指定的 pnpm 版本
npm install -g pnpm@9.15.9

# 清理缓存后重试
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 8. 数据库文件权限错误

**问题**：无法创建或写入数据库文件

**解决方案**：
- 确保 `backend` 目录有写入权限
- 检查磁盘空间是否充足
- 如果使用 SQLite，确保文件系统支持 SQLite

### 9. 支付验证失败

**问题**：支付宝支付后系统未自动验证

**解决方案**：
- 检查 `ALIPAY_COOKIE` 是否配置且未过期
- Cookie 会过期，建议每周更新一次
- 查看后端日志中的支付宝查询错误信息
- 确认收款码配置正确
- 如果配置了邮件告警，Cookie过期时会自动收到告警邮件

### 10. 邮件告警未收到

**问题**：配置了邮件告警但没有收到告警邮件

**解决方案**：
- 确认 `EMAIL_ENABLED=true`
- 检查QQ邮箱SMTP配置是否正确（服务器、端口、用户名、授权码）
- **重要**：`EMAIL_SMTP_PASSWORD` 必须使用授权码，不是QQ邮箱登录密码
- 确认已开启QQ邮箱的SMTP服务并获取了授权码
- 检查收件人邮箱地址是否正确（`EMAIL_TO`）
- 查看后端日志中的邮件发送相关错误信息
- 检查邮箱的垃圾邮件文件夹
- 确认防火墙和网络设置允许SMTP连接（587或465端口）

### 11. 短信余额告警

**问题**：如何设置短信余额告警

**解决方案**：
- 在 `.env` 文件中设置 `SMS_BALANCE_THRESHOLD=100`（或其他数值）
- 系统会在每次发送短信前自动检查余额
- 当余额低于阈值时，会自动发送告警邮件（如果已启用邮件告警）
- 建议设置合理的阈值（如100条），以便及时充值

## 开发说明

### 代码结构

- `backend/app/api/` - API 路由层，处理 HTTP 请求
  - `admin.py` - 管理面板接口
  - `auth.py` - 用户认证相关接口
  - `image.py` - 图像生成接口
  - `payment.py` - 支付接口
  - `project.py` - 项目管理接口
  - `text.py` - 文本分析接口
  - `user.py` - 用户管理接口
  - `video.py` - 视频生成接口

- `backend/app/services/` - 业务逻辑层，包含核心功能实现
  - `alipay_verifier.py` - 支付宝验证服务
  - `auth.py` - 认证服务（统一认证逻辑）
  - `email_notifier.py` - 邮件通知服务（API监控告警）
  - `image_generator.py` - 图像生成服务
  - `monitor.py` - API监控告警服务（错误监控、余额检查、告警限流）
  - `payment_poller.py` - 支付轮询服务
  - `sms.py` - 短信服务（验证码发送、余额查询和监控）
  - `text_analyzer.py` - 文本分析服务（智能断句、分镜生成）
  - `usage_manager.py` - 使用量管理服务
  - `video_generator.py` - 视频生成服务

- `backend/app/models/` - 数据模型层，定义数据库表结构
- `backend/app/middleware/` - 中间件
  - `usage_tracker.py` - 使用量追踪中间件

- `frontend/src/storybook-web/` - 主应用模块
  - `routes/page.tsx` - 主页面组件
  - `components/` - 页面组件（历史记录、诗词库、作品管理、管理面板等）
  - `utils/` - 工具函数（历史记录、作品管理、图片/视频引用检查等）
  - `apis/` - API 接口封装

### 性能优化

项目实施了以下性能优化措施：

#### 后端优化

1. **智能任务管理**：
   - 任务管理器自动清理过期任务（24小时TTL，每小时清理一次）
   - 防止内存泄漏，自动释放已完成的任务资源
   - 优化数据库连接池配置

2. **日志优化**：
   - 视频轮询日志从每10次改为每20次输出
   - 使用 WARNING 级别减少生产环境日志输出

#### 前端优化

1. **智能轮询机制**：
   - 文本分析任务：指数退避策略（2-10秒）
   - 图像生成任务：指数退避策略（3-15秒）
   - 视频生成任务：动态轮询间隔（10-20秒）
   - 活跃任务检查：仅在存在活跃任务时定期检查

2. **数据持久化优化**：
   - 历史记录保存使用防抖机制（500ms延迟）
   - 添加 localStorage 配额检查和错误处理

3. **API 调用优化**：
   - 实现带重试机制的 fetch 函数（最多3次重试，指数退避）
   - 统一错误处理逻辑

### 安全性

项目已实施以下安全措施：

1. **API 密钥管理**：使用环境变量存储敏感信息
2. **输入验证**：所有用户输入进行验证和清理
3. **SQL 注入防护**：使用 SQLAlchemy ORM，参数化查询
4. **认证安全**：JWT token 过期机制，密码加密存储（bcrypt）
5. **CORS 配置**：合理配置跨域策略
6. **错误处理安全**：所有 API 错误返回通用错误消息，不泄露内部错误详情
7. **数据安全**：localStorage 操作添加错误处理，防止配额溢出
8. **监控告警**：API错误、Cookie过期、余额不足等问题自动监控并邮件告警
9. **敏感信息保护**：告警邮件中敏感信息自动脱敏处理

## 部署

### 生产环境建议

1. **修改 SECRET_KEY**：使用强随机字符串（至少32位）
2. **配置 CORS_ORIGINS**：限制允许的域名，不要使用 `*`
3. **使用 HTTPS**：配置 SSL 证书
4. **数据库**：考虑使用 PostgreSQL 替代 SQLite（高并发场景）
5. **反向代理**：使用 Nginx 作为反向代理
6. **进程管理**：使用 systemd 或 supervisor 管理进程
7. **环境变量**：使用环境变量或密钥管理服务，不要硬编码
8. **启用监控告警**：配置邮件告警系统，及时了解API错误、Cookie过期、余额不足等问题
9. **设置合理阈值**：为短信余额等设置合理的告警阈值，避免服务中断

### 使用生产模式

项目提供了生产模式启动脚本 `backend/app/main_prod.py`，可以：

```bash
cd backend
python -m app.main_prod
```

生产模式会：
- 禁用自动重载
- 优化日志输出
- 使用生产环境配置

### Docker 部署（可选）

项目支持 Docker 部署，可以创建 `Dockerfile` 和 `docker-compose.yml` 进行容器化部署。

## 最近更新

### 功能增强
- ✅ 连环画模式支持文字显示（封面显示标题、朝代、作者，画面显示对应诗句）
- ✅ 智能断句：自动识别并过滤标题和作者行
- ✅ API 调用添加重试机制，提高稳定性
- ✅ **智能删除机制**：只有在同时删除对话和卡片时，才在后端存储中删除对应的图片/视频文件，避免误删
- ✅ **诗词雅集状态记忆**：选择诗词后返回页面，再次进入时会自动恢复到上次选择的位置
- ✅ **支付系统**：支持支付宝收款码支付，自动验证支付状态
- ✅ **使用量管理**：基于 Token 的使用量统计和管理
- ✅ **管理面板**：管理员可查看用户统计、使用量统计、收入统计等
- ✅ **API监控告警系统**：自动监控API调用、Cookie状态、服务余额，问题发生时自动发送邮件告警
- ✅ **短信余额监控**：自动查询短信余额，余额不足时自动发送告警邮件

### 性能优化
- ✅ 实现指数退避轮询策略，减少服务器压力
- ✅ 添加防抖机制，减少频繁的 localStorage 写入
- ✅ 任务管理器自动清理过期任务，防止内存泄漏
- ✅ 优化日志输出频率，减少I/O压力

### 安全性增强
- ✅ 所有 API 错误返回通用消息，不泄露内部信息
- ✅ 优化错误处理，避免暴露系统细节
- ✅ localStorage 操作添加错误处理，防止配额溢出

## 许可证

本项目基于 [火山方舟原型应用软件自用许可协议](https://www.volcengine.com/docs/82379/1433703)。

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题，请通过 Issue 反馈。

---

**提示**：首次使用前，请确保已配置火山引擎 API Key，否则无法使用 AI 功能。
