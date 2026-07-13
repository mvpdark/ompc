"use client";

import { useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { uploadKnowledge, type KnowledgeSearchResult } from "@/lib/api";
import {
  Button,
  ErrorBanner,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

const CATEGORY_OPTIONS = [
  { value: "", label: "不指定分类" },
  { value: "trend-insight", label: "趋势洞察" },
  { value: "general", label: "通用知识" },
  { value: "compiled", label: "编译汇总" },
];

export default function KnowledgeUpload({
  onUploaded,
}: {
  onUploaded?: (item: KnowledgeSearchResult) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const item = await uploadKnowledge(
        title.trim(),
        content.trim(),
        category || undefined,
      );
      setSuccess(`已上传：${item.title}`);
      setTitle("");
      setContent("");
      setCategory("");
      onUploaded?.(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
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
      <Input
        label="标题"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="请输入知识条目标题"
        required
        maxLength={255}
      />
      <Textarea
        label="内容"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="请输入知识条目内容"
        required
        rows={6}
      />
      <Select
        label="分类"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {CATEGORY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={loading}>
        <Upload className="h-4 w-4" />
        {loading ? "上传中..." : "上传知识条目"}
      </Button>
    </form>
  );
}
