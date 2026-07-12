# 前端代码审计报告

**审计范围**: `C:\TRAE\OMPC-SSB\frontend\components\` 和 `C:\TRAE\OMPC-SSB\frontend\lib\` 目录下的所有 TSX/TS 文件

**审计日期**: 2026-07-12

**审计文件数**: 约 45 个源文件（lib/ 约 15 个，components/ 约 30 个）

---

## 审计总结

| 严重程度 | 问题数量 |
|---------|---------|
| 高      | 5       |
| 中      | 11      |
| 低      | 9       |
| **合计** | **25**  |

### 整体评价

代码质量整体较好，主要优点：
- 全部源代码中 **未发现 `any` 类型滥用** 和 **`as any` 断言**
- **未发现 `dangerouslySetInnerHTML` 使用**，XSS 防护良好
- 大多数组件采用了 `activeRef` 模式防止卸载后状态更新
- 定时器和事件监听器清理较为规范
- API 基础 URL 通过 `getApiBase()` / `getZscjApiBase()` 动态配置，未发现生产环境硬编码 URL

主要风险集中在 **fetch 请求缺乏 AbortController**（30+ 处），以及部分组件缺少卸载后状态更新防护。

---

## 一、useState/useCallback 依赖数组

### 问题 1.1 [低] - workspace-knowledge.tsx 函数未包装 useCallback

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-knowledge.tsx`
- **行号**: 44-95
- **描述**: `loadKnowledge`（第44行）和 `loadNotices`（第74行）是普通函数（非 useCallback），在 `useEffect`（第88行，依赖数组 `[]`）中被调用。每次渲染都会重新创建这两个函数，但 useEffect 只在挂载时运行，因此不会导致 bug。但这违反了 `react-hooks/exhaustive-deps` 规则。
- **严重程度**: 低
- **建议修复**: 将 `loadKnowledge` 和 `loadNotices` 移入 useEffect 内部定义，或用 useCallback 包装并添加到依赖数组。

### 问题 1.2 [低] - workspace-content.tsx useEffect 缺少 fetchLatestImage 依赖

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-content.tsx`
- **行号**: 256-353
- **描述**: `useEffect`（依赖数组 `[draftHistoryReloadKey, workspaceToken]`）内部调用了 `fetchLatestImage`（useCallback，依赖 `[workspaceToken]`），但未将 `fetchLatestImage` 列入依赖数组。由于 `fetchLatestImage` 仅依赖 `workspaceToken`，实际运行时不会产生 bug，但违反了 exhaustive-deps 规则。
- **严重程度**: 低
- **建议修复**: 将 `fetchLatestImage` 加入依赖数组，或添加 `// eslint-disable-next-line react-hooks/exhaustive-deps` 注释并说明原因。

### 问题 1.3 [低] - workspace-generation-launcher.tsx generateDraft 未 memo 化

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-generation-launcher.tsx`
- **行号**: 483-635, 674
- **描述**: `generateDraft` 是普通函数，每次渲染重新创建，但通过 `useRef` 存储（第674行 `generateDraftRef.current = generateDraft`）。这是为了避免 stale closure 的有意设计，但会造成每次渲染的额外开销。
- **严重程度**: 低（有意设计）
- **建议修复**: 无需修复，可添加注释说明设计意图。

### 问题 1.4 [低] - workspace-content.tsx loadReviewQueue useEffect 缺少依赖

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-content.tsx`
- **行号**: 355-390
- **描述**: `useEffect`（依赖数组 `[draftHistoryReloadKey, workspaceToken]`）中定义的 `loadReviewQueue` 函数引用了 `workspaceToken`，依赖数组正确。但同样未列出可能被引用的其他回调函数。经检查，此处的依赖数组是完整的。
- **严重程度**: 低（无实际问题）

---

## 二、内存泄漏

### 整体评价: 良好

所有 `setInterval` / `setTimeout` 调用均有对应的清理逻辑：

| 文件 | 行号 | 定时器类型 | 清理方式 |
|------|------|-----------|---------|
| mobile-collect-screen.tsx | 214-225 | setInterval | `clearInterval` in cleanup |
| mobile-create-screen.tsx | 429-434 | setInterval | `clearInterval` in cleanup |
| workspace-generation-launcher.tsx | 393-398 | setInterval | `clearInterval` in cleanup |
| use-progress-completion.ts | 31-40 | setInterval | `clearInterval` + `audioContext.close()` |
| use-collection-job-polling.ts | 113-157 | setTimeout (递归) | `clearTimeout` in cleanup |
| trend-collector-panel.tsx | 188-232 | setTimeout (递归) | `clearTimeout` + `cancelled` flag |
| use-cover-hydration.ts | 72-328 | setTimeout (重试) | `clearTimeout` in cleanup |
| workspace-client.tsx | 105-115 | addEventListener | `removeEventListener` in cleanup |
| workspace-draft-history-card.tsx | 45-49 | setTimeout | `clearTimeout` in cleanup |
| mobile-trend-source-review.tsx | 84-90 | setTimeout | `clearTimeout` in cleanup |
| mobile-draft-history.tsx | 167-171 | setTimeout (长按) | `clearTimeout` in cleanup |

### 问题 2.1 [低] - 无 WebSocket / EventSource 使用

- **描述**: 全代码库未使用 WebSocket 或 EventSource，无相关内存泄漏风险。

---

## 三、fetch 无 AbortController

### 严重发现: 30+ 处 fetch 调用缺乏 AbortController

仅有以下 2 个文件正确使用了 AbortController：
- `C:\TRAE\OMPC-SSB\frontend\components\mobile-create\use-generation-api.ts`（第121-247行）
- `C:\TRAE\OMPC-SSB\frontend\components\workspace-generation-launcher.tsx`（第429-601行）

以下文件的所有 fetch 调用均 **缺乏 AbortController**：

### 问题 3.1 [高] - lib/ 目录下的 API 函数无 AbortController

| 文件 | 行号 | API 端点 |
|------|------|---------|
| `lib/admission-api.ts` | 35 | `/admissions/notices` |
| `lib/knowledge-api.ts` | 37 | `/knowledge/search` 或 `/knowledge/list` |
| `lib/mobile-review-utils.ts` | 94, 118, 167 | `/image/list`, `/content/list`, `/content/{id}/reviews` |
| `lib/use-launcher-provider-status.ts` | 94 | `/workspace/provider-check` |

- **严重程度**: 高
- **描述**: 这些 API 工具函数不支持传入 AbortSignal 参数，调用方无法取消请求。组件卸载后请求仍会继续，虽然多数调用方使用 `activeRef` 防止了状态更新，但网络请求本身无法取消，浪费带宽和资源。
- **建议修复**: 为每个 API 函数添加可选的 `signal?: AbortSignal` 参数，并在 fetch 调用中传递 `signal`。示例：
  ```typescript
  export async function fetchAdmissionNotices(
    apiBase: string,
    options: { limit?: number },
    signal?: AbortSignal
  ): Promise<AdmissionNotice[]> {
    // ...
    const response = await fetch(url, { signal });
    // ...
  }
  ```

### 问题 3.2 [高] - mobile-collect-screen.tsx 7 处 fetch 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\mobile-collect-screen.tsx`
- **行号**: 269, 286, 311, 406, 473, 561, 617
- **涉及函数**: `fetchLatestCollectionJob`, `fetchCollectionJobStatus`, `loadTrendItems`, `runCollectionJob`, `parseLinks`, `deleteTrendSource`, `saveKnowledgeDigest`
- **严重程度**: 高
- **描述**: 7 个异步函数中的 fetch 调用均未使用 AbortController。虽然使用了 `activeRef.current` 检查防止卸载后状态更新，但请求本身无法取消。
- **建议修复**: 为每个 fetch 调用添加 AbortController，在组件卸载时调用 `controller.abort()`。

### 问题 3.3 [高] - trend-collector-panel.tsx 7 处 fetch 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\trend-collector-panel.tsx`
- **行号**: 104, 120, 157, 274, 323, 373, 437
- **涉及函数**: `loadSearchTarget`, `fetchCollectionJobRef`, `loadJobs`, `startCollectionJob`, `restartJob`, `parseLinks`, `saveKnowledgeDigest`
- **严重程度**: 高
- **建议修复**: 同上。

### 问题 3.4 [中] - workspace-content.tsx 4 处 fetch 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-content.tsx`
- **行号**: 112, 188, 282, 366
- **涉及函数**: `fetchLatestImage`（useCallback）, `handleSelectDraft`, `loadLatestContent`（useEffect 内部）, `loadReviewQueue`（useEffect 内部）
- **严重程度**: 中（useEffect 内部的调用有 `active` flag 保护，但 `fetchLatestImage` 作为 useCallback 可能在外部被调用时缺乏保护）
- **建议修复**: 为 `fetchLatestImage` 添加 signal 参数支持；useEffect 内部的 fetch 使用 AbortController 替代 `active` flag。

### 问题 3.5 [中] - workspace-settings.tsx 2 处 fetch 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-settings.tsx`
- **行号**: 279, 316
- **涉及函数**: `applyProviderKeys`, `runProviderCheck`
- **严重程度**: 中（有 `activeRef` 保护）
- **建议修复**: 添加 AbortController。

### 问题 3.6 [中] - public-preview-client.tsx 2 处 fetch 无 AbortController 且无 activeRef

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\public-preview-client.tsx`
- **行号**: 36, 54
- **描述**: `loadContent` 函数中的两个 fetch 调用既无 AbortController 也无 activeRef 检查。如果组件在请求完成前卸载，会尝试更新已卸载组件的状态。
- **严重程度**: 中
- **建议修复**: 添加 AbortController 和 active flag。

### 问题 3.7 [中] - 其他文件 fetch 无 AbortController

| 文件 | 行号 | 说明 |
|------|------|------|
| `workspace-dependency-doctor.tsx` | 39 | 有 activeRef 保护 |
| `workspace-utils.tsx` | 411, 424 | 工具函数，由调用方保护 |
| `mobile-login-screen.tsx` | 49 | 有 activeRef 保护 |
| `workspace-generation-export-card.tsx` | 201 | **无 activeRef 保护** |
| `use-cover-hydration.ts` | 78, 205 | 有 `active` flag 保护 |
| `use-draft-history.ts` | 200 | 有 activeRef 保护 |
| `mobile-create-screen.tsx` | 393 | 有 activeRef 保护 |

- **严重程度**: 中
- **建议修复**: 统一添加 AbortController 支持。

---

## 四、类型错误

### 整体评价: 优秀

- **未发现 `any` 类型使用**（搜索 `:\s*any\b` 和 `as any` 均无结果）
- **未发现 `as any` 断言**
- 类型守卫（type guards）使用规范，如 `isGeneratedContent`、`isGeneratedImageAsset`、`isAdmissionNotice` 等
- API 响应使用 `unknown` 类型接收后通过类型守卫过滤，如 `admission-api.ts` 第39-40行

### 问题 4.1 [低] - 无类型错误问题

无需修复。

---

## 五、异步状态更新（组件卸载后状态更新）

### 整体评价: 大部分组件采用了良好的防护模式

已使用 `activeRef` 模式的组件：
- `mobile-collect-screen.tsx`（第80行）
- `mobile-create-screen.tsx`（第96行）
- `mobile-knowledge-screen.tsx`（第37行）
- `mobile-login-screen.tsx`（第98行）
- `workspace-knowledge.tsx`（第36行）
- `workspace-content.tsx`（第94行，使用 `let active = true`）
- `workspace-settings.tsx`
- `workspace-dependency-doctor.tsx`
- `trend-collector-panel.tsx`（使用 `let cancelled = false`）
- `use-cover-hydration.ts`（使用 `let active = true`）
- `use-draft-history.ts`
- `use-launcher-provider-status.ts`（使用 `activeRef` + `providerStatusRequestIdRef` 双重保护）

已使用 `requestIdRef` 防止竞态条件：
- `mobile-collect-screen.tsx`（`requestIdRef`）
- `workspace-knowledge.tsx`（`requestIdRef` + `noticesRequestIdRef`）
- `workspace-content.tsx`（`contentRequestIdRef` + `reviewQueueRequestIdRef`）
- `mobile-knowledge-screen.tsx`（`requestIdRef` + `noticesRequestIdRef`）
- `use-launcher-provider-status.ts`（`providerStatusRequestIdRef`）

### 问题 5.1 [高] - public-preview-client.tsx 缺少卸载后状态更新防护

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\public-preview-client.tsx`
- **行号**: 30-70
- **描述**: `loadContent` 函数在 useEffect 中调用，使用了 `let active = true` 和 cleanup `active = false`（第48-50行），但 fetch 请求本身无 AbortController。虽然 `active` flag 防止了状态更新，但请求不会被取消。
- **严重程度**: 中（有 `active` flag 保护，降低了风险）
- **建议修复**: 添加 AbortController 以取消请求。

### 问题 5.2 [高] - workspace-generation-export-card.tsx 缺少 activeRef 检查

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-generation-export-card.tsx`
- **行号**: 201-230
- **描述**: `handleGenerateCover` 函数中的 fetch 调用（第201行）完成后直接更新状态（如 `setCoverUrl`、`setCoverBusy` 等），**无 activeRef 检查**。如果用户在封面生成过程中切换页面，组件卸载后仍会尝试更新状态。
- **严重程度**: 高
- **建议修复**: 添加 `activeRef` 模式或 AbortController。

### 问题 5.3 [中] - workspace-utils.tsx 工具函数无内置防护

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-utils.tsx`
- **行号**: 411-420 (`fetchProviderStatuses`), 424-440 (`authenticateWorkspaceLogin`)
- **描述**: 这些工具函数本身不含 activeRef 检查，依赖调用方进行防护。`fetchProviderStatuses` 被 `use-launcher-provider-status.ts` 调用时有 activeRef 保护。但 `authenticateWorkspaceLogin` 被 `workspace-login.tsx` 调用时需确认是否有防护。
- **严重程度**: 中
- **建议修复**: 确保所有调用方都有 activeRef 或 AbortController 防护。

---

## 六、错误处理

### 整体评价: 良好

- 大多数 fetch 调用有 try-catch 块
- `readApiError` 辅助函数被一致使用来提取错误信息
- `admission-api.ts` 和 `knowledge-api.ts` 对 `TypeError`（网络错误）有专门处理，返回空数组而非抛出异常
- `sanitizeServiceErrorMessage` 用于清理错误消息

### 问题 6.1 [中] - use-cover-hydration.ts 静默吞掉所有错误

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\mobile-create\use-cover-hydration.ts`
- **行号**: 94
- **描述**: `catch (_error) { return null; }` 完全静默地吞掉所有错误，不记录任何日志。在生产环境中排查问题时会很困难。
- **严重程度**: 中
- **建议修复**: 至少在开发模式下记录错误：
  ```typescript
  catch (error) {
    if (process.env.NODE_ENV === "development") console.warn("fetchLatestCover error:", error);
    return null;
  }
  ```

### 问题 6.2 [低] - workspace-content.tsx 生产环境静默错误

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-content.tsx`
- **行号**: 275, 332
- **描述**: `catch (err) { if (process.env.NODE_ENV === "development") console.debug(...); return null; }` 错误仅在开发模式下记录，生产环境完全静默。
- **严重程度**: 低
- **建议修复**: 考虑在生产环境也记录 warn 级别日志，或接入错误监控。

### 问题 6.3 [低] - workspace-content.tsx fetchLatestImage 无错误传播

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-content.tsx`
- **行号**: 109-127
- **描述**: `fetchLatestImage` 的 catch 块返回 `null`，不向调用方传播错误信息。调用方无法区分"无图片"和"请求失败"。
- **严重程度**: 低
- **建议修复**: 可接受的设计选择（图片加载失败时显示默认封面），但可考虑增加错误计数器用于监控。

### 问题 6.4 [中] - 多个组件错误状态未重置

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-generation-export-card.tsx`
- **行号**: 201-230
- **描述**: `handleGenerateCover` 的 catch 块中设置了 `setCoverError`，但 `finally` 块中未重置 `coverError`。下次成功生成时，旧的错误信息可能仍然显示。
- **严重程度**: 中
- **建议修复**: 在 try 块开始时或成功时清除 `coverError`。

---

## 七、XSS 风险

### 整体评价: 优秀

- **未发现 `dangerouslySetInnerHTML` 使用**（搜索结果仅在 `.next-broken-old` 构建产物中，非源代码）
- **用户输入通过 JSX 渲染**，React 自动转义
- `renderXhsExpressionText`（`lib/xhs-stickers.tsx`）返回 React 元素数组（非 HTML 字符串），安全
- `window.open` 调用使用了 `noopener,noreferrer` 参数（如 `mobile-collect-screen.tsx` 第242行）

### 问题 7.1 [低] - 无 XSS 风险

无需修复。

---

## 八、API 调用

### 整体评价: 良好

- API 基础 URL 通过 `getApiBase()` 和 `getZscjApiBase()` 动态配置
- 支持环境变量覆盖：`ZSCJ_API_BASE`、`NEXT_PUBLIC_ZSCJ_API_BASE`
- 客户端通过 `window.location.origin` 自动推导 API 地址
- 硬编码 URL 仅用于外部平台搜索链接（xiaohongshu.com, douyin.com 等），属于业务需求

### 问题 8.1 [中] - API_BASE 在模块加载时计算

- **文件**:
  - `C:\TRAE\OMPC-SSB\frontend\components\workspace-utils.tsx`（第84行 `export const API_BASE = getApiBase()`）
  - `C:\TRAE\OMPC-SSB\frontend\components\trend-collector-helpers.tsx`（第106行 `export const API_BASE = getApiBase()`）
  - `C:\TRAE\OMPC-SSB\frontend\components\mobile-login-screen.tsx`（第45行 `const API_BASE = getApiBase()`）
  - `C:\TRAE\OMPC-SSB\frontend\lib\mobile-review-utils.ts`（模块顶层 `const API_BASE = getApiBase()`）
- **描述**: `API_BASE` 在模块加载时计算一次。由于这些文件被 `"use client"` 组件引用，在 SSR 阶段 `typeof window === "undefined"` 为 true，会使用环境变量或默认值 `http://localhost:8000`。客户端水合时会使用 `window.location.origin` 推导。如果模块在服务端和客户端的求值结果不同，可能导致 API 地址不一致。但由于所有 fetch 调用都在 useEffect 或事件处理器中（仅客户端执行），实际不会产生 bug。
- **严重程度**: 中
- **建议修复**: 将 `API_BASE` 改为函数调用或 lazy getter，确保在客户端运行时动态求值：
  ```typescript
  // 替代 export const API_BASE = getApiBase();
  function getApiBaseForRequest() { return getApiBase(); }
  // 或使用 lazy initialization
  let _apiBase: string | null = null;
  function apiBase() { return _apiBase ??= getApiBase(); }
  ```

### 问题 8.2 [低] - localhost 默认回退地址

- **文件**: `C:\TRAE\OMPC-SSB\frontend\lib\api-base.ts`
- **描述**: `getApiBase()` 在没有环境变量且非浏览器环境时回退到 `http://localhost:8000`。这是合理的开发默认值，但如果生产环境未配置环境变量，会导致 API 请求失败。
- **严重程度**: 低
- **建议修复**: 在生产环境构建时检查环境变量是否已配置，未配置时发出警告。

### 问题 8.3 [低] - API 端点路径一致性

- **描述**: API 端点路径分散在多个文件中，如 `/content/list`、`/content/generate`、`/image/list`、`/image/generate` 等。没有统一的 API 路径常量定义，路径修改时需要逐文件搜索。
- **严重程度**: 低
- **建议修复**: 考虑创建统一的 API 端点常量文件，如 `lib/api-endpoints.ts`。

---

## 九、其他发现

### 问题 9.1 [中] - workspace-generation-launcher.tsx generateCoverForContent 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\workspace-generation-launcher.tsx`
- **行号**: 640-670
- **描述**: `generateCoverForContent` 函数虽然接受 `signal?: AbortSignal` 参数（第601行调用时传入了 `genController.signal`），但函数内部的 fetch 调用（第651行）**未传递 signal**：
  ```typescript
  const response = await fetch(`${API_BASE}/image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload)
    // 缺少: signal
  });
  ```
- **严重程度**: 中
- **建议修复**: 在 fetch 选项中添加 `signal`：
  ```typescript
  const response = await fetch(`${API_BASE}/image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
    signal  // 添加这行
  });
  ```

### 问题 9.2 [低] - use-generation-api.ts generateCoverForContent 同样未传递 signal

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\mobile-create\use-generation-api.ts`
- **行号**: 241
- **描述**: 与 9.1 相同的问题。`generateDraftAndCover` 中的图片生成 fetch 调用使用了 `genController.signal`（第206行的 content/generate 请求），但第241行的 `image/generate` 请求**未传递 signal**：
  ```typescript
  const imageResponse = await fetch(`${apiBase}/image/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(credentials) },
    body: JSON.stringify(imagePayload)
    // 缺少: signal: genController.signal
  });
  ```
- **严重程度**: 中
- **建议修复**: 添加 `signal: genController.signal` 到 fetch 选项。

### 问题 9.3 [低] - mobile-create-screen.tsx image/generate 无 AbortController

- **文件**: `C:\TRAE\OMPC-SSB\frontend\components\mobile-create-screen.tsx`
- **行号**: 393
- **描述**: `handleGenerateCover` 中的 `image/generate` fetch 调用无 AbortController，但有 `activeRef` 保护。
- **严重程度**: 低
- **建议修复**: 添加 AbortController。

---

## 修复优先级建议

### P0 - 立即修复（高严重度）

1. **问题 5.2**: `workspace-generation-export-card.tsx` 添加 activeRef 或 AbortController 防护
2. **问题 3.1-3.3**: 为 `lib/` API 函数和 `mobile-collect-screen.tsx`、`trend-collector-panel.tsx` 的 fetch 调用添加 AbortController 支持
3. **问题 9.1-9.2**: `generateCoverForContent` 函数内部 fetch 传递 signal 参数

### P1 - 尽快修复（中严重度）

4. **问题 3.4-3.7**: 其余组件的 fetch 调用添加 AbortController
5. **问题 6.1**: `use-cover-hydration.ts` 添加错误日志
6. **问题 6.4**: `workspace-generation-export-card.tsx` 错误状态重置
7. **问题 8.1**: API_BASE 改为动态求值

### P2 - 计划修复（低严重度）

8. **问题 1.1-1.3**: useCallback 依赖数组优化
9. **问题 6.2-6.3**: 错误日志改进
10. **问题 8.2-8.3**: API 配置和路径管理优化

---

## 附录：已检查文件清单

### lib/ 目录
- `admission-api.ts`
- `api-base.ts`
- `creation-projects.ts`
- `dashboard-data.ts`
- `generated-assets.ts`
- `knowledge-api.ts`
- `mobile-review-utils.ts`
- `mobile-runtime.ts`
- `use-collection-job-polling.ts`
- `use-launcher-provider-status.ts`
- `use-mobile-back-gesture.ts`
- `use-trend-review-queue.ts`
- `xhs-stickers.tsx`

### components/ 目录
- `app-shell.tsx`
- `mobile-collect-screen.tsx`
- `mobile-create-screen.tsx`
- `mobile-draft-history.tsx`
- `mobile-home-screen.tsx`
- `mobile-knowledge-screen.tsx`
- `mobile-login-screen.tsx`
- `mobile-shell-chrome.tsx`
- `mobile-trend-source-review.tsx`
- `public-preview-client.tsx`
- `trend-collector-helpers.tsx`
- `trend-collector-panel.tsx`
- `workspace-client.tsx`
- `workspace-content.tsx`
- `workspace-dashboard.tsx`
- `workspace-dependency-doctor.tsx`
- `workspace-draft-history-card.tsx`
- `workspace-generation-export-card.tsx`
- `workspace-generation-launcher.tsx`
- `workspace-knowledge.tsx`
- `workspace-login.tsx`
- `workspace-settings.tsx`
- `workspace-utils.tsx`

### components/mobile-create/ 目录
- `form-panel.tsx`
- `use-cover-hydration.ts`
- `use-draft-history.ts`
- `use-generation-api.ts`
- `use-progress-completion.ts`
