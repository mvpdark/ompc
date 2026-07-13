// OMPC-ZSCJ 前端 API 客户端
// 对接后端 /api/v1 下的 20+ 个端点

function getApiBase(): string {
  // Server-side: use env var or localhost (same host as backend)
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:60002/api/v1";
  }
  // Client-side: use browser hostname with backend port
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured;
  const { hostname } = window.location;
  return `http://${hostname}:60002/api/v1`;
}

const API_BASE_URL = getApiBase();

const TOKEN_STORAGE_KEY = "zscj_access_token";

/* ===================== 类型定义 ===================== */

export interface UserRead {
  id: number;
  phone: string;
  nickname: string | null;
  role: string;
  domain_key: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: UserRead;
}

export interface KnowledgeSearchResult {
  id: number;
  title: string;
  content: string;
  category: string | null;
  score: number | null;
  match_type: string;
}

export interface KnowledgeCompileStatus {
  latest: KnowledgeSearchResult | null;
  due: boolean;
  interval_hours: number;
}

export interface KnowledgeCompileResponse {
  item: KnowledgeSearchResult | null;
  compiled: boolean;
  due: boolean;
  interval_hours: number;
  source_count: number;
  message: string;
}

export interface TrendRead {
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
  video_transcript: string | null;
  video_review_status: string | null;
  screenshot_url: string | null;
  created_at: string;
}

export interface TrendCollectionJobRead {
  id: number;
  platform: string;
  keyword: string;
  status: string;
  requested_by: number | null;
  safety_profile: Record<string, unknown>;
  result_summary: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeywordAnalysisItem {
  keyword: string;
  count: number;
  platforms: string[];
}

export interface PlatformSearchTarget {
  platform: string;
  keyword: string;
  content_kind: string;
  video_collection_enabled: boolean;
  search_url: string;
  requires_manual_login: boolean;
  automation_mode: string;
  safety_notes: string[];
}

export interface TrendLinkCandidate {
  original_url: string;
  normalized_url: string;
  link_type: string;
  accepted: boolean;
  requires_resolution: boolean;
  note_id: string | null;
  reason: string | null;
}

export interface TrendLinkImportTarget {
  platform: string;
  extracted_count: number;
  accepted_count: number;
  import_mode: string;
  download_media_enabled: boolean;
  cookie_persistence: boolean;
  links: TrendLinkCandidate[];
  safety_notes: string[];
}

export interface TrendKnowledgeDigestResponse {
  knowledge_id: number;
  title: string;
  category: string;
  source_trend_ids: number[];
  item_count: number;
  content: string;
}

export interface TrendVideoReviewResponse {
  id: number;
  video_review_status: string;
  video_transcript: string | null;
}

export interface TrendReport {
  [key: string]: unknown;
}

/* ===================== 采集任务创建参数 ===================== */

export interface CollectionJobPayload {
  platform: "xiaohongshu" | "douyin";
  keyword: string;
  content_kind?: "image_text" | "video" | "mixed";
  max_items?: number;
  min_delay_seconds?: number;
  max_delay_seconds?: number;
  operator_wait_seconds?: number;
  session_label?: string | null;
  persist_session?: boolean;
  persist_cookies?: boolean;
}

export interface KnowledgeDigestPayload {
  platform?: "xiaohongshu" | "douyin" | null;
  keyword?: string | null;
  trend_ids?: number[];
  limit?: number;
  category?: string;
  source_reviewed?: boolean;
}

export interface TrendCollectPayload {
  platform: string;
  title: string;
  content: string;
  author?: string | null;
  publish_time?: string | null;
  url?: string | null;
  tags?: string[];
  likes?: number;
  favorites?: number;
  comments?: number;
  shares?: number;
  cover_url?: string | null;
  video_transcript?: string | null;
  screenshot_url?: string | null;
}

/* ===================== 错误类型 ===================== */

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/* ===================== 内部请求工具 ===================== */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredUser(): UserRead | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("zscj_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserRead;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserRead): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("zscj_user", JSON.stringify(user));
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("zscj_user");
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params, auth = true } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `请求失败 (${response.status})`) ?? `请求失败 (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

/* ===================== Auth 端点 ===================== */

export async function register(
  phone: string,
  password: string,
  nickname?: string,
  role?: string,
): Promise<Token> {
  const payload: Record<string, string> = { phone, password };
  if (nickname) payload.nickname = nickname;
  // 后端固定使用 promoter 角色，会忽略前端传入的 role 字段，故不再发送（保留 role 参数仅为向后兼容）
  return request<Token>("/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export async function login(phone: string, password: string): Promise<Token> {
  return request<Token>("/auth/login", {
    method: "POST",
    body: { phone, password },
    auth: false,
  });
}

/* ===================== Knowledge 端点 ===================== */

export async function listKnowledge(
  limit?: number,
  category?: string,
): Promise<KnowledgeSearchResult[]> {
  return request<KnowledgeSearchResult[]>("/knowledge/list", {
    params: { limit, category },
  });
}

export async function searchKnowledge(
  q: string,
  limit?: number,
  category?: string,
  mode?: "hybrid" | "vector" | "keyword",
): Promise<KnowledgeSearchResult[]> {
  return request<KnowledgeSearchResult[]>("/knowledge/search", {
    params: { q, limit, category, mode },
  });
}

export async function uploadKnowledge(
  title: string,
  content: string,
  category?: string,
): Promise<KnowledgeSearchResult> {
  return request<KnowledgeSearchResult>("/knowledge/upload", {
    method: "POST",
    body: { title, content, category },
  });
}

export async function getLatestCompiled(): Promise<KnowledgeSearchResult | null> {
  return request<KnowledgeSearchResult | null>("/knowledge/compiled/latest");
}

export async function getCompileStatus(): Promise<KnowledgeCompileStatus> {
  return request<KnowledgeCompileStatus>("/knowledge/compile/status");
}

export async function compileKnowledge(
  force?: boolean,
  sourceLimit?: number,
): Promise<KnowledgeCompileResponse> {
  return request<KnowledgeCompileResponse>("/knowledge/compile", {
    method: "POST",
    body: { force: force ?? false, source_limit: sourceLimit ?? 120 },
  });
}

/* ===================== Trends 端点 ===================== */

export async function listTrends(
  limit?: number,
  platform?: string,
): Promise<TrendRead[]> {
  return request<TrendRead[]>("/trends/list", {
    params: { limit, platform },
  });
}

export async function getTrendReport(): Promise<TrendReport> {
  return request<TrendReport>("/trends/report");
}

export async function getKeywordAnalysis(
  platform?: string,
  limit?: number,
): Promise<KeywordAnalysisItem[]> {
  return request<KeywordAnalysisItem[]>("/trends/keywords", {
    params: { platform, limit },
  });
}

export async function getSearchTarget(
  platform: string,
  keyword: string,
): Promise<PlatformSearchTarget> {
  return request<PlatformSearchTarget>("/trends/search-target", {
    params: { platform, keyword },
  });
}

export async function linkImportTarget(
  rawText: string,
  maxLinks?: number,
  downloadMedia?: boolean,
): Promise<TrendLinkImportTarget> {
  return request<TrendLinkImportTarget>("/trends/link-import-target", {
    method: "POST",
    body: {
      raw_text: rawText,
      max_links: maxLinks ?? 10,
      download_media: downloadMedia ?? false,
    },
  });
}

export async function createCollectionJob(
  payload: CollectionJobPayload,
): Promise<TrendCollectionJobRead> {
  return request<TrendCollectionJobRead>("/trends/jobs", {
    method: "POST",
    body: payload,
  });
}

export async function listCollectionJobs(
  limit?: number,
): Promise<TrendCollectionJobRead[]> {
  return request<TrendCollectionJobRead[]>("/trends/jobs", {
    params: { limit },
  });
}

export async function getCollectionJob(
  jobId: number,
): Promise<TrendCollectionJobRead> {
  return request<TrendCollectionJobRead>(`/trends/jobs/${jobId}`);
}

export async function startCollectionJob(
  jobId: number,
): Promise<TrendCollectionJobRead> {
  return request<TrendCollectionJobRead>(`/trends/jobs/${jobId}/start`, {
    method: "POST",
  });
}

export async function createKnowledgeDigest(
  payload: KnowledgeDigestPayload,
): Promise<TrendKnowledgeDigestResponse> {
  return request<TrendKnowledgeDigestResponse>("/trends/knowledge-digest", {
    method: "POST",
    body: payload,
  });
}

export async function collectTrend(
  payload: TrendCollectPayload,
): Promise<TrendRead> {
  return request<TrendRead>("/trends/collect", {
    method: "POST",
    body: payload,
  });
}

export async function deleteTrend(trendId: number): Promise<void> {
  await request<void>(`/trends/${trendId}`, {
    method: "DELETE",
  });
}

export async function reviewVideo(
  trendId: number,
  reviewStatus: "approved" | "rejected",
  transcript?: string,
): Promise<TrendVideoReviewResponse> {
  return request<TrendVideoReviewResponse>(
    `/trends/${trendId}/video-review`,
    {
      method: "POST",
      body: { review_status: reviewStatus, transcript },
    },
  );
}


/* ===================== Generate (AI写手) 端点 ===================== */

export interface RoleTypeAccount {
  id: string;
  name: string;
  role_type: string;
  role_type_id: string;
  description: string;
  post_count: number;
  avg_likes: number;
  cover_style: string;
  sample_titles: string[];
}

export interface RoleType {
  id: string;
  name: string;
  description: string;
  accounts: RoleTypeAccount[];
}

export interface GenerateDraftResponse {
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

export async function listGenerateProfiles(): Promise<RoleType[]> {
  return request<RoleType[]>("/generate/profiles");
}

export async function listProfilesByType(
  roleTypeId: string,
): Promise<RoleTypeAccount[]> {
  return request<RoleTypeAccount[]>(`/generate/profiles/${roleTypeId}`);
}

export async function generateDraft(
  profileId: string,
  topic: string,
  extraContext?: string,
  generateCoverPrompt?: boolean,
): Promise<GenerateDraftResponse> {
  return request<GenerateDraftResponse>("/generate/draft", {
    method: "POST",
    body: {
      profile_id: profileId,
      topic,
      extra_context: extraContext || null,
      generate_cover_prompt: generateCoverPrompt ?? true,
    },
  });
}
