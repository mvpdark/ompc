"use client";

import { useEffect, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import {
  listCollectionJobs,
  startCollectionJob,
  type TrendCollectionJobRead,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
  StatusBadgeForValue,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
};

export default function CollectionJobList() {
  const [jobs, setJobs] = useState<TrendCollectionJobRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listCollectionJobs(50);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStart(id: number) {
    setActionLoading(id);
    setError(null);
    try {
      await startCollectionJob(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动失败");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="采集任务列表"
        icon={Play}
        action={
          <Button
            variant="ghost"
            onClick={load}
            disabled={loading}
            className="px-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        }
      />
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {loading ? (
        <LoadingSpinner />
      ) : jobs.length === 0 ? (
        <EmptyState message="暂无采集任务" />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const canStart =
              job.status !== "running" &&
              job.status !== "completed" &&
              job.status !== "queued";
            return (
              <div
                key={job.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {PLATFORM_LABELS[job.platform] ?? job.platform}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {job.keyword}
                      </span>
                      <StatusBadgeForValue value={job.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>ID: {job.id}</span>
                      <span>创建：{formatDateTime(job.created_at)}</span>
                      <span>更新：{formatDateTime(job.updated_at)}</span>
                    </div>
                    {job.result_summary &&
                      typeof job.result_summary === "object" && (
                        <div className="mt-2 text-xs text-slate-600">
                          {String(
                            (job.result_summary as Record<string, unknown>)
                              .message ?? "",
                          )}
                          {typeof (job.result_summary as Record<string, unknown>)
                            .collected_items === "number" &&
                            ` （采集 ${String(
                              (job.result_summary as Record<string, unknown>)
                                .collected_items,
                            )} 条）`}
                        </div>
                      )}
                    {job.error && (
                      <div className="mt-1 text-xs text-red-600">
                        错误：{job.error}
                      </div>
                    )}
                  </div>
                  {canStart && (
                    <Button
                      variant="secondary"
                      onClick={() => handleStart(job.id)}
                      disabled={actionLoading === job.id}
                      className="text-xs"
                    >
                      <Play className="h-3 w-3" />
                      {actionLoading === job.id ? "启动中..." : "启动"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
