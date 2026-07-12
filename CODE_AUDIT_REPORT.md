# OMPC-SSB Backend 代码审计报告

**审计范围**: `C:\TRAE\OMPC-SSB\backend\app\` 目录下所有 Python 文件
**审计日期**: 2026-07-12
**审计人**: 代码审计专家 Agent

---

## 一、审计概述

本次审计覆盖了 `app/` 目录下的全部 Python 文件，包括：
- API 端点层 (auth, content, images, workspace, deps, router)
- Core 层 (config, domain, security, task_states)
- DB 层 (base, session)
- Models 层 (全部 ORM 模型)
- Services 层 (全部业务服务)
- Schemas 层 (全部 Pydantic 模型)
- Domains 层 (领域配置)

**总体评价**: 代码库整体质量较高，安全实践良好。SQL 查询全部使用 SQLAlchemy ORM 或参数化查询，无 SQL 注入风险。认证和数据隔离逻辑完整，三账号 (admin/admin1/admin2 对应 user_id 1/2/3) 隔离机制正确。以下是发现的全部问题，按严重程度排列。

---

## 二、中等严重度问题 (MEDIUM)

### M1. SSRF 防护可被 IPv4-mapped IPv6 地址绕过

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\image_service.py`
- **行号**: 第 220-229 行 (`_resolve_safe_remote_ip` 函数)
- **类别**: 认证绕过 / 安全防护绕过
- **问题描述**:

  `_resolve_safe_remote_ip` 函数使用 `ipaddress` 模块检查远程 IP 是否为私有/回环/保留地址。然而，IPv4-mapped IPv6 地址（如 `::ffff:127.0.0.1` 或 `::ffff:10.0.0.1`）在 Python 的 `ipaddress` 模块中不会被识别为私有或回环地址：

  ```python
  >>> ipaddress.ip_address("::ffff:127.0.0.1").is_loopback
  False  # 应该是 True
  >>> ipaddress.ip_address("::ffff:10.0.0.1").is_private
  False  # 应该是 True
  ```

  攻击者可通过构造形如 `http://[::ffff:127.0.0.1]:port/path` 的 URL 绕过 SSRF 防护，访问内网服务。

- **严重程度**: 中 (MEDIUM)
- **建议修复方案**:

  在 IP 检查前，将 IPv4-mapped IPv6 地址转换为 IPv4 地址：

  ```python
  ip_obj = ipaddress.ip_address(resolved_ip)
  # 处理 IPv4-mapped IPv6 地址
  if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
      ip_obj = ip_obj.ipv4_mapped
  if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved or ip_obj.is_link_local:
      raise ValueError(...)
  ```

---

### M2. 密码哈希使用硬编码固定盐值

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\core\security.py`
- **行号**: 第 17-18 行
- **类别**: 安全 / 数据安全
- **问题描述**:

  ```python
  _SALT = b"opc_salt_v1"

  def hash_password(password: str) -> str:
      dk = hashlib.pbkdf2_hmac("sha256", password.encode(), _SALT, 100_000)
      return dk.hex()
  ```

  使用固定盐值意味着：
  1. 两个相同密码的用户会产生相同的哈希值，容易被彩虹表攻击
  2. 无法抵御预计算攻击

- **严重程度**: 中 (MEDIUM)
- **建议修复方案**:

  使用 `secrets.token_hex(16)` 为每个用户生成随机盐值，或将盐值与密码一起存储。建议使用 `bcrypt` 或 `argon2` 等专业密码哈希库替代手写实现。**注意**: 此修改需同步处理已有用户密码的迁移，且不能破坏现有认证逻辑。

---

### M3. `transition_task` 内部调用 `db.commit()` 可能提前提交外层事务

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\core\task_states.py`
- **行号**: 第 174-178 行
- **类别**: 数据一致性 / 事务安全
- **问题描述**:

  `transition_task` 函数内部调用了 `db.commit()`：

  ```python
  def transition_task(db, content_id, target_state, *, user_id):
      content = db.get(Content, content_id, with_for_update=True)
      # ... 状态检查 ...
      content.task_state = target_state.value
      content.task_state_updated_at = datetime.now(timezone.utc)
      try:
          db.commit()  # <-- 提交外层事务
      except Exception:
          db.rollback()
          raise
      ...
  ```

  在 SQLAlchemy 2.0 中，`Session.commit()` 始终提交最外层事务，而非仅释放 SAVEPOINT。调用方（`review_service.py` 第 99-103 行、`workspace.py` 第 218-220 行）使用 `with db.begin_nested():` 包裹 `transition_task`，并在注释中声称 savepoint 会保证原子性。但实际上 `transition_task` 内部的 `db.commit()` 会直接提交外层事务，包括调用方在 savepoint 之前添加的未提交变更（如审核记录、发布记录等）。

  **实际影响评估**: 在当前代码中，`transition_task` 成功后调用方只有 `db.commit()`（此时是空操作）和 `db.refresh()`，因此实践中不会出现数据不一致。但如果未来有人在 `transition_task` 返回后、外层 `db.commit()` 之前添加可能失败的逻辑，就会产生部分提交问题。

- **严重程度**: 中 (MEDIUM) -- 当前不影响功能，但构成技术债务
- **建议修复方案**:

  方案一（推荐）：将 `transition_task` 改为不内部 `commit`，由调用方统一提交：

  ```python
  def transition_task(db, content_id, target_state, *, user_id, auto_commit=True):
      content = db.get(Content, content_id, with_for_update=True)
      # ... 状态检查和更新 ...
      content.task_state = target_state.value
      content.task_state_updated_at = datetime.now(timezone.utc)
      if auto_commit:
          try:
              db.commit()
          except Exception:
              db.rollback()
              raise
      return content
  ```

  调用方使用 `auto_commit=False` 并由外层统一提交。

  方案二：在 `transition_task` 中使用 `db.flush()` 替代 `db.commit()`，让调用方控制提交时机。

---

## 三、低严重度问题 (LOW)

### L1. `delete_trend_asset` 未清理本地封面图片文件

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\trend_service.py`
- **行号**: 第 392-409 行
- **类别**: 资源泄漏
- **问题描述**:

  删除趋势素材时，仅删除了数据库记录，未清理可能已本地化的封面图片文件 (`cover_url`)。对比 `content_service.py` 的 `delete_content_with_assets` 函数，后者会调用 `_cleanup_local_image_file` 清理本地文件。长期运行会导致磁盘空间泄漏。

- **严重程度**: 低 (LOW)
- **建议修复方案**:

  在删除记录前检查 `cover_url`，如果指向本地文件则调用 `_cleanup_local_image_file` 清理。

---

### L2. `create_publish_record` 存在冗余状态检查

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\api\v1\endpoints\workspace.py`
- **行号**: 第 188-202 行
- **类别**: 逻辑错误 / 死代码
- **问题描述**:

  ```python
  if content.task_state != TaskState.READY_TO_PUBLISH.value:
      raise HTTPException(...)

  current_state = content.task_state or TaskState.NEW.value
  if not can_transition(current_state, TaskState.PUBLISHED):
      raise HTTPException(...)
  ```

  第一个检查已确保 `content.task_state == "ready_to_publish"`，因此第二个检查 `can_transition("ready_to_publish", "published")` 必然返回 `True`（根据 `task_states.py` 中的状态转换图）。第二个检查是死代码，永远不会触发异常。

- **严重程度**: 低 (LOW)
- **建议修复方案**:

  移除冗余的第二个状态检查，或将两个检查合并为一个更清晰的验证逻辑。

---

### L3. `humanizer.py` 多个函数缺少类型注解

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\humanizer.py`
- **行号**: 第 122, 143, 155, 170, 188, 205, 220, 240, 260, 277, 303 行
- **类别**: 类型安全
- **问题描述**:

  以下函数缺少参数和返回值类型注解：
  - `_protect_fragments(text, frags)` -- 应为 `(str, list[str]) -> str`
  - `_restore_fragments(text, mapping)` -- 应为 `(str, dict[str, str]) -> str`
  - `_replace_ai_phrases(text)` -- 应为 `(str) -> str`
  - `_vary_sentence_endings(text)` -- 应为 `(str) -> str`
  - `_add_discourse_markers(text)` -- 应为 `(str) -> str`
  - `_split_into_sentences(text)` -- 应为 `(str) -> list[str]`
  - `_add_pauses(text)` -- 应为 `(str) -> str`
  - `_simplify_sentences(text)` -- 应为 `(str) -> str`
  - `humanize_text(text, intensity)` -- 应为 `(str, str) -> str`
  - `humanize_score(text)` -- 应为 `(str) -> int`

- **严重程度**: 低 (LOW)
- **建议修复方案**: 逐步添加类型注解，不影响现有功能。

---

### L4. `dashboard` 端点硬编码用户数为 1

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\api\v1\endpoints\workspace.py`
- **行号**: 第 54 行
- **类别**: 逻辑错误
- **问题描述**:

  ```python
  counts["users"] = 1
  ```

  仪表盘始终返回 `users: 1`，无论实际有多少用户。如果系统中有多个用户（admin/admin1/admin2），此数据不准确。

- **严重程度**: 低 (LOW)
- **建议修复方案**:

  使用 `db.scalar(select(func.count(User.id)))` 查询实际用户数。或如果设计意图是只显示当前用户的数据，则应将字段名改为 `current_user` 以避免混淆。

---

### L5. `_write_env_keys` 文件锁仅限单进程

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\workspace_service.py`
- **行号**: 第 250-271 行
- **类别**: 数据一致性 / 竞态条件
- **问题描述**:

  `_env_write_lock` 是 `threading.RLock`，只能保护同一进程内的并发访问。如果使用多个 uvicorn worker（多进程部署），不同进程可能同时读写 `.env` 文件，导致：
  1. API Key 丢失（读写覆盖）
  2. `.env` 文件损坏（虽然 `os.replace` 提供原子写入，但读取旧内容+写入新内容的窗口期仍可能产生数据丢失）

  同时，多进程下每个进程有自己的 `settings` 单例（通过 `@lru_cache`），一个进程更新了 API Key，其他进程的内存中仍是旧值。

- **严重程度**: 低 (LOW) -- 单进程部署下无问题
- **建议修复方案**:

  1. 如果需要多进程部署，使用文件锁（如 `fcntl.flock` 或 `portalocker`）
  2. 或者将 API Key 存储在数据库而非 `.env` 文件中
  3. 或者在文档中明确说明仅支持单进程部署

---

### L6. `file://` URL scheme 未被阻断

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\image_service.py`
- **行号**: 第 181-182 行 (`_is_remote_url` 函数)
- **类别**: 安全
- **问题描述**:

  ```python
  def _is_remote_url(url: str) -> bool:
      return bool(url) and urlparse(url).scheme in {"http", "https"}
  ```

  `_is_remote_url` 仅识别 `http` 和 `https` 为远程 URL。如果图片生成服务返回 `file:///etc/passwd` 或其他非 http(s) scheme 的 URL，它会被视为"本地 URL"并直接使用，可能导致敏感信息泄露。

- **严重程度**: 低 (LOW) -- 图片生成服务是可信的
- **建议修复方案**:

  在 `localize_image_url` 中增加对 URL scheme 的白名单校验，拒绝非 `http/https` 且非本地静态路径的 URL。

---

### L7. `delete_content_with_assets` 未清理 `GenerationLog` 记录

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\content_service.py`
- **行号**: 第 399-422 行
- **类别**: 数据一致性
- **问题描述**:

  删除内容时会清理 `GeneratedImage`、`ContentReview`、`ContentVariant`、`PublishRecord`，但未清理 `GenerationLog` 记录。虽然 `GenerationLog` 没有 `content_id` 外键（只有 `user_id`），无法按内容删除，但这些孤儿日志记录会累积，影响统计准确性。

- **严重程度**: 低 (LOW)
- **建议修复方案**:

  在 `GenerationLog` 模型中添加可选的 `content_id` 外键，或者在 `Content` 模型中添加级联删除关系。如果不修改模型，可在删除内容时记录日志以便后续清理。

---

### L8. `AI_PHRASE_REPLACEMENTS` 列表缩进不一致

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\humanizer.py`
- **行号**: 第 66 行、第 75 行
- **类别**: 代码质量
- **问题描述**:

  ```python
  AI_PHRASE_REPLACEMENTS = [
      ("进行", ["做", "开始"]),
      ("专业", ["靠谱", "内行", "懂行"]),  # 此行及上一行有额外缩进
      ...
  ]
  ```

  部分元素有额外的缩进，虽然 Python 会忽略缩进差异（在同一括号内），但影响代码可读性。

- **严重程度**: 低 (LOW) -- 纯代码风格问题
- **建议修复方案**: 统一缩进格式。

---

## 四、信息级别 (INFO) -- 设计说明，非 Bug

### I1. `source-preview` 端点不按 user_id 过滤知识库

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\api\v1\endpoints\content.py`
- **行号**: 第 99-110 行
- **说明**: 端点要求认证但不按 user_id 过滤知识库内容。代码注释明确说明这是设计意图（ZSCJ 共享知识库）。**此行为正确，无需修改。**

### I2. 移动端测试账号使用账号名作为密码

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\auth_service.py`
- **行号**: 第 89-103 行
- **说明**: 仅在 desktop 或 self_hosted profile 下允许 admin/admin1/admin2 使用账号名作为密码。生产环境会拒绝此行为。**此为设计意图，无需修改。**

### I3. `get_image` 使用 `hasattr` 检查 `created_by`

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\api\v1\endpoints\images.py`
- **行号**: 第 71 行
- **说明**: `GeneratedImage` 模型已定义 `created_by` 字段，`hasattr` 检查始终返回 `True`，属于冗余代码但不影响功能。

### I4. SQLite 下 `with_for_update` 被静默忽略

- **文件**: 多个服务文件 (`task_states.py`, `review_service.py`, `variant_service.py`, `workspace.py`)
- **说明**: SQLite 不支持行级锁，`with_for_update` 被静默忽略。代码注释中已记录此限制。在 SQLite 部署下存在理论上的竞态条件风险，但对于单用户/低并发场景可接受。

### I5. `humanizer.py` 占位符格式

- **文件**: `C:\TRAE\OMPC-SSB\backend\app\services\humanizer.py`
- **行号**: 第 122-141 行
- **说明**: 当前使用 `\x00frag{letters}\x00` 格式的占位符，已修复碰撞 bug。**不应改回旧的 `\x00P{idx}\x00` 格式。**

---

## 五、按审计维度汇总

### 1. 异常处理缺失

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| M3 | task_states.py | 174-178 | `transition_task` 内部 commit 可能导致部分提交 | 中 |
| - | content_service.py | 113-144 | 异常处理完整，fallback 逻辑正确 | 无问题 |
| - | trend_browser_collector.py | 283-362 | 异常处理完整，区分超时/通用错误 | 无问题 |
| - | image_service.py | 710-761 | 文件清理逻辑完整 | 无问题 |

**评价**: 异常处理整体完善。`trend_browser_collector.py` 中的 Playwright 异常处理尤为细致，区分了超时、通用错误和模块缺失三种情况。所有 `except` 块都指定了具体异常类型，无裸 `except`。

### 2. 类型安全

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| L3 | humanizer.py | 多处 | 多个函数缺少类型注解 | 低 |
| - | 其他文件 | - | API 端点、服务层函数均有完整类型注解 | 无问题 |

**评价**: 除 `humanizer.py` 外，全项目类型注解覆盖率高。Pydantic schema 和 SQLAlchemy 模型均正确定义了类型。

### 3. SQL 注入风险

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| - | session.py | 34-50 | `_validate_identifier` 白名单防护完善 | 无问题 |
| - | knowledge_service.py | 458-460 | `_escape_ilike` 正确转义 ilike 特殊字符 | 无问题 |
| - | trend_service.py | 433 | 同样使用 `_escape_ilif` | 无问题 |
| - | 所有查询 | - | 全部使用 SQLAlchemy ORM 或参数化查询 | 无问题 |

**评价**: **无 SQL 注入风险。** 所有数据库查询均通过 SQLAlchemy ORM 或 `select()` 构造器，动态列名通过 `_validate_identifier` 白名单校验，ilike 查询通过 `_escape_ilike` 转义。

### 4. 数据一致性

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| M3 | task_states.py | 174-178 | `transition_task` 内部 commit 影响事务原子性 | 中 |
| L5 | workspace_service.py | 250-271 | 多进程下 `.env` 文件写入竞态 | 低 |
| L7 | content_service.py | 399-422 | 删除内容未清理 GenerationLog | 低 |
| I4 | 多处 | - | SQLite 下 `with_for_update` 被忽略 | 信息 |

**评价**: 数据一致性整体良好。`review_service.py` 和 `workspace.py` 中的发布/审核流程使用 `with_for_update` 悲观锁和 `begin_nested` savepoint，事务设计意图正确。主要风险在 `transition_task` 的内部 commit 行为。

### 5. 未捕获异常

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| - | content_source_context.py | 80-110 | ZSCJ API 调用有超时和大小限制 | 无问题 |
| - | web_search_service.py | 230-280 | Tavily API 调用有完整异常处理 | 无问题 |
| - | model_router.py | 多处 | 所有外部 API 调用均有 try-except | 无问题 |

**评价**: **未发现可能抛出但未被处理的异常。** 所有外部 API 调用（OpenAI、ZSCJ、Tavily）均有超时设置和异常捕获。`content_service.py` 中 `humanize_text` 的异常被捕获并回退到原始草稿，是良好的防御性编程。

### 6. 认证绕过

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| M1 | image_service.py | 220-229 | SSRF 防护可被 IPv4-mapped IPv6 绕过 | 中 |
| L6 | image_service.py | 181-182 | `file://` URL scheme 未阻断 | 低 |
| I1 | content.py | 99-110 | source-preview 不按 user_id 过滤（设计意图） | 信息 |
| - | 所有端点 | - | 均正确使用 `get_current_user` 依赖 | 无问题 |
| - | content.py | 70-78 | 正确检查 `content.user_id != current_user.id` | 无问题 |
| - | images.py | 55-65 | 通过 content ownership 或 created_by 过滤 | 无问题 |
| - | workspace.py | 多处 | 均使用 `current_user.id` 过滤 | 无问题 |
| - | review_service.py | 85 | 正确检查 content ownership | 无问题 |
| - | auth_service.py | 43-48 | 自注册强制 role="promoter"，防角色提升 | 无问题 |

**评价**: 认证和数据隔离逻辑**整体正确**。三账号隔离机制完整，所有数据查询均按 `user_id` 过滤。`require_writer_role` 正确限制敏感操作（更新 API Key、切换领域）。主要风险在图片服务的 SSRF 防护。

### 7. 导入错误

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| - | 全部文件 | - | 所有导入均有效，无导入不存在的模块或函数 | 无问题 |

**评价**: **无导入错误。** 延迟导入（如 `trend_browser_collector.py` 中的 `playwright` 导入、`content_service.py` 中的 `image_service` 导入）均正确处理了 `ModuleNotFoundError`。

### 8. 逻辑错误

| 编号 | 文件 | 行号 | 问题 | 严重程度 |
|------|------|------|------|----------|
| L2 | workspace.py | 188-202 | 冗余状态检查（死代码） | 低 |
| L4 | workspace.py | 54 | 硬编码 `users: 1` | 低 |
| L8 | humanizer.py | 66, 75 | 列表缩进不一致 | 低 |
| - | task_states.py | - | 状态转换图完整且正确 | 无问题 |
| - | variant_scorer.py | - | 评分逻辑正确 | 无问题 |
| - | humanizer.py | 122-141 | 占位符格式正确（已修复碰撞 bug） | 无问题 |

**评价**: 逻辑错误较少。状态机 (`task_states.py`) 设计合理，转换规则通过 `can_transition` 函数严格校验。变体评分逻辑 (`variant_scorer.py`) 权重计算正确。

---

## 六、安全防护亮点

审计过程中发现以下安全实践值得肯定：

1. **SQL 注入防护**: 全项目使用 SQLAlchemy ORM，动态标识符有白名单校验，ilike 查询有转义处理
2. **SSRF 防护**: `image_service.py` 中 `_resolve_safe_remote_ip` 检查了私有/回环/保留/链路本地地址（除 IPv4-mapped IPv6 绕过外）
3. **认证隔离**: 所有 API 端点正确使用 `get_current_user` 依赖，数据查询按 `user_id` 过滤
4. **角色控制**: `require_writer_role` 正确限制敏感操作
5. **密码安全**: 使用 PBKDF2-HMAC-SHA256，生产环境拒绝弱密码
6. **JWT 安全**: Token 有过期时间，`decode_access_token` 正确处理过期/无效 token
7. **API 响应大小限制**: `content_source_context.py` 和 `web_search_service.py` 均有响应大小限制和超时设置
8. **文件清理**: `image_service.py` 在失败时正确清理本地文件
9. **输入校验**: Pydantic schema 使用 `Field(pattern=...)`, `Field(ge=..., le=...)` 等约束

---

## 七、修复优先级建议

| 优先级 | 编号 | 问题 | 建议时间 |
|--------|------|------|----------|
| P1 | M1 | SSRF 防护 IPv4-mapped IPv6 绕过 | 尽快 |
| P2 | M3 | `transition_task` 内部 commit 事务问题 | 近期 |
| P2 | M2 | 密码哈希固定盐值 | 近期（需配合密码迁移） |
| P3 | L1-L8 | 低严重度问题 | 逐步处理 |

---

## 八、结论

本次审计共发现 **3 个中等严重度问题** 和 **8 个低严重度问题**，无高严重度问题。代码库整体安全实践良好，SQL 注入防护完善，认证和数据隔离逻辑正确，异常处理覆盖率高。主要改进方向为 SSRF 防护补全、事务管理优化和密码哈希升级。

**重要约束确认**:
- AUTH_REQUIRED=true 认证逻辑未被破坏
- humanizer.py 占位符格式未被改回旧的 `\x00P{idx}\x00` 格式
- 未修改任何文件，仅做检查和报告
