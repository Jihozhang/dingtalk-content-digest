# 钉钉日报机器人管理系统

基于 Python + FastAPI + MongoDB + React 的企业内部钉钉机器人系统，用于自动收集多个项目群的现场日报数据。

## 系统架构

```
钉钉群聊消息 → Stream 长连接 → 消息处理器 → 日报解析器 → MongoDB
                                          ↓
                                    Web 管理后台 (React)
```

## 技术栈

- **后端**: Python 3.11 + FastAPI + Uvicorn
- **数据库**: MongoDB (pymongo)
- **钉钉接入**: 钉钉 Stream 模式 (WebSocket 长连接)
- **前端**: React 18 + Vite + Ant Design + Recharts
- **部署**: 本地/服务器直接运行

## 项目结构

```
ddjqr/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 配置管理
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── report.py        # 日报数据模型
│   │   │   ├── group.py         # 群聊数据模型
│   │   │   └── user.py          # 用户数据模型
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py          # 登录鉴权
│   │   │   ├── reports.py       # 日报 API
│   │   │   ├── groups.py        # 群聊 API
│   │   │   └── stats.py         # 统计 API
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── dingtalk_stream.py  # Stream 连接管理
│   │   │   ├── message_handler.py  # 消息处理
│   │   │   ├── report_parser.py    # 日报解析
│   │   │   └── mongo_client.py     # 数据库操作
│   │   └── utils/
│   │       └── __init__.py
│   ├── requirements.txt
│   └── .env.example             # 环境变量模板
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── index.ts         # API 封装
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Groups.tsx
│   │   │   └── Stats.tsx
│   │   └── components/
│   │       └── Layout.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml            # MongoDB 容器编排
├── start.bat                     # Windows 启动脚本
├── start.sh                      # Linux/Mac 启动脚本
└── README.md
```

## 核心功能

### 1. 钉钉 Stream 消息接收
- 使用 WebSocket 建立长连接，同时监听多个群聊
- 只处理文本消息，忽略其他类型
- 通过 `conversation_id` 区分不同群聊
- 通过 `sender_staff_id` 区分不同员工

### 2. 日报解析与存储
- **主动提交模式**: 员工 @机器人 发送文本，机器人自动解析并存储
- 使用规则引擎 + 正则表达式提取关键字段：
  - 今日工作内容
  - 明日计划
  - 遇到的问题/风险
  - 工作时长
  - 其他备注
- 解析失败时标记为"待人工确认"
- 数据存储在 MongoDB 中，按群分类型管理

### 3. Web 管理后台
- **登录鉴权**: 管理员账号密码登录 (JWT Token)
- **群聊管理**: 查看已接入的群聊列表，配置群聊关联的项目
- **日报查看**: 按群聊、日期范围、员工筛选，支持导出 CSV
- **日报详情**: 查看单条日报的原始消息和解析结果
- **考核管理**: 标记日报质量（合格/不合格/需改进），添加考核备注
- **统计报表**: 各群日报提交率、员工提交统计、趋势图表

## 快速开始

### 1. 环境准备

- Python 3.11+
- Node.js 18+
- MongoDB (本地安装或使用 Docker)

### 2. 克隆/下载项目

```bash
cd ddjqr
```

### 3. 启动 MongoDB (Docker 方式)

```bash
docker-compose up -d
```

### 4. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，填入钉钉凭据和管理员密码
```

### 5. 安装后端依赖

```bash
python -m venv venv
# Windows:
.\venv\Scripts\pip install -r requirements.txt
# Linux/Mac:
# source venv/bin/pip install -r requirements.txt
```

### 6. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 7. 启动服务

**Windows:**
```bash
cd ..
start.bat
```

**Linux/Mac:**
```bash
./start.sh
```

或手动分别启动：

```bash
# 后端
cd backend
.\venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 前端 (新终端)
cd frontend
npm run dev
```

### 8. 访问系统

- 前端页面: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

默认管理员账号: `admin` / `admin123`（可在 `.env` 中修改）

## 钉钉开放平台配置

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建企业内部应用
3. 获取 `AppKey` 和 `AppSecret`
4. 添加机器人能力，获取 `RobotCode`
5. 将机器人添加到需要收集日报的群聊中
6. 配置权限：
   - `chat:chat:readonly`（读取群聊信息）
   - `robot:robot:readonly`（机器人基础权限）
   - `robot:message:send`（发送消息）
7. 将凭据填入 `backend/.env` 文件

## 环境变量说明

```env
# 钉钉配置
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_ROBOT_CODE=your_robot_code

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=dingtalk_daily_reports

# 后端配置
SECRET_KEY=change-me-in-production-secret-key-2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ACCESS_TOKEN_EXPIRE_MINUTES=480

# CORS 配置（前端开发服务器地址）
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

## 日报提交格式

员工在群里发送以下内容（@机器人 或 直接发送均可）：

```
今日工作：完成了用户模块的接口开发，修复了3个bug
明日计划：开始订单模块的开发
遇到的问题：数据库连接池偶尔超时，已调整配置
工作时长：8小时
备注：无
```

系统会自动解析并存储到 MongoDB 中，管理员可在 Web 后台查看、筛选、考核和导出。

## 后续扩展建议

1. **定时提醒功能**: 使用 APScheduler 实现每日定时提醒未提交日报的员工
2. **AI 智能解析**: 接入大模型 API，提升日报解析准确率
3. **多维度统计**: 增加周报、月报自动生成
4. **消息通知**: 日报提交状态变更时通知相关人员
5. **数据导出**: 支持 PDF 格式导出，便于存档
