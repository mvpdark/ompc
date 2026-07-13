"use client";

import { memo, useCallback, type ChangeEvent } from "react";

import { Loader2, Sparkles } from "lucide-react";

import { MobileSourceEvidencePanel } from "@/components/mobile-source-evidence-panel";
import { MobilePanel, ModeChip } from "@/components/mobile-ui";
import { PlatformIcon, PlatformLabel } from "@/components/platform-icon";
import type { GenerationSourceContext } from "@/lib/generated-assets";
import type { MobilePlatform } from "@/lib/mobile-runtime";
import type { GenerationTopicPreset } from "@/lib/topic-presets";

interface FormPanelProps {
  topic: string;
  onTopicChange: (nextTopic: string) => void;
  visibleTopicPresets: GenerationTopicPreset[];
  onRefreshPresets: (manual?: boolean) => void;
  onApplyPreset: (preset: GenerationTopicPreset) => void;
  sourcePreviewError: string | null;
  sourcePreviewBusy: boolean;
  onPreviewSource: () => Promise<void>;
  visibleMobileSourceContext: GenerationSourceContext | null;
  generationKnowledgeQuery: string;
  targetAudience: string;
  onTargetAudienceChange: (value: string) => void;
  platform: MobilePlatform;
  onPlatformChange: (platform: MobilePlatform) => void;
  contentMode: "short" | "xiaohongshu";
  onContentModeChange: (mode: "short" | "xiaohongshu") => void;
  tagsText: string;
  onTagsChange: (value: string) => void;
  busy: boolean;
  progressLabel: string;
  progressPercent: number;
  sourceEvidenceBlocked: boolean;
  generatedContentMatchesCurrentInputs: boolean;
  mobileGenerateDraftDisabled: boolean;
  onGenerate: () => Promise<void>;
  staleMobileDraftMessage: string | null;
  roleTypes: { id: string; label: string; description: string }[];
  selectedRoleTypeId: string | null;
  onRoleTypeChange: (id: string | null) => void;
  accounts: { id: string; name: string; description: string; post_count: number; avg_likes: number }[];
  selectedProfileId: string | null;
  onProfileChange: (id: string | null) => void;
}

export const FormPanel = memo(function FormPanel(props: FormPanelProps) {
  const {
    topic,
    onTopicChange,
    visibleTopicPresets,
    onRefreshPresets,
    onApplyPreset,
    sourcePreviewError,
    sourcePreviewBusy,
    onPreviewSource,
    visibleMobileSourceContext,
    generationKnowledgeQuery,
    targetAudience,
    onTargetAudienceChange,
    platform,
    onPlatformChange,
    contentMode,
    onContentModeChange,
    tagsText,
    onTagsChange,
    busy,
    progressLabel,
    progressPercent,
    sourceEvidenceBlocked,
    generatedContentMatchesCurrentInputs,
    mobileGenerateDraftDisabled,
    onGenerate,
    staleMobileDraftMessage,
    roleTypes,
    selectedRoleTypeId,
    onRoleTypeChange,
    accounts,
    selectedProfileId,
    onProfileChange
  } = props;

  const handleTopicChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onTopicChange(event.target.value);
  }, [onTopicChange]);

  const handleTargetAudienceChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onTargetAudienceChange(event.target.value);
  }, [onTargetAudienceChange]);

  const handleTagsChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onTagsChange(event.target.value);
  }, [onTagsChange]);

  return (
    <MobilePanel
      title="一键生成"
      action={<span className="rounded-full bg-sage/[0.90] px-2.5 py-1 text-xs font-black text-moss">撰稿 + 封面</span>}
    >
      <label className="block">
        <span className="text-xs font-medium text-muted">选题</span>
        <input
          className="mt-2 h-12 w-full rounded-full border border-white/[0.84] bg-[rgba(255,253,247,0.88)] px-4 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] outline-none focus:border-moss focus:ring-2 focus:ring-moss/[0.15]"
          data-testid="mobile-topic"
          onChange={handleTopicChange}
          value={topic}
        />
      </label>
      <div className="mt-3" data-testid="mobile-topic-preset-list">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted">推荐选题</span>
          <button
            className="flex h-7 items-center gap-1 rounded-full border border-white/[0.9] bg-[rgba(255,253,247,0.82)] px-2 text-[11px] font-black text-moss shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            data-testid="mobile-topic-preset-refresh"
            onClick={() => onRefreshPresets(true)}
            type="button"
          >
            <Sparkles className="h-3 w-3" />
            换一批
          </button>
        </div>
        <div className="mt-1 text-[11px] font-medium text-muted">
          每 45 秒自动换一批，可自定义
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" data-project-swipe-ignore="true">
          {visibleTopicPresets.map((preset) => (
            <button
              className="min-w-[128px] rounded-[18px] border border-white/[0.88] bg-[rgba(255,253,247,0.86)] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.74)] active:scale-[0.99]"
              data-testid={`mobile-topic-preset-${preset.key}`}
              key={preset.key}
              onClick={() => onApplyPreset(preset)}
              type="button"
            >
              <span className="block text-[11px] font-black text-moss">
                {preset.mobileLabel}
              </span>
              <span className="mt-1 block text-xs font-black leading-4 text-ink">
                {preset.topic}
              </span>
              <span className="mt-1 block text-[10px] font-medium text-muted">
                {preset.mobileHelper}
              </span>
            </button>
          ))}
        </div>
      </div>
      <MobileSourceEvidencePanel
        error={sourcePreviewError}
        fallbackKnowledgeQuery={generationKnowledgeQuery}
        onPreview={onPreviewSource}
        previewBusy={sourcePreviewBusy}
        sourceContext={visibleMobileSourceContext}
      />
      {selectedProfileId ? (
        <div className="mt-3 rounded-[16px] border border-moss/30 bg-sage/60 px-4 py-3">
          <span className="text-xs font-medium text-moss">目标人群 · AI自动生成</span>
          <p className="mt-1 text-[11px] text-muted">已选择写手风格，目标人群由AI根据风格自动判断</p>
        </div>
      ) : (
        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">目标人群</span>
          <input
            className="mt-2 h-12 w-full rounded-full border border-white/[0.84] bg-[rgba(255,253,247,0.88)] px-4 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] outline-none focus:border-moss focus:ring-2 focus:ring-moss/[0.15]"
            data-testid="mobile-audience"
            onChange={handleTargetAudienceChange}
            value={targetAudience}
          />
        </label>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ModeChip
          active={platform === "xiaohongshu"}
          label={<PlatformLabel className="justify-center" iconSize="sm" platform="xiaohongshu" />}
          onClick={() => onPlatformChange("xiaohongshu")}
          testId="create-platform-xiaohongshu"
        />
        <ModeChip
          active={platform === "douyin"}
          label={
            <span className="flex items-center justify-center gap-2">
              <PlatformIcon platform="douyin" size="sm" />
              抖音
            </span>
          }
          onClick={() => onPlatformChange("douyin")}
          testId="create-platform-douyin"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ModeChip
          active={contentMode === "xiaohongshu"}
          label={
            <PlatformLabel
              className="justify-center"
              iconSize="sm"
              platform="xiaohongshu"
              suffix="图文"
            />
          }
          onClick={() => onContentModeChange("xiaohongshu")}
          testId="mode-xiaohongshu"
        />
        <ModeChip
          active={contentMode === "short"}
          label="短段正文"
          onClick={() => onContentModeChange("short")}
          testId="mode-short"
        />
      </div>
      {selectedProfileId ? (
        <div className="mt-3 rounded-[16px] border border-moss/30 bg-sage/60 px-4 py-3">
          <span className="text-xs font-medium text-moss">标签 · AI自动生成</span>
          <p className="mt-1 text-[11px] text-muted">已选择写手风格，标签由AI根据风格和主题自动生成</p>
        </div>
      ) : (
        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">标签</span>
          <input
            className="mt-2 h-11 w-full rounded-full border border-white/[0.84] bg-[rgba(255,253,247,0.88)] px-4 text-sm font-medium text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.86)] outline-none focus:border-moss focus:ring-2 focus:ring-moss/[0.15]"
            data-testid="mobile-tags"
            onChange={handleTagsChange}
            value={tagsText}
          />
        </label>
      )}

      {/* 风格选择 */}
      {roleTypes.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">风格</span>
            {selectedRoleTypeId && (
              <button
                className="text-[11px] font-medium text-muted underline"
                onClick={() => { onRoleTypeChange(null); onProfileChange(null); }}
                type="button"
              >
                清除
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {roleTypes.map((rt) => (
              <button
                className={[
                  "min-w-[100px] rounded-[16px] border px-3 py-2 text-left active:scale-[0.99]",
                  selectedRoleTypeId === rt.id
                    ? "border-moss bg-sage text-moss"
                    : "border-white/[0.88] bg-[rgba(255,253,247,0.86)] text-ink"
                ].join(" ")}
                key={rt.id}
                onClick={() => onRoleTypeChange(rt.id === selectedRoleTypeId ? null : rt.id)}
                type="button"
              >
                <span className="block text-[11px] font-black">{rt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 写手选择 */}
      {selectedRoleTypeId && accounts.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">写手</span>
            {selectedProfileId && (
              <button
                className="text-[11px] font-medium text-muted underline"
                onClick={() => onProfileChange(null)}
                type="button"
              >
                清除
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {accounts.map((acct) => (
              <button
                className={[
                  "min-w-[120px] rounded-[16px] border px-3 py-2 text-left active:scale-[0.99]",
                  selectedProfileId === acct.id
                    ? "border-moss bg-sage text-moss"
                    : "border-white/[0.88] bg-[rgba(255,253,247,0.86)] text-ink"
                ].join(" ")}
                key={acct.id}
                onClick={() => onProfileChange(acct.id === selectedProfileId ? null : acct.id)}
                type="button"
              >
                <span className="block text-[11px] font-black">{acct.name}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-muted">
                  {acct.post_count}篇 · 均{(acct.avg_likes / 1000).toFixed(1)}k
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        aria-label="一键完成撰稿和封面图"
        className="mt-4 flex h-[54px] w-full touch-manipulation items-center justify-center gap-2 rounded-full bg-coral text-sm font-black text-white shadow-[0_16px_34px_rgba(255,36,66,0.22)] active:scale-[0.99] disabled:opacity-60"
        data-testid="mobile-generate-draft"
        disabled={mobileGenerateDraftDisabled}
        onClick={onGenerate}
        title={sourceEvidenceBlocked ? "检索依据读取失败，请先重新查看依据后再生成" : undefined}
        type="button"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy
          ? `${progressLabel} ${progressPercent}%`
          : sourceEvidenceBlocked
            ? "先重新查看依据"
          : generatedContentMatchesCurrentInputs
            ? "重新一键生成"
            : "一键撰稿+封面图"}
      </button>
      {busy || progressPercent === 100 || progressLabel === "生成失败" ? (
        <div className="mt-3" data-testid="mobile-generation-progress">
          <div className="h-2 overflow-hidden rounded-full bg-sand">
            <div
              className={[
                "h-full rounded-full transition-all duration-500",
                progressLabel === "生成失败" ? "bg-coral" : "bg-coral"
              ].join(" ")}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted">
            <span>{progressLabel}</span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      ) : null}
      {staleMobileDraftMessage ? (
        <div
          className="mt-3 rounded-[18px] border border-coral/30 bg-blush px-3 py-2 text-xs font-bold leading-5 text-coral"
          data-testid="mobile-stale-draft-warning"
        >
          {staleMobileDraftMessage}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-5 text-muted">
        会先生成文案，再自动生成封面图；不会自动发布。
      </p>
    </MobilePanel>
  );
});
