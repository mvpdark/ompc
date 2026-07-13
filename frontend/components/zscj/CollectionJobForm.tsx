"use client";

import { useState } from "react";
import { CheckCircle2, Play } from "lucide-react";
import {
  createCollectionJob,
  type CollectionJobPayload,
  type TrendCollectionJobRead,
} from "@/lib/zscj/api";
import {
  Button,
  ErrorBanner,
  Input,
  Select,
} from "@/components/zscj/ui";

const PLATFORM_OPTIONS = [
  { value: "xiaohongshu", label: "小红书" },
  { value: "douyin", label: "抖音" },
];

const CONTENT_KIND_OPTIONS = [
  { value: "image_text", label: "图文" },
  { value: "video", label: "视频" },
  { value: "mixed", label: "混合" },
];

export default function CollectionJobForm({
  onCreated,
}: {
  onCreated?: (job: TrendCollectionJobRead) => void;
}) {
  const [platform, setPlatform] = useState<"xiaohongshu" | "douyin">("xiaohongshu");
  const [keyword, setKeyword] = useState("");
  const [contentKind, setContentKind] = useState<"image_text" | "video" | "mixed">("image_text");
  const [maxItems, setMaxItems] = useState(20);
  const [minDelay, setMinDelay] = useState(4);
  const [maxDelay, setMaxDelay] = useState(12);
  const [operatorWait, setOperatorWait] = useState(30);
  const [sessionLabel, setSessionLabel] = useState("");
  const [persistSession, setPersistSession] = useState(true);
  const [persistCookies, setPersistCookies] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const payload: CollectionJobPayload = {
        platform,
        keyword: keyword.trim(),
        content_kind: contentKind,
        max_items: maxItems,
        min_delay_seconds: minDelay,
        max_delay_seconds: maxDelay,
        operator_wait_seconds: operatorWait,
        session_label: sessionLabel.trim() || null,
        persist_session: persistSession,
        persist_cookies: persistCookies,
      };
      const job = await createCollectionJob(payload);
      setSuccess(`采集任务已创建（ID: ${job.id}），状态：${job.status}`);
      setKeyword("");
      onCreated?.(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="平台"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as "xiaohongshu" | "douyin")}
        >
          {PLATFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select
          label="内容类型"
          value={contentKind}
          onChange={(e) =>
            setContentKind(e.target.value as "image_text" | "video" | "mixed")
          }
        >
          {CONTENT_KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="关键词"
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="请输入搜索关键词"
        required
        maxLength={120}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="最大条目数"
          type="number"
          min={1}
          max={100}
          value={maxItems}
          onChange={(e) => setMaxItems(Number(e.target.value))}
        />
        <Input
          label="最小延迟（秒）"
          type="number"
          min={2}
          max={60}
          value={minDelay}
          onChange={(e) => setMinDelay(Number(e.target.value))}
        />
        <Input
          label="最大延迟（秒）"
          type="number"
          min={3}
          max={120}
          value={maxDelay}
          onChange={(e) => setMaxDelay(Number(e.target.value))}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="操作员等待（秒）"
          type="number"
          min={0}
          max={180}
          value={operatorWait}
          onChange={(e) => setOperatorWait(Number(e.target.value))}
        />
        <Input
          label="会话标签（可选）"
          type="text"
          value={sessionLabel}
          onChange={(e) => setSessionLabel(e.target.value)}
          placeholder="会话标签"
          maxLength={120}
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={persistSession}
            onChange={(e) => setPersistSession(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          持久化会话
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={persistCookies}
            onChange={(e) => setPersistCookies(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          持久化 Cookie
        </label>
      </div>
      <Button type="submit" disabled={loading}>
        <Play className="h-4 w-4" />
        {loading ? "创建中..." : "创建采集任务"}
      </Button>
    </form>
  );
}
