"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Loader2,
  School,
  Search,
} from "lucide-react";
import { getZscjApiBase } from "@/lib/api-base";
import { cn } from "@/lib/zscj/utils";

/* ===================== 类型定义 ===================== */

/** 招生通告数据结构 */
interface AdmissionNotice {
  id: number;
  source_id: number;
  title: string;
  url: string;
  publish_date: string | null;
  summary: string | null;
  detail_content: string | null;
  attachments: Array<Record<string, unknown>> | null;
  extract_status: string; // pending | extracted | failed
  extracted_fields: Record<string, unknown> | null;
  fact_card_id: number | null;
  first_seen_at: string;
  updated_at: string;
  school_name: string | null;
}

/* ===================== 工具函数 ===================== */

/** 格式化日期为中文显示 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "未知日期";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

/** 抽取状态样式配置 */
const EXTRACT_STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending: {
    label: "待抽取",
    dotClass: "bg-amber",
    badgeClass: "bg-amber/12 text-amber-ink border-amber/25",
  },
  extracted: {
    label: "已抽取",
    dotClass: "bg-moss",
    badgeClass: "bg-moss/12 text-moss border-moss/25",
  },
  failed: {
    label: "抽取失败",
    dotClass: "bg-coral",
    badgeClass: "bg-coral/12 text-coral border-coral/25",
  },
};

function getExtractStatusConfig(status: string) {
  return (
    EXTRACT_STATUS_CONFIG[status] ?? {
      label: status || "未知",
      dotClass: "bg-muted",
      badgeClass: "bg-mist text-muted border-line",
    }
  );
}

/** 从 API 响应中提取通告列表（兼容多种返回格式） */
function extractNoticeList(data: unknown): AdmissionNotice[] {
  if (Array.isArray(data)) return data as AdmissionNotice[];
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as AdmissionNotice[];
    if (Array.isArray(obj.list)) return obj.list as AdmissionNotice[];
    if (Array.isArray(obj.notices)) return obj.notices as AdmissionNotice[];
  }
  return [];
}

/* ===================== 页面组件 ===================== */

export default function AdmissionsPage() {
  const [notices, setNotices] = useState<AdmissionNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ---------- 加载通告列表 ---------- */
  const loadNotices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = getZscjApiBase();
      const res = await fetch(`${apiBase}/admissions/notices?limit=20`);
      if (!res.ok) throw new Error(`加载失败（HTTP ${res.status}）`);
      const data = await res.json();
      setNotices(extractNoticeList(data));
    } catch (err) {
      if (err instanceof TypeError) {
        setError("无法连接到招生数据服务，请确认后端 ZSCJ 服务已启动。");
      } else {
        setError(err instanceof Error ? err.message : "加载招生通告失败");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------- 搜索通告 ---------- */
  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) {
        await loadNotices();
        return;
      }
      setSearching(true);
      setError(null);
      setSchoolFilter("");
      try {
        const apiBase = getZscjApiBase();
        const res = await fetch(
          `${apiBase}/admissions/notices/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) throw new Error(`搜索失败（HTTP ${res.status}）`);
        const data = await res.json();
        setNotices(extractNoticeList(data));
      } catch (err) {
        if (err instanceof TypeError) {
          setError("无法连接到招生数据服务。");
        } else {
          setError(err instanceof Error ? err.message : "搜索失败");
        }
      } finally {
        setSearching(false);
      }
    },
    [searchQuery, loadNotices],
  );

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  /* ---------- 提取不重复的学校名列表 ---------- */
  const schoolOptions = useMemo(() => {
    const schools = new Set<string>();
    notices.forEach((n) => {
      if (n.school_name) schools.add(n.school_name);
    });
    return Array.from(schools).sort();
  }, [notices]);

  /* ---------- 按学校过滤 ---------- */
  const filteredNotices = useMemo(() => {
    if (!schoolFilter) return notices;
    return notices.filter((n) => n.school_name === schoolFilter);
  }, [notices, schoolFilter]);

  /* ---------- 切换展开 ---------- */
  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  /* ---------- 渲染抽取字段 ---------- */
  function renderExtractedFields(fields: Record<string, unknown>) {
    const entries = Object.entries(fields).filter(
      ([, v]) => v !== null && v !== undefined && v !== "",
    );
    if (entries.length === 0) return null;
    return (
      <div className="mt-3 rounded-lg border border-moss/20 bg-moss/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-moss">
          <FileText className="h-3.5 w-3.5" />
          结构化字段
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5 text-xs">
              <dt className="flex-shrink-0 font-medium text-muted">{key}：</dt>
              <dd className="min-w-0 break-words text-ink">
                {Array.isArray(value)
                  ? value.join("、")
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  /* ===================== 渲染 ===================== */

  return (
    <div className="min-h-screen bg-paper">
      {/* ---------- 页面头部 ---------- */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                招生通告
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                大学招生信息聚合与结构化提取
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ---------- 搜索与过滤栏 ---------- */}
        <div className="mb-6 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索通告标题、学校、关键词..."
                className="w-full rounded-lg border border-line bg-cream py-2.5 pl-10 pr-4 text-sm text-ink placeholder-muted transition-colors focus:border-steel/50 focus:outline-none focus:ring-2 focus:ring-steel/15"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {searching ? "搜索中" : "搜索"}
            </button>
          </form>

          {/* 学校过滤 */}
          {schoolOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 flex-shrink-0 text-muted" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSchoolFilter("")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    !schoolFilter
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-cream text-muted hover:border-ink/30 hover:text-ink",
                  )}
                >
                  全部学校
                </button>
                {schoolOptions.map((school) => (
                  <button
                    key={school}
                    onClick={() => setSchoolFilter(school)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      schoolFilter === school
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-cream text-muted hover:border-ink/30 hover:text-ink",
                    )}
                  >
                    {school}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------- 错误提示 ---------- */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-coral/30 bg-coral/5 p-4 text-sm text-coral">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={loadNotices}
              className="ml-auto flex-shrink-0 text-xs font-medium underline hover:no-underline"
            >
              重试
            </button>
          </div>
        )}

        {/* ---------- 加载状态 ---------- */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
            <Loader2 className="h-8 w-8 animate-spin text-steel" />
            <p className="text-sm">正在加载招生通告...</p>
          </div>
        )}

        {/* ---------- 空状态 ---------- */}
        {!loading && !error && filteredNotices.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="text-sm">暂无招生通告数据</p>
          </div>
        )}

        {/* ---------- 通告列表 ---------- */}
        {!loading && filteredNotices.length > 0 && (
          <div className="space-y-3">
            {/* 结果计数 */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted">
                共 {filteredNotices.length} 条通告
                {schoolFilter && ` · 已筛选：${schoolFilter}`}
              </span>
            </div>

            {filteredNotices.map((notice) => {
              const statusConfig = getExtractStatusConfig(
                notice.extract_status,
              );
              const isExpanded = expandedId === notice.id;
              const hasDetail = Boolean(
                notice.detail_content || notice.extracted_fields,
              );

              return (
                <article
                  key={notice.id}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-cream transition-all duration-200",
                    isExpanded
                      ? "border-steel/30 shadow-md"
                      : "border-line/70 hover:border-ink/20 hover:shadow-sm",
                  )}
                >
                  {/* 卡片头部 - 可点击展开 */}
                  <button
                    onClick={() => hasDetail && toggleExpand(notice.id)}
                    disabled={!hasDetail}
                    className={cn(
                      "flex w-full items-start gap-3 p-4 text-left transition-colors",
                      hasDetail && "cursor-pointer hover:bg-mist/40",
                      !hasDetail && "cursor-default",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      {/* 标题行 */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-snug text-ink sm:text-base">
                          {notice.title}
                        </h3>
                        {hasDetail && (
                          <span className="mt-0.5 flex-shrink-0 text-muted">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* 摘要 */}
                      {notice.summary && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
                          {notice.summary}
                        </p>
                      )}

                      {/* 元信息行 */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        {/* 学校名 */}
                        {notice.school_name && (
                          <span className="inline-flex items-center gap-1">
                            <School className="h-3.5 w-3.5" />
                            {notice.school_name}
                          </span>
                        )}
                        {/* 发布日期 */}
                        {notice.publish_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(notice.publish_date)}
                          </span>
                        )}
                        {/* 抽取状态 */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                            statusConfig.badgeClass,
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              statusConfig.dotClass,
                            )}
                          />
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="border-t border-line/50 bg-paper/40 px-4 py-3">
                      {/* 详情内容 */}
                      {notice.detail_content && (
                        <div className="mb-3">
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
                            <FileText className="h-3.5 w-3.5 text-steel" />
                            详情内容
                          </div>
                          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-cream p-3 text-xs leading-relaxed text-ink/80">
                            {notice.detail_content}
                          </div>
                        </div>
                      )}

                      {/* 结构化抽取字段 */}
                      {notice.extracted_fields &&
                        renderExtractedFields(notice.extracted_fields)}

                      {/* 附件 */}
                      {notice.attachments && notice.attachments.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-semibold text-ink">
                            附件（{notice.attachments.length}）
                          </div>
                          <ul className="space-y-1">
                            {notice.attachments.map((att, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-1.5 text-xs text-muted"
                              >
                                <FileText className="h-3 w-3" />
                                {String(att?.name ?? att?.filename ?? `附件 ${idx + 1}`)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 原文链接 */}
                      {notice.url && (
                        <a
                          href={notice.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-steel transition-colors hover:text-steel/80"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          查看原文
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
