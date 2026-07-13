"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import {
  deleteTrend,
  listTrends,
  reviewVideo,
  type TrendRead,
} from "@/lib/zscj/api";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
  Select,
  StatusBadgeForValue,
  Textarea,
} from "@/components/zscj/ui";
import { formatDateTime, truncate } from "@/lib/zscj/utils";

const PLATFORM_OPTIONS = [
  { value: "", label: "全部平台" },
  { value: "xiaohongshu", label: "小红书" },
  { value: "douyin", label: "抖音" },
];

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
};

export default function TrendList() {
  const [items, setItems] = useState<TrendRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTrends(50, platform || undefined);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  async function handleDelete(id: number) {
    if (!confirm("确定要删除该趋势素材吗？")) return;
    setActionLoading(true);
    try {
      await deleteTrend(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReview(
    id: number,
    status: "approved" | "rejected",
  ) {
    setActionLoading(true);
    try {
      await reviewVideo(id, status, status === "approved" ? transcript : undefined);
      setReviewingId(null);
      setTranscript("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核失败");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">趋势素材列表</h2>
        <Select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-36"
        >
          {PLATFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <EmptyState message="暂无趋势素材" />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    {item.video_review_status && (
                      <StatusBadgeForValue value={item.video_review_status} />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {truncate(item.content, 200)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    {item.author && <span>作者：{item.author}</span>}
                    <span>{formatDateTime(item.publish_time ?? item.created_at)}</span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {item.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {item.favorites}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {item.comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3 w-3" />
                      {item.shares}
                    </span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                      >
                        <ExternalLink className="h-3 w-3" />
                        原文
                      </a>
                    )}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.video_transcript && (
                    <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                      <span className="font-medium">视频转写：</span>
                      {truncate(item.video_transcript, 150)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {item.video_review_status === "pending" && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setReviewingId(item.id);
                        setTranscript(item.video_transcript ?? "");
                      }}
                      className="text-xs"
                    >
                      <Video className="h-3 w-3" />
                      审核
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(item.id)}
                    disabled={actionLoading}
                    className="text-xs text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </Button>
                </div>
              </div>

              {reviewingId === item.id && (
                <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <Textarea
                    label="视频转写文本（通过时填写）"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={4}
                    placeholder="请输入或粘贴视频转写文本"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      disabled={actionLoading}
                      onClick={() => handleReview(item.id, "approved")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      通过
                    </Button>
                    <Button
                      variant="danger"
                      disabled={actionLoading}
                      onClick={() => handleReview(item.id, "rejected")}
                    >
                      驳回
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setReviewingId(null);
                        setTranscript("");
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
