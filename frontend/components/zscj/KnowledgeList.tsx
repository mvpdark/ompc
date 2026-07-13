"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  listKnowledge,
  searchKnowledge,
  type KnowledgeSearchResult,
} from "@/lib/zscj/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  LoadingSpinner,
  Select,
} from "@/components/zscj/ui";
import { truncate } from "@/lib/zscj/utils";

const PAGE_SIZE = 10;

const CATEGORY_OPTIONS = [
  { value: "", label: "全部分类" },
  { value: "trend-insight", label: "趋势洞察" },
  { value: "general", label: "通用知识" },
  { value: "compiled", label: "编译汇总" },
];

export default function KnowledgeList() {
  const [items, setItems] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [searching, setSearching] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listKnowledge(50, category || undefined);
      setItems(data);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      if (!query.trim()) {
        await load();
      } else {
        const data = await searchKnowledge(
          query.trim(),
          50,
          category || undefined,
        );
        setItems(data);
        setPage(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <Card>
      <form onSubmit={handleSearch} className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索知识条目..."
          />
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="sm:w-40"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={searching} variant="secondary">
          <Search className="h-4 w-4" />
          {searching ? "搜索中..." : "搜索"}
        </Button>
      </form>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {loading ? (
        <LoadingSpinner />
      ) : pageItems.length === 0 ? (
        <EmptyState message="暂无知识条目" />
      ) : (
        <div className="space-y-3">
          {pageItems.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    {item.category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {truncate(item.content, 200)}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>ID: {item.id}</span>
                    <span>匹配: {item.match_type}</span>
                    {item.score !== null && (
                      <span>评分: {item.score.toFixed(3)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            共 {items.length} 条，第 {page + 1}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
