"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Copy,
  FileText,
  Heart,
  Image as ImageIcon,
  Loader2,
  PenTool,
  Sparkles,
  User,
} from "lucide-react";
import { getZscjApiBase } from "@/lib/api-base";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/zscj/utils";

/* ===================== 类型定义 ===================== */

/** 风格 Profile（对标账号） */
interface StyleProfile {
  id: string;
  name: string;
  role_type: string;
  role_type_id: string;
  description: string;
  post_count: number;
  avg_likes: number;
  style_dna: Record<string, unknown>;
  system_prompt: string;
  cover_style: string;
  sample_titles: string[];
}

/** 角色类型（方向） */
interface RoleType {
  id: string;
  label: string;
  description: string;
  accounts: StyleProfile[];
}

/** 生成草稿响应 */
interface GenerateDraftResponse {
  title: string;
  body: string;
  tags: string[];
  cover_prompt: string | null;
  cover_style: string;
  profile_name: string;
  profile_role_type: string;
  checklist: string[];
  warnings: string[];
}

/* ===================== 常量 ===================== */

/** 默认角色类型（API 未返回时作为占位） */
const DEFAULT_ROLE_TYPES: { id: string; label: string; description: string }[] =
  [
    {
      id: "minimal_broadcast",
      label: "极简信息播报型",
      description: "精炼信息，快速传递核心要点",
    },
    {
      id: "education_resource",
      label: "教培资源汇总型",
      description: "汇总教培资源，提供一站式参考",
    },
    {
      id: "deep_experience",
      label: "深度经验分享型",
      description: "深度剖析个人经验与实操心得",
    },
    {
      id: "professional_vertical",
      label: "专业垂直领域型",
      description: "聚焦垂直专业领域，输出权威内容",
    },
    {
      id: "service_funnel",
      label: "服务引流型",
      description: "以服务为导向，引导用户转化",
    },
    {
      id: "tool_template",
      label: "工具模板推广型",
      description: "推广实用工具与模板资源",
    },
    {
      id: "employment_analysis",
      label: "就业行业分析型",
      description: "分析就业趋势与行业动态",
    },
  ];

/* ===================== 工具函数 ===================== */

/** 格式化点赞数 */
function formatLikes(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}w`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/**
 * 将 API 返回的数据规范化为 RoleType[]。
 * 兼容两种返回格式：
 * 1. RoleType[]（已按角色类型分组，含 accounts 字段）
 * 2. StyleProfile[]（扁平列表，需按 role_type_id 分组）
 */
function normalizeProfiles(data: unknown): RoleType[] {
  if (!Array.isArray(data)) return [];

  // 已是 RoleType[] 格式
  if (
    data.length > 0 &&
    typeof data[0] === "object" &&
    data[0] !== null &&
    "accounts" in data[0]
  ) {
    return data as RoleType[];
  }

  // 扁平 StyleProfile[] 列表，按 role_type_id 分组
  const profiles = data as StyleProfile[];
  const groupMap = new Map<string, RoleType>();

  for (const profile of profiles) {
    const typeId = profile.role_type_id || "other";
    const typeName = profile.role_type || "其他";

    if (!groupMap.has(typeId)) {
      groupMap.set(typeId, {
        id: typeId,
        label: typeName,
        description: "",
        accounts: [],
      });
    }
    groupMap.get(typeId)!.accounts.push(profile);
  }

  return Array.from(groupMap.values());
}

/* ===================== 页面组件 ===================== */

export default function GeneratePage() {
  /* ---------- 状态 ---------- */
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [selectedRoleTypeId, setSelectedRoleTypeId] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  const [topic, setTopic] = useState("");
  const [extraContext, setExtraContext] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateDraftResponse | null>(null);

  const [copied, setCopied] = useState(false);

  /* ---------- 加载 Profiles ---------- */
  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setProfileError(null);
    try {
      const apiBase = getZscjApiBase();
      const res = await fetch(`${apiBase}/generate/profiles`);
      if (!res.ok) throw new Error(`加载失败（HTTP ${res.status}）`);
      const data = await res.json();
      const normalized = normalizeProfiles(data);
      setRoleTypes(normalized);
    } catch (err) {
      if (err instanceof TypeError) {
        setProfileError(
          "无法连接到 AI 写手服务，请确认后端 ZSCJ 服务已启动。",
        );
      } else {
        setProfileError(
          err instanceof Error ? err.message : "加载风格列表失败",
        );
      }
      // 加载失败时使用默认角色类型作为占位
      setRoleTypes(
        DEFAULT_ROLE_TYPES.map((rt) => ({
          ...rt,
          accounts: [],
        })),
      );
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  /* ---------- 选中的角色类型 ---------- */
  const selectedRoleType = useMemo(
    () => roleTypes.find((rt) => rt.id === selectedRoleTypeId) ?? null,
    [roleTypes, selectedRoleTypeId],
  );

  /* ---------- 选中的 Profile ---------- */
  const selectedProfile = useMemo(() => {
    if (!selectedRoleType) return null;
    return (
      selectedRoleType.accounts.find((a) => a.id === selectedProfileId) ?? null
    );
  }, [selectedRoleType, selectedProfileId]);

  /* ---------- 选择角色类型时重置账号选择 ---------- */
  function handleSelectRoleType(id: string) {
    setSelectedRoleTypeId(id);
    setSelectedProfileId("");
  }

  /* ---------- 生成草稿 ---------- */
  async function handleGenerate() {
    if (!selectedProfileId || !topic.trim()) return;

    setGenerating(true);
    setGenerateError(null);
    setResult(null);
    setCopied(false);

    try {
      const apiBase = getZscjApiBase();
      const res = await fetch(`${apiBase}/generate/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: selectedProfileId,
          topic: topic.trim(),
          extra_context: extraContext.trim() || null,
          generate_cover_prompt: true,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = `生成失败（HTTP ${res.status}）`;
        try {
          const data = JSON.parse(text);
          if (data?.detail) msg = String(data.detail);
        } catch {
          // 非 JSON 错误响应
        }
        throw new Error(msg);
      }

      const data: GenerateDraftResponse = await res.json();
      setResult(data);
    } catch (err) {
      if (err instanceof TypeError) {
        setGenerateError(
          "无法连接到 AI 写手服务，请检查网络连接和后端服务状态。",
        );
      } else {
        setGenerateError(
          err instanceof Error ? err.message : "生成失败，请重试",
        );
      }
    } finally {
      setGenerating(false);
    }
  }

  /* ---------- 复制全文 ---------- */
  async function handleCopy() {
    if (!result) return;
    const fullText = [
      result.title,
      "",
      result.body,
      "",
      result.tags.length > 0 ? result.tags.map((t) => `#${t}`).join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await copyText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setGenerateError("复制失败，请手动选择文本复制。");
    }
  }

  /* ---------- 是否可生成 ---------- */
  const canGenerate =
    Boolean(selectedProfileId) && Boolean(topic.trim()) && !generating;

  /* ===================== 渲染 ===================== */

  return (
    <div className="min-h-screen bg-paper">
      {/* ---------- 页面头部 ---------- */}
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-paper shadow-sm">
              <PenTool className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                AI 写手
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                选择蒸馏风格，一键生成高质量图文内容
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ---------- Profiles 加载错误 ---------- */}
        {profileError && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber/30 bg-amber/5 p-4 text-sm text-amber-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{profileError}</span>
            <button
              onClick={loadProfiles}
              className="ml-auto flex-shrink-0 text-xs font-medium underline hover:no-underline"
            >
              重试
            </button>
          </div>
        )}

        {/* ==================== 步骤一：选择方向 ==================== */}
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <StepIndicator number={1} active={true} />
            <h2 className="text-base font-semibold text-ink">选择方向</h2>
            <span className="text-xs text-muted">
              选择内容风格的角色类型
            </span>
          </div>

          {loadingProfiles ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-steel" />
              <span className="text-sm">正在加载风格列表...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {roleTypes.map((rt) => {
                const isSelected = selectedRoleTypeId === rt.id;
                const accountCount = rt.accounts.length;

                return (
                  <button
                    key={rt.id}
                    onClick={() => handleSelectRoleType(rt.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200",
                      isSelected
                        ? "border-moss/50 bg-moss/8 shadow-sm"
                        : "border-line/70 bg-cream hover:border-ink/20 hover:shadow-sm",
                    )}
                  >
                    {/* 选中指示器 */}
                    {isSelected && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-moss text-white">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <h3
                      className={cn(
                        "pr-6 text-sm font-semibold",
                        isSelected ? "text-moss" : "text-ink",
                      )}
                    >
                      {rt.label}
                    </h3>
                    {rt.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                        {rt.description}
                      </p>
                    )}
                    <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-xs font-medium text-muted">
                      <User className="h-3 w-3" />
                      {accountCount} 个账号
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================== 步骤二：选择蒸馏对象 ==================== */}
        {selectedRoleType && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <StepIndicator number={2} active={true} />
              <h2 className="text-base font-semibold text-ink">
                选择蒸馏对象
              </h2>
              <span className="text-xs text-muted">
                {selectedRoleType.label} · {selectedRoleType.accounts.length}{" "}
                个对标账号
              </span>
            </div>

            {selectedRoleType.accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-cream p-8 text-center text-sm text-muted">
                该方向下暂无蒸馏账号数据
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {selectedRoleType.accounts.map((profile) => {
                  const isSelected = selectedProfileId === profile.id;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200",
                        isSelected
                          ? "border-moss/50 bg-moss/8 shadow-sm"
                          : "border-line/70 bg-cream hover:border-ink/20 hover:shadow-sm",
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-moss text-white">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="pr-6">
                        <div className="flex items-center gap-1.5">
                          <User
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isSelected ? "text-moss" : "text-muted",
                            )}
                          />
                          <h3
                            className={cn(
                              "text-sm font-semibold",
                              isSelected ? "text-moss" : "text-ink",
                            )}
                          >
                            {profile.name}
                          </h3>
                        </div>
                        {profile.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                            {profile.description}
                          </p>
                        )}
                        <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {profile.post_count} 样本
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            均 {formatLikes(profile.avg_likes)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==================== 步骤三：输入主题并生成 ==================== */}
        {selectedProfile && (
          <section className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <StepIndicator number={3} active={true} />
              <h2 className="text-base font-semibold text-ink">
                输入主题并生成
              </h2>
              <span className="text-xs text-muted">
                对标：{selectedProfile.name}
              </span>
            </div>

            <div className="rounded-xl border border-line/70 bg-cream p-4">
              {/* 主题输入 */}
              <label className="mb-2 block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  推文主题
                </span>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={2}
                  placeholder="输入推文主题，如：2025博士申请时间线"
                  className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder-muted transition-colors focus:border-steel/50 focus:outline-none focus:ring-2 focus:ring-steel/15"
                />
              </label>

              {/* 额外上下文 */}
              <label className="mb-3 block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  额外上下文
                  <span className="ml-1 text-xs font-normal text-muted">
                    （可选）
                  </span>
                </span>
                <textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  rows={2}
                  placeholder="补充信息，如目标学校、专业方向等"
                  className="w-full resize-none rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder-muted transition-colors focus:border-steel/50 focus:outline-none focus:ring-2 focus:ring-steel/15"
                />
              </label>

              {/* 生成错误提示 */}
              {generateError && (
                <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-coral/30 bg-coral/5 p-3 text-xs text-coral">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{generateError}</span>
                </div>
              )}

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-200",
                  canGenerate
                    ? "bg-moss text-white shadow-sm hover:opacity-90 active:scale-[0.99]"
                    : "cursor-not-allowed bg-mist text-muted",
                )}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在生成...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    生成图文
                  </>
                )}
              </button>

              {!topic.trim() && !generating && (
                <p className="mt-2 text-center text-xs text-muted">
                  请先输入推文主题
                </p>
              )}
            </div>
          </section>
        )}

        {/* ==================== 步骤四：生成结果 ==================== */}
        {result && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <StepIndicator number={4} active={true} />
              <h2 className="text-base font-semibold text-ink">生成结果</h2>
              <span className="text-xs text-muted">
                {result.profile_name} · {result.profile_role_type}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-line/70 bg-cream shadow-sm">
              {/* 结果头部：标题 + 复制按钮 */}
              <div className="flex items-start justify-between gap-3 border-b border-line/50 bg-paper/40 p-4">
                <h3 className="flex-1 text-lg font-bold leading-snug text-ink sm:text-xl">
                  {result.title}
                </h3>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    copied
                      ? "border-moss/40 bg-moss/10 text-moss"
                      : "border-line bg-cream text-ink hover:border-ink/20 hover:bg-mist/40",
                  )}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      复制全文
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-4 p-4">
                {/* 正文 */}
                {result.body && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <FileText className="h-3.5 w-3.5" />
                      正文
                    </div>
                    <div className="whitespace-pre-wrap break-words rounded-lg bg-paper/60 p-3 text-sm leading-relaxed text-ink/90">
                      {result.body}
                    </div>
                  </div>
                )}

                {/* 标签 */}
                {result.tags.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <Sparkles className="h-3.5 w-3.5" />
                      标签
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-0.5 rounded-full border border-steel/20 bg-steel/8 px-2.5 py-1 text-xs font-medium text-steel"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 封面提示词 */}
                {result.cover_prompt && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <ImageIcon className="h-3.5 w-3.5" />
                      封面提示词
                    </div>
                    <div className="rounded-lg border border-line bg-paper/60 p-3 text-xs leading-relaxed text-ink/80">
                      {result.cover_prompt}
                    </div>
                  </div>
                )}

                {/* 封面风格说明 */}
                {result.cover_style && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <ImageIcon className="h-3.5 w-3.5" />
                      封面风格
                    </div>
                    <p className="text-xs leading-relaxed text-muted">
                      {result.cover_style}
                    </p>
                  </div>
                )}

                {/* 发布前检查清单 */}
                {result.checklist.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                      <CheckCircle className="h-3.5 w-3.5" />
                      发布前检查清单
                    </div>
                    <ul className="space-y-1.5">
                      {result.checklist.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-ink/80"
                        >
                          <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-moss/70" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 风险提示 */}
                {result.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber/25 bg-amber/5 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-ink">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      风险提示
                    </div>
                    <ul className="space-y-1.5">
                      {result.warnings.map((warning, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-amber-ink"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          <span className="leading-relaxed">{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ---------- 底部留白 ---------- */}
        <div className="h-8" />
      </main>
    </div>
  );
}

/* ===================== 辅助组件 ===================== */

/** 步骤指示器 */
function StepIndicator({
  number,
  active,
}: {
  number: number;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
        active
          ? "bg-ink text-paper"
          : "bg-mist text-muted",
      )}
    >
      {number}
    </div>
  );
}
