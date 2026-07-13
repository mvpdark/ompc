"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  BookOpen,
  Inbox,
  Loader2,
  Plus,
  Tag,
  Upload,
} from "lucide-react";
import { getZscjApiBase } from "@/lib/api-base";
import { cn } from "@/lib/zscj/utils";

/* 知识条目类型（对齐后端 KnowledgeSearchResult） */
interface KnowledgeItem {
  id: number;
  title: string;
  content: string;
  category: string | null;
  match_type?: string;
  score?: number | null;
}

const CATEGORY_OPTIONS = [
  { value: "", label: "全部" },
  { value: "trend-insight", label: "趋势洞察" },
  { value: "general", label: "通用知识" },
  { value: "compiled", label: "编译汇总" },
  { value: "xiaohongshu-case", label: "小红书案例" },
];

const CATEGORY_LABELS: Record<string, string> = {
  "trend-insight": "趋势洞察",
  general: "通用知识",
  compiled: "编译汇总",
  "xiaohongshu-case": "小红书案例",
  "ai-compiled-weekly": "AI编译版",
  xiaohongshu_reference: "高赞参考",
};

function categoryLabel(category: string | null | undefined): string {
  if (!category) return "未分类";
  return CATEGORY_LABELS[category] ?? category;
}

/** 统一携带鉴权 token 的请求头 */
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("zscj_access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return { ...headers, ...extra };
}

/** 内容预览：清理链接与多余空白后截断 */
function excerpt(text: string, max = 120): string {
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");

  // 上传表单状态
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  /** 获取知识库列表：GET {zscjApiBase}/knowledge/list */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = getZscjApiBase();
      const params = new URLSearchParams({ limit: "50" });
      if (category) params.set("category", category);
      const res = await fetch(`${base}/knowledge/list?${params.toString()}`, {
        headers: buildHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`知识库读取失败 (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as KnowledgeItem[]) : []);
    } catch (err) {
      // ZSCJ 服务可能未启动，网络错误时静默返回空列表
      if (err instanceof TypeError) {
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : "加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /** 上传知识条目：POST {zscjApiBase}/knowledge/upload */
  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      setUploadMessage({ type: "error", text: "标题与内容均为必填项" });
      return;
    }
    setUploading(true);
    setUploadMessage(null);
    try {
      const base = getZscjApiBase();
      const res = await fetch(`${base}/knowledge/upload`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent.trim(),
          category: uploadCategory || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `上传失败 (${res.status})${text ? `：${text}` : ""}`,
        );
      }
      setUploadMessage({ type: "success", text: "知识条目上传成功" });
      setUploadTitle("");
      setUploadContent("");
      setUploadCategory("general");
      setShowUpload(false);
      await loadList();
    } catch (err) {
      if (err instanceof TypeError) {
        setUploadMessage({
          type: "error",
          text: "无法连接知识库服务，请确认后端已启动",
        });
      } else {
        setUploadMessage({
          type: "error",
          text: err instanceof Error ? err.message : "上传失败",
        });
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{
        fontFamily: "var(--apple-font-stack)",
        background:
          "radial-gradient(circle at 15% 8%, rgb(var(--moss) / 0.07), transparent 32%), radial-gradient(circle at 92% 4%, rgb(var(--steel) / 0.05), transparent 28%), rgb(var(--paper))",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {/* 页面标题 */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-moss">
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-medium uppercase tracking-[0.2em]">
                Knowledge Base
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
              知识库
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              统一管理趋势洞察、案例素材与编译汇总，为内容创作提供知识沉淀。
            </p>
          </div>
          <button
            onClick={() => setShowUpload((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
              showUpload
                ? "border border-line bg-mist text-muted"
                : "bg-moss text-white shadow-moss-sm hover:bg-moss/90",
            )}
          >
            {showUpload ? (
              <Plus className="h-4 w-4 rotate-45" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {showUpload ? "收起上传" : "上传知识"}
          </button>
        </header>

        {/* 上传表单 */}
        {showUpload && (
          <form
            onSubmit={handleUpload}
            className="mb-8 rounded-2xl border border-line/60 p-5 backdrop-blur-sm md:p-6"
            style={{ background: "rgb(var(--glass) / 0.6)" }}
          >
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Plus className="h-4 w-4 text-moss" />
              新增知识条目
            </h2>
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  标题
                </span>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="请输入知识标题"
                  className="w-full rounded-lg border border-line bg-mist/40 px-3 py-2.5 text-sm text-ink placeholder-muted focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  分类
                </span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full rounded-lg border border-line bg-mist/40 px-3 py-2.5 text-sm text-ink focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                >
                  {CATEGORY_OPTIONS.filter((o) => o.value).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  内容
                </span>
                <textarea
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  rows={5}
                  placeholder="请输入或粘贴知识正文"
                  className="w-full resize-y rounded-lg border border-line bg-mist/40 px-3 py-2.5 text-sm text-ink placeholder-muted focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss"
                />
              </label>
              {uploadMessage && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
                    uploadMessage.type === "success"
                      ? "bg-moss/10 text-moss"
                      : "bg-coral/10 text-coral",
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{uploadMessage.text}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-mist"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-moss px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-moss/90 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "上传中..." : "确认上传"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* 分类过滤 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1 text-xs text-muted">
            <Tag className="h-3.5 w-3.5" /> 分类
          </span>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setCategory(opt.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                category === opt.value
                  ? "bg-moss text-white shadow-moss-sm"
                  : "border border-line/70 bg-paper/50 text-muted hover:border-moss/40 hover:text-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 条目计数 */}
        {!loading && !error && items.length > 0 && (
          <p className="mb-4 text-xs text-muted">
            共 {items.length} 条知识
          </p>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/5 p-4 text-sm text-coral">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 列表 */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
            <Inbox className="h-10 w-10 opacity-40" />
            <span className="text-sm">暂无知识条目</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-line/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-moss/40 hover:shadow-soft md:p-6"
                style={{ background: "rgb(var(--glass) / 0.6)" }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">
                    {item.title}
                  </h3>
                  <span className="rounded-full bg-moss/10 px-2.5 py-0.5 text-xs font-medium text-moss">
                    {categoryLabel(item.category)}
                  </span>
                  {item.match_type && (
                    <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] text-muted">
                      {item.match_type}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {excerpt(item.content)}
                </p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted opacity-70">
                  <span>ID: {item.id}</span>
                  {item.score != null && (
                    <span>评分: {item.score.toFixed(3)}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
