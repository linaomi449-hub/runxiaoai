# 润小爱·产品智能咨询助手 — 打通版（前端 + 元器代理）

实现「网页前端 → 代理后端 → 腾讯元器对话 API」的打通：
- **知识库只在元器后台维护一份**，前端不再内嵌副本
- 前端保留润小爱 UI、头像、轮播标语、投保按钮、转人工微信号提交
- 后端代理隐藏 appkey，绝不出现在前端代码

## 目录结构

| 文件 | 作用 |
|------|------|
| `server.js` | 零依赖 Node 代理后端（同时托管前端静态页 + 图片） |
| `runxiaobao-assistant.html` | 前端页面，调用后端 `/api/chat` 和 `/api/transfer` |
| `images/avatar-runxiaoai.jpg` | 润小爱头像图片 |
| `yuanqi-system-prompt.md` | 元器系统提示词模板，粘进元器「角色设定」 |
| `package.json` | 部署配置（Railway/Render 用） |
| `.env.example` | 环境变量模板 |

---

## 本地运行

1. 需要 Node.js 18+（项目零第三方依赖，无需 `npm install`）
2. 配置密钥：复制 `.env.example` 为 `.env`，填入你的元器 appkey
   ```
   YUANQI_APPKEY=你的appkey
   ```
3. 启动：`node server.js`
4. 浏览器打开 `http://localhost:3000`

---

## 免费部署方案对比（2026年8月）

| 对比项 | Render（推荐） | Railway | Koyeb |
|--------|---------------|---------|-------|
| 免费额度 | 750小时/月（够1个服务全天候运行） | $5/月信用（约够运行2-3周） | 1个nano实例（512MB RAM，永久免费） |
| 需要信用卡 | **不需要** | 不需要（但额度用完会暂停） | 大部分地区不需要 |
| 闲置休眠 | 15分钟无访问休眠，冷启动约30-60秒 | 不休眠 | 支持scale-to-zero，冷启动<250ms |
| Node.js支持 | 原生支持，自动检测 | 原生支持（Nixpacks） | 原生支持 |
| 环境变量 | 支持 | 支持 | 支持 |
| 自定义域名 | 支持（免费TLS） | 支持 | 支持（5个免费） |
| 永久免费 | 是 | 是（但额度有限） | 是 |
| 适合场景 | 比赛/Demo/低流量 | 需要不休眠的小应用 | 需要快速响应的应用 |

> **推荐 Render**：无需信用卡、750小时/月永久免费、GitHub一键部署。15分钟休眠对比赛Demo完全够用，也可用 cron-job.org 每10分钟 ping 一次保持唤醒。

---

## 方案一：部署到 Render（推荐，5分钟上线，完全免费）

### 你需要准备
- 一个 GitHub 账号（没有就注册一个，免费）
- 你的元器 appkey（已有：`GwXU16Rb...`）

### 第1步：把项目推到 GitHub

1. 在 GitHub 新建一个仓库（比如叫 `runxiaoai`），设为 Public 或 Private 都行
2. 把 `runxiaobao-connect` 目录下的所有文件推上去：
   ```bash
   cd runxiaobao-connect
   git init
   git add .
   git commit -m "润小爱智能助手"
   git remote add origin https://github.com/你的用户名/runxiaoai.git
   git branch -M main
   git push -u origin main
   ```
   > 注意：`.gitignore` 已排除 `.env`，appkey 不会上传到 GitHub

### 第2步：在 Render 部署

1. 打开 https://render.com ，点「Sign Up」用 GitHub 账号登录
2. 点「New +」→「Web Service」
3. 选择你刚创建的 `runxiaoai` 仓库
4. 填写配置：
   - **Name**: `runxiaoai`（或任意名字）
   - **Runtime**: Node.js（自动检测）
   - **Build Command**: `npm install`（实际零依赖，但 Render 需要走个流程）
   - **Start Command**: `node server.js`
   - **Instance Type**: 选 **Free**
5. 点「Advanced」展开，添加环境变量：
   - Key: `YUANQI_APPKEY` → Value: `GwXU16RbCNVny0d1ulIvE5DAaDekDd7b`
   - Key: `YUANQI_APPID` → Value: `2083169587444756736`
6. 点「Create Web Service」，Render 自动开始构建部署
7. 部署完成后，顶部会显示公网地址：`https://runxiaoai.onrender.com`

### 第3步：测试

- 电脑浏览器打开 Render 给的地址 → 润小爱页面正常显示
- 手机微信扫码 → 直接打开润小爱公网地址
- 问"等待期是多久？" → 元器返回真实回答 + 蓝色"点击投保"按钮

### Render 免费层说明
- **750小时/月**：一个服务全天候运行约需720小时，刚好够用
- **15分钟休眠**：无人访问15分钟后自动休眠，下次访问时自动唤醒（约30-60秒）
- **保持唤醒技巧**：注册 https://cron-job.org （免费），设置每10分钟访问你的 Render URL 一次，服务就不会休眠
- **不会产生费用**：不绑信用卡，额度用完只是暂停服务，不会扣费

---

## 方案二：部署到 Railway（不休眠，但免费额度有限）

1. 打开 https://railway.app ，用 GitHub 登录
2. 点「New Project」→「Deploy from GitHub repo」
3. 选择你的 `runxiaoai` 仓库
4. Railway 自动检测到 `package.json`，开始构建
5. 在「Variables」标签添加环境变量：
   - `YUANQI_APPKEY` = `GwXU16RbCNVny0d1ulIvE5DAaDekDd7b`
   - `YUANQI_APPID` = `2083169587444756736`
6. 部署完成后点「Settings」→「Networking」→「Generate Domain」
7. 得到公网地址，类似：`https://runxiaoai-production.up.railway.app`

### Railway 免费层说明
- 每月 $5 免费信用额度，润小爱这种轻量应用大约可运行2-3周
- **不休眠**：有人没人访问都保持运行（优点也是缺点——消耗额度更快）
- 额度用完后服务暂停，下月1号自动重置

---

## 方案三：部署到 Koyeb（永久免费，不休眠）

1. 打开 https://www.koyeb.com ，用 GitHub 登录
2. 点「Create Service」→「GitHub」选择你的仓库
3. 配置：
   - **Builder**: Buildpack（自动检测 Node.js）
   - **Port**: 3000
   - **Path**: `/`
4. 在「Environment Variables」添加：
   - `YUANQI_APPKEY` = `GwXU16RbCNVny0d1ulIvE5DAaDekDd7b`
   - `YUANQI_APPID` = `2083169587444756736`
5. 选择 **Free** 套餐（nano 实例，512MB RAM）
6. 点「Deploy」
7. 得到公网地址：`https://runxiaoai-xxx.koyeb.app`

### Koyeb 免费层说明
- 1个 nano 实例（512MB RAM、0.1 vCPU、2GB SSD），永久免费
- 支持 scale-to-zero（闲置自动缩容，有请求时秒级唤醒）
- 2026年2月被 Mistral AI 收购，免费承诺不变

---

## 元器侧一次性配置

- 智能体已「发布」并在「API 管理」开启调用（获取 appkey）
- 把《润爱家员工保险服务手册》上传到元器「知识库」
- 把 `yuanqi-system-prompt.md` 的内容粘进元器「系统提示词 / 角色设定」

## 架构

```
浏览器(前端)  ──POST /api/chat──▶  server.js  ──▶  元器 API
      ▲                              │
      └──── 返回回答（JSON） ◀────────┘
```

## 降级与开关

- 后端不可用时，前端自动切换到内置本地知识库（`USE_LOCAL_FALLBACK=true`）
- 想完全不连元器：前端常量 `USE_API=false` 即回到离线模式

## 安全须知

- appkey 仅存在于后端环境变量，**绝不出现在前端代码**
- `.env` 含密钥，`.gitignore` 已排除，不会上传 GitHub
- 元器对话 API 并发限制为 10，勿短时间高频调用
