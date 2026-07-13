"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Heart,
  Inbox,
  Loader2,
  MessageCircle,
  Share2,
  Star,
  TrendingUp,
} from "lucide-react";
import { getZscjApiBase } from "@/lib/api-base";
import { cn } from "@/lib/zscj/utils";

/* 趋势条目类型（对齐后端 TrendRead） */
interface TrendItem {
  id: number;
  platform: string;
  title: string;
  content: string;
  author: string | null;
  publish_time: string | null;
  url: string | null;
  tags: string[] | null;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  cover_url: string | null;
  created_at: string;
}

const PLATFORM_OPTIONS = [
  { value: "", label: "全部" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "douyin", label: "抖音" },
];

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
};

/* 平台主题色（用于标签底色） */
const PLATFORM_ACCENTS: Record<string, string> = {
  xiaohongshu: "rgb(var(--coral))",
  douyin: "rgb(var(--ink))",
};

/** 统一携带鉴权 token 的请求头 */
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("zscj_access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return { ...headers, ...extra };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/** 内容预览：压缩空白后截断 */
function excerpt(text: string, max = 140): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
}

/** 互动数据简写：万 / 千 */
function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function TrendsPage() {
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("");

  /** 获取趋势列表：GET {zscjApiBase}/trends/list?limit=20 */
  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = getZscjApiBase();
      const params = new URLSearchParams({ limit: "20" });
      if (platform) params.set("platform", platform);
      const res = await fetch(`${base}/trends/list?${params.toString()}`, {
        headers: buildHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`趋势列表读取失败 (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data) ? (data as TrendItem[]) : []);
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
  }, [platform]);

  useEffect(() => {
    loadList();
  }, [loadList]);

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
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-moss">
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-[0.2em]">
              Trends
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            趋势采集
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            汇聚小红书、抖音高热度内容，洞察流量趋势与爆款方向。
          </p>
        </header>

        {/* 平台过滤 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {PLATFORM_OPTIONS.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setPlatform(opt.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200",
                platform === opt.value
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
          <p className="mb-4 text-xs text-muted">共 {items.length} 条趋势</p>
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
            <span className="text-sm">暂无趋势素材</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const accent =
                PLATFORM_ACCENTS[item.platform] ?? "rgb(var(--moss))";
              return (
                <article
                  key={item.id}
                  className="flex flex-col rounded-2xl border border-line/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-moss/40 hover:shadow-soft"
                  style={{ background: "rgb(var(--glass) / 0.6)" }}
                >
                  {/* 头部：平台标签 + 作者 */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ background: accent }}
                    >
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </span>
                    {item.author && (
                      <span className="truncate text-xs text-muted">
                        @{item.author}
                      </span>
                    )}
                  </div>

                  {/* 标题 */}
                  <h3 className="mb-1.5 text-base font-semibold leading-snug text-ink">
                    {item.title}
                  </h3>

                  {/* 内容预览 */}
                  <p className="mb-3 flex-1 text-sm leading-relaxed text-muted">
                    {excerpt(item.content)}
                  </p>

                  {/* 标签 */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {item.tags.slice(0, 5).map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-mist px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 互动数据：点赞 / 收藏 / 评论 / 分享 */}
                  <div className="flex flex-wrap items-center gap-4 border-t border-line/50 pt-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" /> {formatCount(item.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />{" "}
                      {formatCount(item.favorites)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />{" "}
                      {formatCount(item.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3.5 w-3.5" />{" "}
                      {formatCount(item.shares)}
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-moss hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> 原文
                      </a>
                    )}
                  </div>

                  {/* 时间 */}
                  <div className="mt-2 text-[11px] text-muted opacity-70">
                    {formatDateTime(item.publish_time ?? item.created_at)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
