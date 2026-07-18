# 钉钉群聊智能汇总系统 · DingTalk Content Digest

> 让「上报」发生在群聊里 —— 群成员 @机器人 正常说话，系统自动收集、AI 结构化解析成日报/模板数据，并能定时智能汇总、一键回推到群。

一套基于 **Python + FastAPI + MongoDB + React** 的钉钉群聊信息收集与智能汇总系统。相比传统「打开系统填表」的日志收集方式，它把上报动作藏进大家每天都在用的群聊里：成员只需 @机器人 把情况说出来，后台就自动完成采集、解析、统计与汇总，天然更容易被接受和坚持。

> 📌 本项目已开源，欢迎自由使用与二次开发。如果对你有帮助，欢迎点个 ⭐ Star 支持一下。

## ✨ 功能特性

- **群聊即上报**：成员在群里 @机器人 发送消息，Stream 长连接实时接收，自动入库去重。
- **模板化 AI 解析**：预置/自定义格式模板（如日报的「今日完成 / 遇到的问题 / 明日计划」），AI 自动把口语化内容拆解、对应到各字段，生成结构化记录，可直接统计、导出。
- **智能汇总（日报/周报）**：定时或手动读取指定时间段的群聊记录，调用大模型生成整体概览、热点话题、待办事项、风险问题、关键结论。
- **一键回推群聊**：把整理好的汇总摘要一键回发到群，信息从群里来、整理好再回到群里去，形成闭环。
- **内容统计与考核管理**：按群、按人、按天沉淀工作记录，支持提交统计、质量考核标记与数据导出，便于复盘。
- **Web 管理后台**：JWT 登录鉴权、群聊管理、数据记录、模板配置、AI 汇总、统计报表等可视化页面。
- **消息回填**：支持定时回填历史群消息，避免数据缺口。

## 🧭 系统架构

```
钉钉群聊消息 (@机器人)
      │  Stream 长连接 (WebSocket)
      ▼
消息处理器 message_handler ──► 原始消息入库 (messages)
      │
      ├─► 模板匹配 + AI 解析 (template_parser / ai_parser) ──► 结构化数据 (data_records)
      │
      └─► 定时/手动汇总 (ai_digest, 调用 DeepSeek) ──► 结构化摘要 (digests) ──► 一键回推群聊
                                                              │
                                                              ▼
                                                   Web 管理后台 (React + Ant Design)
```

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.11 · FastAPI · Uvicorn · Pydantic |
| 数据库 | MongoDB (pymongo) |
| 钉钉接入 | 钉钉 Stream 模式 (dingtalk-stream, WebSocket 长连接) |
| AI | DeepSeek / 兼容 OpenAI 接口 (openai SDK) |
| 定时任务 | APScheduler |
| 前端 | React 18 · Vite · TypeScript · Ant Design · Recharts |
| 部署 | 本地/服务器直接运行，MongoDB 可用 Docker Compose |

## 📁 项目结构

```
ddjqr/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口 & 生命周期
│   │   ├── config.py               # 配置管理 (读取 .env)
│   │   ├── models/                 # 数据模型 (message/report/template/digest/ai_summary/group/user)
│   │   ├── routers/                # API 路由
│   │   │   ├── auth.py             #   登录鉴权
│   │   │   ├── data_records.py     #   结构化数据记录
│   │   │   ├── templates.py        #   模板管理
│   │   │   ├── digests.py          #   智能汇总
│   │   │   ├── ai_summary.py       #   AI 摘要
│   │   │   ├── content_stats.py    #   内容统计
│   │   │   ├── reports.py / groups.py / stats.py
│   │   └── services/               # 业务服务
│   │       ├── dingtalk_stream.py  #   Stream 连接管理
│   │       ├── dingtalk_chat.py    #   群消息回推
│   │       ├── message_handler.py  #   消息处理
│   │       ├── template_parser.py  #   模板匹配 & 解析
│   │       ├── ai_parser.py        #   AI 字段解析
│   │       ├── ai_digest.py        #   智能汇总生成
│   │       ├── ai_summarizer.py    #   AI 摘要
│   │       ├── scheduler.py        #   定时任务调度
│   │       ├── message_backfill.py #   历史消息回填
│   │       └── mongo_client.py     #   数据库操作
│   ├── scripts/init_templates.py   # 初始化内置模板
│   ├── requirements.txt
│   └── .env.example                # 环境变量模板
├── frontend/
│   ├── src/
│   │   ├── main.tsx / App.tsx
│   │   ├── api/index.ts            # API 封装
│   │   ├── components/Layout.tsx
│   │   └── pages/                  # Dashboard / DataRecords / Templates /
│   │                               # Digests / AISummary / AIAnalysis /
│   │                               # ContentStats / Reports / Groups / Stats / Login
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml              # MongoDB 容器编排
├── start.bat / start.sh            # Windows / Linux·Mac 启动脚本
└── README.md
```

## 🚀 快速开始

### 1. 环境准备

- Python 3.11+
- Node.js 18+
- MongoDB（本地安装或用 Docker）

### 2. 启动 MongoDB（Docker 方式）

```bash
docker-compose up -d
```

### 3. 配置后端环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入钉钉凭据、AI Key 和管理员密码（详见下方「环境变量说明」）
```

### 4. 安装后端依赖

```bash
python -m venv venv
# Windows
.\venv\Scripts\pip install -r requirements.txt
# Linux/Mac
# source venv/bin/activate && pip install -r requirements.txt
```

### 5. （可选）初始化内置模板

```bash
# Windows
.\venv\Scripts\python scripts/init_templates.py
```

### 6. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 7. 启动服务

**Windows：**
```bash
cd ..
start.bat
```

**Linux/Mac：**
```bash
./start.sh
```

或手动分别启动：

```bash
# 后端（端口 8009）
cd backend
.\venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8009

# 前端（新终端，端口 5178）
cd frontend
npm run dev
```

### 8. 访问系统

- 前端页面：http://localhost:5178
- 后端 API：http://localhost:8009
- API 文档：http://localhost:8009/docs

默认管理员账号：`admin` / `admin123`（**请务必在 `.env` 中修改**）

## 🤖 钉钉开放平台配置

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建企业内部应用，获取 `AppKey` 和 `AppSecret`
3. 添加机器人能力，获取 `RobotCode`
4. 将机器人添加到需要收集数据的群聊中
5. 配置权限：
   - `chat:chat:readonly`（读取群聊信息）
   - `robot:robot:readonly`（机器人基础权限）
   - `robot:message:send`（发送/回推消息）
6. 将凭据填入 `backend/.env`

## ⚙️ 环境变量说明

```env
# 钉钉配置
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_ROBOT_CODE=your_robot_code

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=dingtalk_daily_reports

# 后端配置（生产环境请务必修改）
SECRET_KEY=change-me-in-production-secret-key-2024
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ACCESS_TOKEN_EXPIRE_MINUTES=480

# CORS（前端开发服务器地址）
CORS_ORIGINS=["http://localhost:5178","http://127.0.0.1:5178"]

# DeepSeek AI 配置（用于模板解析与智能汇总）
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# 定时智能汇总
DIGEST_DAILY_CRON=0 19 * * *     # 每日汇总，默认每天 19:00
DIGEST_WEEKLY_CRON=0 9 * * 1     # 每周汇总，默认每周一 09:00
DIGEST_PUSH_TO_GROUP=false       # 是否将汇总回推到群聊
ENABLE_SCHEDULER=true            # 是否启用定时任务

# 消息回填
BACKFILL_INTERVAL_MINUTES=30     # 回填间隔（分钟），0 表示关闭
BACKFILL_MAX_RESULTS=500         # 单次回填最大消息数
```

> ⚠️ **安全提示**：`.env` 已在 `.gitignore` 中忽略，请勿将真实密钥提交到仓库。生产环境务必修改 `SECRET_KEY`、`ADMIN_PASSWORD`，并妥善保管钉钉与 AI 的密钥。

## 📝 使用说明

### 群聊上报

成员在群里 @机器人 发送内容（示例，命中「日报」模板）：

```
今日工作：完成了用户模块接口开发，修复了 3 个 bug
明日计划：开始订单模块开发
遇到的问题：数据库连接池偶尔超时，已调整配置
工作时长：8 小时
```

系统会自动解析并按模板存入结构化数据，管理员可在 Web 后台查看、筛选、考核与导出。

### 智能汇总

- 在「智能汇总」页面选择群聊与时间范围，手动生成日报/周报摘要；
- 或开启 `ENABLE_SCHEDULER`，由调度器按 cron 自动生成；
- 生成后点击「详情」一键展开概览 / 热点 / 待办 / 风险 / 结论，或「回推」发回群里。

## 📄 开源协议

本项目基于 **MIT License** 开源，可自由使用、修改与分发，详见 [LICENSE](./LICENSE)。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。如需二次开发，可从 `services/` 下的解析与汇总模块入手扩展。

## ⚠️ 免责声明

本项目仅用于企业内部合法的团队协作与信息管理场景。使用者需遵守钉钉开放平台协议及相关法律法规，并就群聊数据的收集、存储与使用取得成员知情同意，作者不对滥用行为承担责任。**完整免责条款详见 [DISCLAIMER.md](./DISCLAIMER.md)。**

---

如果这套「群聊 → 自动日报 → 智能汇总」的思路对你有帮助，欢迎 ⭐ Star 支持，也欢迎在公众号回复 **「群聊机器人」** 获取源码地址。
