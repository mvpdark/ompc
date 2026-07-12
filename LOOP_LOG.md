# OMPC 全项目 Bug 检查与修复日志

**执行时间**: 2026-07-12
**检查范围**: OMPC-SSB（后端+前端）、OMPC（启动脚本+配置）、OMPC-ZSCJ（采集后端）

---

## 一、已修复的 Bug（7 个）

### 1. [中] OMPC-ZSCJ CORS regex 缺少 60003 端口
- **文件**: `OMPC-ZSCJ/backend/app/core/config.py` 第65行
- **问题**: `cors_origin_regex` 允许的端口列表 `60000|60001|60002|3000` 缺少 60003（缓存破坏代理端口），通过代理访问的前端无法调用 ZSCJ API
- **修复**: 添加 60003 到端口列表

### 2. [中] OMPC-ZSCJ 时区处理错误
- **文件**: `OMPC-ZSCJ/backend/app/api/v1/endpoints/trends.py` 第154-156行
- **问题**: 小红书/抖音发布时间为北京时间(UTC+8)，但代码标记为 `timezone.utc`，导致时间偏差8小时
- **修复**: 改为 `timezone(timedelta(hours=8))`，并添加 `timedelta` 导入

### 3. [中] OMPC-ZSCJ admissions.py db.refresh(log) 异常处理失效
- **文件**: `OMPC-ZSCJ/backend/app/api/v1/endpoints/admissions.py` 第338-346行
- **问题**: `db.refresh(log)` 不在 try 块内，refresh 失败时 `log_id` 从未赋值，后续 except 块引用 `log_id` 触发 NameError
- **修复**: 初始化 `log_id = None`，将 `db.refresh(log)` 和 `log_id = log.id` 移入 try 块

### 4. [中] OMPC-ZSCJ admissions.py except 块中 log/source 重查互相影响
- **文件**: `OMPC-ZSCJ/backend/app/api/v1/endpoints/admissions.py` 第496-507行
- **问题**: log 和 source 重查在同一个 try/except 中，一个失败导致两者都设为 None，错误状态丢失
- **修复**: 拆分为两个独立的 try/except 块

### 5. [中] OMPC-ZSCJ vector_search 浪费 embedding API 调用
- **文件**: `OMPC-ZSCJ/backend/app/services/knowledge_search.py` 第131-134行
- **问题**: pgvector 未安装时先调用 embedding API 再尝试向量计算，API 调用结果被丢弃
- **修复**: 在调用 embedding API 前检查 `cosine_distance` 方法是否存在，不存在则直接降级到关键词搜索

### 6. [中] OMPC-SSB 前端 workspace-login.tsx catch 块未检查 activeRef
- **文件**: `OMPC-SSB/frontend/components/workspace-login.tsx` 第63-64行
- **问题**: 组件卸载后 catch 块仍调用 `setError`，AbortError 导致已卸载组件状态更新
- **修复**: catch 块开头添加 `if (!activeRef.current) return;`（字节级替换，保持 LF 行尾）

### 7. [低] OMPC-SSB 后端 knowledge_service.py 死代码
- **文件**: `OMPC-SSB/backend/app/services/knowledge_service.py` 第290-336行
- **问题**: `compile_knowledge_base` 函数提前 return 后有 1660 字节不可达代码（含 db.commit/db.refresh），IDE 已标记 unreachable
- **修复**: 删除不可达代码，保留函数签名和安全返回逻辑

---

## 二、发现但未修复的问题（需评估）

### 高优先级

| # | 项目 | 问题 | 原因 |
|---|------|------|------|
| 1 | OMPC | `cache-bust-proxy.js` 文件缺失 | 禁止修改的核心文件，需从版本控制恢复 |
| 2 | OMPC | `cf-config.yml` 文件缺失 | 禁止修改的 cloudflared 配置，需从版本控制恢复 |
| 3 | OMPC-ZSCJ | Dockerfile 未安装 Playwright 浏览器二进制 | Docker 部署中趋势采集功能不可用，需取消注释 Dockerfile 第11行 |
| 4 | OMPC | 缺少 .env 文件 | 直接用 .env.example 创建会因 JWT 弱密钥检查拒绝启动 |

### 中优先级

| # | 项目 | 问题 | 建议 |
|---|------|------|------|
| 5 | OMPC | .env.example 中 3 个变量被注释（IMAGE_SIZE、IMAGE_RESPONSE_FORMAT、IMAGE_OPENAI_COMPATIBLE_BASE_URL） | 取消注释与 OMPC-SSB 保持一致 |
| 6 | OMPC-SSB | draft_generation.md 未列出 `platform` 字段 | 代码传入但 prompt 未说明，可能导致模型不知道平台信息 |
| 7 | OMPC-SSB | humanization.md 未列出 `platform` 字段 | 非小红书平台可能错误应用小红书语气词规则 |
| 8 | OMPC-SSB | web_search_service.py Tavily 响应无大小限制 | 低概率内存耗尽风险 |
| 9 | OMPC-ZSCJ | 同步 Playwright 在 BackgroundTasks 线程池长时间阻塞 | 多采集任务并发时占用线程池资源 |

### 低优先级

| # | 项目 | 问题 |
|---|------|------|
| 10 | OMPC-SSB 前端 | 多个 DELETE/POST 请求缺少 AbortController（workspace-content.tsx、mobile-collect-screen.tsx、use-draft-history.ts） |
| 11 | OMPC-SSB 前端 | trend-collector-panel.tsx useEffect 依赖数组缺少 showCollectionJob（当前 useCallback 稳定引用，无实际影响） |
| 12 | OMPC-SSB 后端 | auth.py register/login 端点无 try-except（全局处理器兜底） |
| 13 | OMPC-SSB 后端 | content_source_context.py / content_prompt_builder.py 的 db 参数未使用 |
| 14 | OMPC-ZSCJ | codex_test_drafts.json 含 6 个冗余模板分支（永远不会被选中） |
| 15 | OMPC-ZSCJ | OMPC-ZSCJ .env.example 未包含 TEST_STATIC_URL_PREFIX 和 CORS_ORIGIN_REGEX |

---

## 三、检查通过项

### 认证与数据隔离（全部通过）
- 36 个 API 端点全部正确使用认证依赖（`get_current_user` / `require_writer_role`）
- 所有数据操作正确过滤 `user_id`，三账号数据隔离完整
- 纵深防御：delete 操作在 SQL 层附加 `user_id` 条件
- SSRF 防护：`_download_remote_image` 使用 IP 验证 + pinned connection

### SQL 注入防护（全部通过）
- 所有查询使用 SQLAlchemy ORM 参数化查询
- `text()` 调用受 `_validate_identifier()` 正则验证保护
- `ilike` 查询使用 `_escape_ilike()` 转义特殊字符

### 前端内存管理（基本通过）
- 所有 `setInterval`/`setTimeout`/`addEventListener` 均有清理逻辑
- 无 `any` 类型滥用
- 所有 `response.json()` 调用均有类型守卫验证

### .env 一致性（基本通过）
- OMPC-SSB backend: .env 与 .env.example 44 个变量完全一致
- OMPC-SSB frontend: .env.local 与 .env.example 4 个变量完全一致
- OMPC-ZSCJ backend: .env 与 .env.example 40 个变量完全一致

### prompts/ 目录（全部通过）
- 7 个 prompt 文件全部存在且被代码引用
- 无代码引用不存在的 prompt 文件
- variant_generation.md 字段与代码 payload 完全一致

---

## 四、验证结果

| 修复项 | 验证方式 | 结果 |
|--------|----------|------|
| CORS regex | `from app.core.config import settings` | OK |
| 时区处理 | `from app.api.v1.endpoints.trends import router` | OK |
| 异常处理 | `from app.api.v1.endpoints.admissions import router` | OK |
| vector_search | `from app.services.knowledge_search import search_knowledge_items` | OK |
| workspace-login.tsx | 字节级替换后文件可正常读取 | OK |
| knowledge_service.py | `from app.services.knowledge_service import compile_knowledge_base` | OK |

---

## 五、检查模块清单

### OMPC-SSB 后端（~50 个 Python 文件）
- `api/deps.py`, `api/v1/router.py`
- `api/v1/endpoints/auth.py`, `content.py`, `images.py`, `workspace.py`
- `core/config.py`, `security.py`, `task_states.py`, `domain.py`
- `db/base.py`, `session.py`
- `models/` 8 个模型文件
- `schemas/` 9 个 schema 文件
- `services/` 18 个服务文件

### OMPC-SSB 前端（~101 个 TSX/TS 文件）
- `components/` 68 个组件文件（workspace-*, mobile-*, trend-* 等）
- `lib/` 33 个工具/Hook 文件

### OMPC（4 个关键文件）
- `start_ompc.py`, `START_OMPC.bat`
- 配置文件检查

### OMPC-ZSCJ 后端（~20 个 Python 文件）
- `api/v1/endpoints/admissions.py`, `trends.py`, `knowledge.py`
- `core/config.py`
- `services/knowledge_search.py`, `trend_browser_collector.py`
- `db/session.py`
- `Dockerfile`
