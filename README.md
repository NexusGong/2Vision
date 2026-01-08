# 古诗词古文图像化学习工具

一款面向学生和教师的古诗词与古文学习图像化理解辅助工具，通过可视化手段降低理解难度，同时保持对原文结构与多义性的尊重。

## 功能特性

### 核心功能

- **文本分析**：对古诗词和古文进行断句、语义分层、人物与场景识别、时间顺序与情感变化分析
- **图像生成**：自动生成与各句段一一对应的连环画或多图故事书
- **原文对照**：在画面中同步呈现原文对照、核心意象、情节关系与理解提示
- **编辑功能**：支持编辑画面内容、表现风格、句段对应关系与讲解标注
- **项目管理**：支持创建、保存、加载项目，用于课前预习、课堂讲解与课后复习

### 诗词雅集（古诗词库）

- **分级浏览**：支持按类型（古诗词/古文）、版本（苏教版等）、年级、学期四级分类浏览
- **树形导航**：可展开/收纳的级联导航，层级清晰
- **快速搜索**：支持按诗词标题、作者、内容关键词搜索
- **一键选用**：点击诗词卡片即可将内容填入输入框进行图像生成
- **自定义收藏**：支持添加、管理用户自定义的诗词/古文内容

### 墨迹留痕（作品管理）

- **自动保存**：成功生成的故事书/连环画自动保存到作品库
- **作品预览**：以卡片形式展示作品封面、标题、创建时间
- **标题编辑**：支持修改作品标题，方便管理
- **一键查看**：点击卡片即可重新查看完整的故事书/连环画
- **批量管理**：支持单个删除或一键清空所有作品

## 技术栈

- **后端**：Python 3.10 + FastAPI + SQLAlchemy + SQLite
- **前端**：React + TypeScript + Modern.js + Arco Design + Tailwind CSS
- **AI 服务**：火山引擎 API（文本分析、图像生成）
- **认证**：JWT Token（可选）
- **环境**：Conda
- **包管理**：pnpm（前端）

## 项目结构

```
2Vision/
├── backend/                    # 后端代码
│   ├── app/
│   │   ├── api/               # API 路由
│   │   ├── models/            # 数据模型
│   │   ├── services/          # 业务逻辑
│   │   ├── database.py        # 数据库配置
│   │   └── main.py            # 主应用
│   ├── config.py              # 配置文件
│   ├── ark_client.py          # 火山引擎客户端
│   └── requirements.txt       # Python 依赖
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
│   │       │   └── GenerationsView/   # 墨迹留痕页面
│   │       ├── data/          # 数据文件
│   │       │   └── poetryData.ts      # 古诗词数据
│   │       ├── utils/         # 工具函数
│   │       │   ├── index.ts           # 通用工具
│   │       │   ├── chatHistory.ts     # 聊天历史管理
│   │       │   └── generations.ts     # 作品记录管理
│   │       ├── apis/          # API 接口
│   │       └── routes/        # 路由页面
│   └── package.json           # 前端依赖
├── environment.yml            # Conda 环境配置
├── .env.example               # 环境变量示例
├── .gitignore                 # Git 忽略配置
└── README.md                  # 项目说明
```

## 环境准备

### 1. 安装 Conda

确保已安装 Conda。如果未安装，请访问 [Conda 官网](https://docs.conda.io/en/latest/miniconda.html) 下载安装。

### 2. 创建 Conda 环境

```bash
cd /Users/nexusg/PycharmProject/2Vision
conda env create -f environment.yml
conda activate 2vision
```

### 3. 配置环境变量

复制环境变量示例文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下配置：

```env
# 火山引擎配置（必需）
ARK_API_KEY=your_ark_api_key_here
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
MODEL_NAME=doubao-seed-1-6-251015
VISION_MODEL_NAME=doubao-seedream-4-0-250828

# JWT 配置（生产环境请修改）
SECRET_KEY=your-secret-key-change-in-production

# 其他配置可根据需要修改
```

### 4. 获取火山引擎 API Key

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey)
2. 创建 API Key
3. 将 API Key 填入 `.env` 文件

## 安装依赖

### 后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 前端依赖

前端使用 Modern.js 框架，需要 pnpm 包管理器：

```bash
# 安装 pnpm（如果未安装）
npm install -g pnpm

# 进入前端目录
cd frontend

# 安装依赖
pnpm install
```

## 运行项目

### 1. 启动后端服务

```bash
cd backend
python -m app.main
```

后端服务将在 `http://127.0.0.1:8000` 启动。

### 2. 启动前端服务

在新的终端窗口中：

```bash
cd frontend
pnpm dev
```

前端服务将在 `http://localhost:3000` 启动（Modern.js 默认端口）。

### 3. 访问应用

打开浏览器访问 `http://localhost:3000`，使用注册的账号登录即可使用。

## API 文档

后端服务启动后，可以访问以下地址查看 API 文档：

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## 主要 API 端点

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 文本分析
- `POST /api/text/analyze` - 分析古诗词或古文

### 图像生成
- `POST /api/image/generate` - 生成图像
- `POST /api/image/generate_stream` - 流式生成图像

### 项目管理
- `POST /api/project/create` - 创建项目
- `GET /api/project/list` - 获取项目列表
- `GET /api/project/{id}` - 获取项目详情
- `PUT /api/project/{id}` - 更新项目
- `POST /api/project/{id}/image` - 添加图像项
- `PUT /api/project/image/{id}` - 更新图像项
- `POST /api/project/{id}/annotation` - 添加标注
- `PUT /api/project/annotation/{id}` - 更新标注
- `DELETE /api/project/annotation/{id}` - 删除标注

## 安全性

项目已实施以下安全措施：

1. **API 密钥管理**：使用环境变量存储敏感信息
2. **输入验证**：所有用户输入进行验证和清理
3. **SQL 注入防护**：使用 SQLAlchemy ORM，参数化查询
4. **认证安全**：JWT token 过期机制，密码加密存储（bcrypt）
5. **CORS 配置**：合理配置跨域策略

## 开发说明

### 数据库初始化

首次运行时会自动创建数据库表。如果需要手动初始化：

```bash
cd backend
python -c "from app.database import init_db; init_db()"
```

### 代码结构

- `backend/app/api/` - API 路由层，处理 HTTP 请求
- `backend/app/services/` - 业务逻辑层，包含核心功能实现
- `backend/app/models/` - 数据模型层，定义数据库表结构
- `frontend/src/pages/` - 页面组件
- `frontend/src/services/` - API 调用服务

## 部署

### 生产环境建议

1. **修改 SECRET_KEY**：使用强随机字符串
2. **配置 CORS_ORIGINS**：限制允许的域名
3. **使用 HTTPS**：配置 SSL 证书
4. **数据库**：考虑使用 PostgreSQL 替代 SQLite
5. **反向代理**：使用 Nginx 作为反向代理
6. **进程管理**：使用 systemd 或 supervisor 管理进程

### Docker 部署（可选）

项目支持 Docker 部署，可以创建 `Dockerfile` 和 `docker-compose.yml` 进行容器化部署。

## 常见问题

### 1. 火山引擎 API 调用失败

- 检查 `ARK_API_KEY` 是否正确
- 确认已开通相关模型服务
- 查看后端日志获取详细错误信息

### 2. 数据库错误

- 确保有写入权限
- 检查数据库文件路径是否正确

### 3. 前端无法连接后端

- 检查后端服务是否启动
- 确认 `vite.config.ts` 中的代理配置正确

## 许可证

本项目基于 [火山方舟原型应用软件自用许可协议](https://www.volcengine.com/docs/82379/1433703)。

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题，请通过 Issue 反馈。

