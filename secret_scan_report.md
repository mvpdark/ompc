# OMPC-SSB 敏感信息扫描报告

**扫描目录:** `C:\TRAE\OMPC-SSB`
**扫描日期:** 2026-07-13
**扫描方法:** `git ls-files` 获取追踪文件列表 + 多模式正则匹配 + 人工验证
**追踪文件总数:** 615 (排除 2 个 .env.example 后实际扫描 613 个)

---

## 一、总结

### Git 追踪文件中未发现真实生产级 API Key

对全部 613 个 git 追踪文件进行了深度扫描，搜索了以下模式：
- `sk-` 开头的 OpenAI/DeepSeek API Key
- `ghp_` / `gho_` / `ghs_` / `ghu_` 开头的 GitHub Token
- `tvly-` 开头的 Tavily API Key
- `AIza` 开头的 Google API Key
- `AKIA` 开头的 AWS Access Key
- `xox` 开头的 Slack Token
- JWT Token (`eyJ...`)
- Stripe / Telegram / Twilio / SendGrid 等平台密钥
- 硬编码的 password / secret / token / api_key 赋值
- 环境变量赋值 (ENV_VAR=value)
- 数据库连接字符串中的密码
- Bearer Token
- PEM 私钥

**结论：git 追踪文件中不存在真实的 sk-、ghp_、gho_、tvly-、deepseek 等格式的 API Key。**

---

## 二、Git 追踪文件中发现的低风险项

以下为在 git 追踪文件中发现的可疑项，经人工验证后判定为**低风险**（测试值或默认开发凭据）：

### 2.1 测试用硬编码 Secret (测试夹具，非真实密钥)

| 文件 | 行号 | 内容 | 风险评估 |
|------|------|------|----------|
| `backend/tests/test_model_router.py` | 79 | `secret = "test-compatible-key"` | 测试夹具，非真实密钥 |
| `backend/tests/test_model_router.py` | 142 | `secret = "test-compatible-key"` | 测试夹具，非真实密钥 |
| `backend/tests/test_model_router.py` | 181 | `secret = "test-compatible-key"` | 测试夹具，非真实密钥 |

**说明:** 该值仅用于 `monkeypatch.setattr(settings, "openai_compatible_api_key", secret)` 替换测试环境配置，不是真实 API Key。

### 2.2 默认数据库密码 (开发环境默认值)

| 文件 | 行号 | 内容 | 风险评估 |
|------|------|------|----------|
| `backend/alembic.ini` | 4 | `sqlalchemy.url = postgresql+psycopg://postgres:postgres@localhost:5432/opc` | 默认开发凭据，密码为 `postgres` |
| `docker-compose.yml` | 9 | `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}` | 环境变量引用，默认回退值为 `postgres` |

**说明:** `postgres:postgres` 是 PostgreSQL 的标准默认开发凭据。虽然被 git 追踪，但这是开发环境默认值，非生产密钥。建议生产环境通过环境变量覆盖。

### 2.3 环境变量引用 (非硬编码，安全)

以下文件使用了 `${VAR}` 格式的环境变量引用，**不是**硬编码密钥：

| 文件 | 行号 | 内容 |
|------|------|------|
| `docker-compose.yml` | 41 | `JWT_SECRET_KEY: ${JWT_SECRET_KEY:?JWT_SECRET_KEY is required}` |
| `docker-compose.yml` | 53 | `OPENAI_COMPATIBLE_API_KEY: ${OPENAI_COMPATIBLE_API_KEY}` |
| `docker-compose.yml` | 55 | `IMAGE_OPENAI_COMPATIBLE_API_KEY: ${IMAGE_OPENAI_COMPATIBLE_API_KEY}` |
| `docker-compose.yml` | 57 | `TAVILY_API_KEY: ${TAVILY_API_KEY}` |
| `docker-compose.yml` | 99 | `JWT_SECRET_KEY: ${ZSCJ_JWT_SECRET_KEY:?ZSCJ_JWT_SECRET_KEY is required}` |
| `frontend/tests/e2e/opc.smoke.spec.ts` | 16 | `const PASSWORD = process.env.OPC_TEST_PASSWORD ?? ""` |
| `frontend/tests/e2e/opc.smoke.spec.ts` | 861 | ``password: `pw-${randomUUID()}` `` (随机生成) |
| `backend/app/services/model_router.py` | 328,356,367,423,444 | `api_key=settings.openai_compatible_api_key` (配置对象引用) |
| `backend/app/api/v1/endpoints/auth.py` | 58 | `token = _safe_issue_token(user)` (函数调用) |

### 2.4 GitHub Actions 密钥引用 (安全)

| 文件 | 行号 | 内容 |
|------|------|------|
| `.github/workflows/docker.yml` | 25 | `password: ${{ secrets.GITHUB_TOKEN }}` |
| `.github/workflows/docker.yml` | 48 | `password: ${{ secrets.GITHUB_TOKEN }}` |

**说明:** 使用 GitHub Actions Secrets 引用，是标准安全做法。

---

## 三、未被 Git 追踪但包含真实密钥的文件 (已正确 gitignore)

以下文件存在于磁盘上但**未被 git 追踪**，已被 `.gitignore` 正确排除：

### 3.1 `.env` 文件 (包含真实密钥，未被 git 追踪)

| 行号 | 变量 | 值 (部分掩码) | 类型 |
|------|------|---------------|------|
| 3 | `JWT_SECRET_KEY` | `5rdfLC**********************3Sz2` | 真实 JWT 密钥 (64 字符) |
| 28 | `TAVILY_API_KEY` | `tvly-dev-kPC3d-****************VTBSQ` | **真实 Tavily API Key** |
| 7 | `DEEPSEEK_API_KEY` | `"deepseek-secret"` | 占位符 |
| 20 | `OPENAI_COMPATIBLE_API_KEY` | `"draft-secret"` | 占位符 |
| 24 | `IMAGE_OPENAI_COMPATIBLE_API_KEY` | `"image-secret"` | 占位符 |

**状态:** `.env` 在 `.gitignore` 第 20 行被排除，`git ls-files --error-unmatch .env` 确认未被追踪。

### 3.2 Android Keystore 密码文件 (包含真实密码，未被 git 追踪)

| 文件 | 内容 |
|------|------|
| `android-shell/keystore/opc-mobile-formal-release.properties` | `OPC_RELEASE_STORE_PASSWORD=fz2eIW****************giYO` |
| 同上 | `OPC_RELEASE_KEY_PASSWORD=fz2eIW****************giYO` |

**状态:** `android-shell/keystore/` 在 `.gitignore` 第 43 行被排除，`git ls-files` 确认未被追踪。

---

## 四、代码卫生问题

### 4.1 `.next-broken-old/` 目录被 git 追踪

**问题:** `frontend/.next-broken-old/` 目录包含大量 Next.js 构建产物（webpack 打包文件、缓存等），被 git 追踪。`.gitignore` 中有 `.next/` 和 `.next-build/` 但**遗漏了 `.next-broken-old/`**。

**影响:** 不包含真实密钥（扫描中的 "Discord Token" 匹配为 webpack 代码中的变量名误报），但构建产物不应纳入版本控制，增加仓库体积。

**建议:** 在 `.gitignore` 中添加 `.next-broken-old/` 并执行 `git rm -r --cached frontend/.next-broken-old/`。

---

## 五、扫描覆盖范围

### 已扫描的模式
- OpenAI sk- 密钥 (20+ 字符)
- DeepSeek 密钥 (sk- + 32 位 hex)
- GitHub Token (ghp_, gho_, ghs_, ghu_)
- Tavily 密钥 (tvly-)
- Anthropic Claude 密钥 (sk-ant-)
- Google API Key (AIza)
- Slack Token (xox)
- JWT Token (eyJ...)
- AWS Access Key (AKIA)
- AWS Secret Access Key
- Stripe API Key
- Telegram Bot Token
- Twilio / SendGrid / Mailgun / Discord Token
- 硬编码 password / passwd / pwd
- 硬编码 secret / secret_key / jwt_secret / jwt_secret_key
- 硬编码 token / access_token / refresh_token
- 硬编码 api_key / apikey / api_secret
- 环境变量赋值 (ENV_VAR=value)
- 数据库连接字符串密码
- Bearer Token
- PEM 私钥
- Keystore 密码

### 已排除的文件
- `.env.example` / `.env.sample` / `.env.template` (占位符文件，安全)
- 二进制文件 (.png, .jpg, .apk, .jks, .exe, .dll 等)
- 超过 5MB 的大文件

### 占位符过滤
扫描自动过滤了包含以下关键词的值：replace-with, your_, example, placeholder, changeme, dummy, fake, test_key, sample, ${VAR}, <placeholder> 等。

---

## 六、结论

1. **Git 追踪文件中不存在真实的 API Key、密钥或 Token。** 项目正确地将真实密钥存放在 `.env` 文件中并通过 `.gitignore` 排除。
2. **唯一的低风险项**是测试文件中的 `"test-compatible-key"` 测试夹具和 `alembic.ini` 中的默认 PostgreSQL 开发凭据 `postgres:postgres`。
3. **`.env` 文件和 keystore 密码文件**虽包含真实密钥，但未被 git 追踪，`.gitignore` 配置正确。
4. **代码卫生问题:** `.next-broken-old/` 构建产物目录被意外追踪，建议清理。
