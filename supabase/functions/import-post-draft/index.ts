/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
} as const;

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
} as const;

const DEFAULT_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const DEFAULT_CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507";
const DEFAULT_CEREBRAS_FALLBACK_MODEL = "gpt-oss-120b";
const FETCH_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 30_000;
const MAX_HTML_SIZE = 1_500_000;
const MAX_SOURCE_TEXT_LENGTH = 14_000;
const MAX_TITLE_LENGTH = 160;
const MAX_EXCERPT_LENGTH = 320;

type ImportBody = {
  note?: string;
  url?: string;
};

type TopicRow = {
  created_at: string;
  id: string;
  name: string;
  slug: string;
};

type PostDuplicateRow = {
  id: string;
  title: string | null;
};

type AiDraftPayload = {
  body_markdown: string;
  cover_image_url: string | null;
  excerpt: string;
  tags: string[];
  title: string;
  topic_slug: string | null;
  warnings: string[];
};

type ExtractedArticle = {
  excerpt: string;
  imageUrl: string | null;
  markdownSeed: string;
  sourceDomain: string;
  sourceUrl: string;
  text: string;
  title: string;
  warnings: string[];
};

class ImportError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "ImportError";
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

function getEnvWithFallback(primary: string, fallback?: string) {
  return Deno.env.get(primary) ?? (fallback ? Deno.env.get(fallback) : undefined);
}

function getServerEnv() {
  const url = getEnvWithFallback("PROJECT_URL", "SUPABASE_URL");
  const anon = getEnvWithFallback("ANON_KEY", "SUPABASE_ANON_KEY");
  const service = getEnvWithFallback("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const cerebrasKey = Deno.env.get("CEREBRAS_API_KEY");
  const cerebrasModel = Deno.env.get("CEREBRAS_MODEL")?.trim() || DEFAULT_CEREBRAS_MODEL;
  const cerebrasFallbackModel = Deno.env.get("CEREBRAS_FALLBACK_MODEL")?.trim() || DEFAULT_CEREBRAS_FALLBACK_MODEL;
  const cerebrasBaseUrl = (Deno.env.get("CEREBRAS_BASE_URL")?.trim() || DEFAULT_CEREBRAS_BASE_URL).replace(/\/+$/u, "");

  if (!url || !anon || !service) {
    throw new ImportError("CONFIG_MISSING", "Server misconfigured: Supabase env is missing.");
  }

  if (!cerebrasKey) {
    throw new ImportError("CONFIG_MISSING", "Server misconfigured: CEREBRAS_API_KEY is missing.");
  }

  try {
    const parsed = new URL(cerebrasBaseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new ImportError("CONFIG_MISSING", "Server misconfigured: CEREBRAS_BASE_URL is invalid.");
  }

  return { anon, cerebrasBaseUrl, cerebrasFallbackModel, cerebrasKey, cerebrasModel, service, url };
}

function assertHttpMethod(request: Request) {
  if (request.method !== "POST") {
    throw new ImportError("METHOD_NOT_ALLOWED", "Method not allowed.");
  }
}

async function parseBody(request: Request): Promise<ImportBody> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new ImportError("INVALID_JSON", "Request body must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ImportError("INVALID_BODY", "Request body is invalid.");
  }

  const body = parsed as ImportBody;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!url) {
    throw new ImportError("URL_REQUIRED", "Укажите URL статьи для импорта.");
  }

  return {
    note: note ? note.slice(0, 1_500) : undefined,
    url,
  };
}

function normalizeUrl(raw: string) {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new ImportError("URL_INVALID", "URL невалидный. Укажите полный адрес со схемой https://.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ImportError("URL_INVALID", "Поддерживаются только HTTP(S) URL.");
  }

  if (parsed.username || parsed.password) {
    throw new ImportError("URL_INVALID", "URL с логином/паролем не поддерживается.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new ImportError("URL_INVALID", "URL не содержит hostname.");
  }

  if (isBlockedHostname(hostname)) {
    throw new ImportError("URL_BLOCKED", "URL указывает на недоступный/внутренний адрес.");
  }

  parsed.hostname = hostname;
  parsed.hash = "";

  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  const cleanedQuery = new URLSearchParams();
  const keysToDrop = ["fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "s", "share"];
  for (const [key, value] of parsed.searchParams.entries()) {
    const lowered = key.toLowerCase();
    if (lowered.startsWith("utm_") || keysToDrop.includes(lowered)) {
      continue;
    }

    cleanedQuery.append(key, value);
  }

  parsed.search = cleanedQuery.toString();

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }

  return {
    hostname,
    normalizedUrl: parsed.toString(),
  };
}

function isBlockedHostname(hostname: string) {
  if (
    hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
  ) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/u.test(hostname)) {
    const parts = hostname.split(".").map((value) => Number(value));
    if (parts.length !== 4 || parts.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
      return true;
    }

    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }

    if (a === 169 && b === 254) {
      return true;
    }

    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    if (a === 192 && b === 168) {
      return true;
    }
  }

  // Block direct IPv6 literals for v1 import.
  if (hostname.includes(":")) {
    return true;
  }

  return false;
}

async function requireEditorOrAdmin(supabaseUrl: string, anonKey: string, authorization: string) {
  const asUser = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });

  const {
    data: authData,
    error: authError,
  } = await asUser.auth.getUser();

  if (authError || !authData.user?.id) {
    throw new ImportError("UNAUTHORIZED", "Требуется авторизация.");
  }

  const userId = authData.user.id;
  const {
    data: profile,
    error: profileError,
  } = await asUser
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new ImportError("FORBIDDEN", "Профиль не найден.");
  }

  if (profile.role !== "admin" && profile.role !== "editor") {
    throw new ImportError("FORBIDDEN", "Доступно только редакторам и администраторам.");
  }

  return { userId };
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.7,*/*;q=0.1",
        "User-Agent": "DevLabsNewsBot/1.0 (+manual-ai-import)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ImportError("FETCH_FAILED", `Источник недоступен: HTTP ${response.status}.`);
    }

    const html = await response.text();
    if (!html || !html.trim()) {
      throw new ImportError("EXTRACTION_EMPTY", "Не удалось получить HTML страницы.");
    }

    return {
      html: html.slice(0, MAX_HTML_SIZE),
      responseUrl: response.url || url,
    };
  } catch (error) {
    if (error instanceof ImportError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ImportError("FETCH_TIMEOUT", "Источник не ответил вовремя.");
    }

    throw new ImportError("FETCH_FAILED", "Не удалось загрузить страницу источника.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function getMetaContent(doc: Document, key: string) {
  const byName = doc.querySelector(`meta[name="${key}"]`)?.getAttribute("content")?.trim();
  if (byName) {
    return byName;
  }

  const byProperty = doc.querySelector(`meta[property="${key}"]`)?.getAttribute("content")?.trim();
  if (byProperty) {
    return byProperty;
  }

  return "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

function extractArticleData(html: string, sourceUrl: string, sourceDomain: string): ExtractedArticle {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new ImportError("EXTRACTION_FAILED", "Не удалось распарсить HTML страницы.");
  }

  doc.querySelectorAll("script, style, noscript, svg, iframe, form, nav, footer, header, aside").forEach((node) => node.remove());

  const metaTitle = getMetaContent(doc, "og:title") || getMetaContent(doc, "twitter:title");
  const titleTag = normalizeWhitespace(doc.querySelector("title")?.textContent ?? "");
  const h1 = normalizeWhitespace(doc.querySelector("h1")?.textContent ?? "");
  const title = [metaTitle, h1, titleTag].find((value) => value.length > 0) ?? "Материал без заголовка";

  const metaExcerpt = getMetaContent(doc, "description") || getMetaContent(doc, "og:description");
  const imageCandidate = getMetaContent(doc, "og:image") || getMetaContent(doc, "twitter:image");
  const imageUrl = imageCandidate ? toAbsoluteUrl(imageCandidate, sourceUrl) : null;

  const candidates = [
    doc.querySelector("article"),
    doc.querySelector("main"),
    doc.querySelector('[role="main"]'),
    doc.body,
  ].filter((node): node is Element => Boolean(node));

  const blocksByScore = candidates.map((candidate) => {
    const blocks = Array.from(candidate.querySelectorAll("h2, h3, p, li, blockquote, pre"))
      .map((node) => normalizeWhitespace(node.textContent ?? ""))
      .filter((value) => value.length >= 40);

    const text = blocks.join("\n\n");
    return { blocks, score: text.length };
  }).sort((left, right) => right.score - left.score);

  const selectedBlocks = blocksByScore[0]?.blocks ?? [];
  let text = selectedBlocks.join("\n\n").trim();

  if (!text) {
    text = normalizeWhitespace(doc.body?.textContent ?? "");
  }

  if (text.length < 350) {
    throw new ImportError("EXTRACTION_EMPTY", "Не удалось извлечь достаточно текста из статьи.");
  }

  const firstParagraph = selectedBlocks[0] ?? text.slice(0, 400);
  const excerpt = metaExcerpt || firstParagraph;
  const markdownSeed = selectedBlocks.length > 0
    ? selectedBlocks.join("\n\n")
    : text.replace(/([.!?])\s+/gu, "$1\n\n");

  const warnings: string[] = [];
  if (!metaTitle) {
    warnings.push("Не найден og:title, использован заголовок страницы.");
  }

  if (!metaExcerpt) {
    warnings.push("Не найден meta description, анонс сформирован из текста.");
  }

  return {
    excerpt: excerpt.slice(0, 700),
    imageUrl,
    markdownSeed: markdownSeed.slice(0, 18_000),
    sourceDomain,
    sourceUrl,
    text: text.slice(0, 20_000),
    title: title.slice(0, 280),
    warnings,
  };
}

function readJsonObject(rawContent: string) {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    throw new ImportError("AI_INVALID", "AI вернул пустой ответ.");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced) as unknown;
      } catch {
        // no-op
      }
    }

    throw new ImportError("AI_INVALID", "AI вернул невалидный JSON.");
  }
}

function sanitizeTitle(value: string, fallback: string) {
  const candidate = normalizeWhitespace(value || fallback).slice(0, MAX_TITLE_LENGTH);
  return candidate.length >= 3 ? candidate : fallback.slice(0, MAX_TITLE_LENGTH);
}

function sanitizeExcerpt(value: string, fallback: string) {
  const candidate = normalizeWhitespace(value || fallback).slice(0, MAX_EXCERPT_LENGTH);
  if (candidate.length > 0) {
    return candidate;
  }

  return normalizeWhitespace(fallback).slice(0, MAX_EXCERPT_LENGTH);
}

function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function parseAiDraftPayload(input: unknown, extracted: ExtractedArticle): AiDraftPayload {
  if (!input || typeof input !== "object") {
    throw new ImportError("AI_INVALID", "AI вернул невалидную структуру.");
  }

  const payload = input as Record<string, unknown>;
  const bodyMarkdownRaw = typeof payload.body_markdown === "string" ? payload.body_markdown.trim() : "";
  const topicSlugRaw = typeof payload.topic_slug === "string" ? payload.topic_slug.trim() : "";
  const titleRaw = typeof payload.title === "string" ? payload.title : "";
  const excerptRaw = typeof payload.excerpt === "string" ? payload.excerpt : "";
  const coverImageRaw = normalizeOptionalUrl(payload.cover_image_url);
  const tagsRaw = Array.isArray(payload.tags) ? payload.tags : [];
  const warningsRaw = Array.isArray(payload.warnings) ? payload.warnings : [];

  const warnings = warningsRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 0)
    .slice(0, 10);

  const tags = tagsRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 0)
    .slice(0, 8);

  const bodyMarkdown = bodyMarkdownRaw.length >= 200
    ? bodyMarkdownRaw
    : extracted.markdownSeed;

  if (bodyMarkdown.length < 180) {
    throw new ImportError("AI_INVALID", "AI вернул слишком короткий текст статьи.");
  }

  return {
    body_markdown: bodyMarkdown.slice(0, 50_000),
    cover_image_url: coverImageRaw ?? extracted.imageUrl,
    excerpt: sanitizeExcerpt(excerptRaw, extracted.excerpt),
    tags,
    title: sanitizeTitle(titleRaw, extracted.title),
    topic_slug: topicSlugRaw || null,
    warnings,
  };
}

type AiTransformResult = {
  aiModelUsed: string;
  aiModelsTried: string[];
  aiWasFallback: boolean;
  draft: AiDraftPayload;
};

function isRetryableAiError(error: ImportError) {
  return error.code === "AI_FAILED"
    || error.code === "AI_INVALID"
    || error.code === "AI_MODEL_UNAVAILABLE"
    || error.code === "AI_NETWORK"
    || error.code === "AI_PROVIDER_ERROR"
    || error.code === "AI_RATE_LIMIT"
    || error.code === "AI_TIMEOUT";
}

function toAiErrorCode(responseStatus: number, errorText: string) {
  const loweredError = errorText.toLowerCase();
  if (responseStatus === 429) {
    return "AI_RATE_LIMIT";
  }

  if (responseStatus === 408 || responseStatus === 504) {
    return "AI_TIMEOUT";
  }

  if (responseStatus >= 500) {
    return "AI_PROVIDER_ERROR";
  }

  if (
    responseStatus === 404
    || ((responseStatus === 400 || responseStatus === 422) && loweredError.includes("model"))
  ) {
    return "AI_MODEL_UNAVAILABLE";
  }

  return "AI_FAILED";
}

function failAllAiModels(attempts: Array<{ code: string; message: string; model: string }>, modelsTried: string[], message: string) {
  const lastAttempt = attempts[attempts.length - 1];
  const messageWithReason = lastAttempt
    ? `${message} Last error: ${lastAttempt.code} (${lastAttempt.model}).`
    : message;

  throw new ImportError("AI_ALL_MODELS_FAILED", messageWithReason, {
    aiAttempts: attempts,
    aiModelsTried: modelsTried,
    aiFailureReason: messageWithReason,
  });
}

async function callAiModel(
  cerebrasKey: string,
  cerebrasBaseUrl: string,
  model: string,
  prompt: string,
  extracted: ExtractedArticle,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${cerebrasBaseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          {
            content:
              "You are the Dev-labs-news editorial assistant. Create drafts for manual moderation only. Never publish automatically.",
            role: "system",
          },
          {
            content: prompt,
            role: "user",
          },
        ],
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      headers: {
        "Authorization": `Bearer ${cerebrasKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      const code = toAiErrorCode(response.status, errorText);
      throw new ImportError(code, `AI API error (${model}): ${response.status}. ${errorText}`);
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = readJsonObject(content);
    return parseAiDraftPayload(parsed, extracted);
  } catch (error) {
    if (error instanceof ImportError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ImportError("AI_TIMEOUT", `AI request timed out for model ${model}.`);
    }

    throw new ImportError(
      "AI_NETWORK",
      `Failed to call AI provider for model ${model}: ${error instanceof Error ? error.message : "Unknown network error."}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function transformWithAi(
  cerebrasKey: string,
  cerebrasBaseUrl: string,
  primaryModel: string,
  fallbackModel: string,
  extracted: ExtractedArticle,
  topics: TopicRow[],
  editorNote?: string,
): Promise<AiTransformResult> {
  const normalizedPrimaryModel = primaryModel.trim() || DEFAULT_CEREBRAS_MODEL;
  const normalizedFallbackModel = fallbackModel.trim() || DEFAULT_CEREBRAS_FALLBACK_MODEL;
  const topicsPrompt = topics.map((topic) => `- ${topic.slug}: ${topic.name}`).join("\n");
  const sourceText = extracted.text.slice(0, MAX_SOURCE_TEXT_LENGTH);
  const noteSection = editorNote ? `\nEDITOR_NOTE:\n${editorNote}\n` : "";
  const attempts: Array<{ code: string; message: string; model: string }> = [];
  const aiModelsTried: string[] = [];

  const prompt = [
    "Prepare an editorial news draft from the source article.",
    "Return only a JSON object, no markdown wrapper.",
    "Do not invent facts, dates, or numbers missing in the source.",
    "If data is missing, keep fields empty and add a warning in warnings.",
    "",
    "JSON schema:",
    "{",
    '  "title": "string, 3..160",',
    '  "excerpt": "string, up to 320 chars",',
    '  "body_markdown": "string, structured markdown article body",',
    '  "topic_slug": "string|null, one of available topics",',
    '  "tags": ["string"],',
    '  "cover_image_url": "string|null",',
    '  "warnings": ["string"]',
    "}",
    "",
    "Available topics:",
    topicsPrompt,
    "",
    `SOURCE_URL: ${extracted.sourceUrl}`,
    `SOURCE_DOMAIN: ${extracted.sourceDomain}`,
    `SOURCE_TITLE: ${extracted.title}`,
    `SOURCE_EXCERPT: ${extracted.excerpt}`,
    noteSection,
    "SOURCE_TEXT:",
    sourceText,
  ].join("\n");

  const runModel = async (modelName: string) => {
    aiModelsTried.push(modelName);
    try {
      return await callAiModel(cerebrasKey, cerebrasBaseUrl, modelName, prompt, extracted);
    } catch (error) {
      if (error instanceof ImportError) {
        attempts.push({
          code: error.code,
          message: error.message.slice(0, 300),
          model: modelName,
        });
      }

      throw error;
    }
  };

  try {
    const draft = await runModel(normalizedPrimaryModel);
    return {
      aiModelUsed: normalizedPrimaryModel,
      aiModelsTried,
      aiWasFallback: false,
      draft,
    };
  } catch (primaryError) {
    if (!(primaryError instanceof ImportError)) {
      throw primaryError;
    }

    if (!isRetryableAiError(primaryError)) {
      throw primaryError;
    }

    if (normalizedFallbackModel === normalizedPrimaryModel) {
      failAllAiModels(
        attempts,
        aiModelsTried,
        `Primary model failed and fallback model matches primary (${normalizedPrimaryModel}).`,
      );
    }
  }

  try {
    const draft = await runModel(normalizedFallbackModel);
    return {
      aiModelUsed: normalizedFallbackModel,
      aiModelsTried,
      aiWasFallback: true,
      draft,
    };
  } catch (fallbackError) {
    if (fallbackError instanceof ImportError) {
      failAllAiModels(attempts, aiModelsTried, "Primary and fallback AI models failed.");
    }

    throw fallbackError;
  }
}

function normalizeTitleForSoftDedupe(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

async function findDuplicateBySourceUrl(
  serviceClient: any,
  sourceUrl: string,
) {
  const { data, error } = await serviceClient
    .from("posts")
    .select("id, title")
    .eq("source_url", sourceUrl)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new ImportError("DB_ERROR", `Failed to check duplicates. ${error.message}`);
  }

  const first = (data ?? [])[0] as PostDuplicateRow | undefined;
  return first ?? null;
}

async function findSoftDuplicateByTitle(
  serviceClient: any,
  sourceDomain: string,
  title: string,
) {
  const normalizedTitle = normalizeTitleForSoftDedupe(title);
  if (!normalizedTitle) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("posts")
    .select("id, title")
    .eq("source_domain", sourceDomain)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new ImportError("DB_ERROR", `Failed to check soft duplicates. ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; title: string | null }>;
  for (const row of rows) {
    if (!row.title) {
      continue;
    }

    if (normalizeTitleForSoftDedupe(row.title) === normalizedTitle) {
      return row;
    }
  }

  return null;
}

function buildDraftContent(aiDraft: AiDraftPayload, extracted: ExtractedArticle, editorNote?: string) {
  const parts: string[] = [];
  parts.push(aiDraft.body_markdown.trim());
  parts.push("---");
  parts.push(`Источник: [${extracted.sourceDomain}](${extracted.sourceUrl})`);
  parts.push("Статус: AI draft (требуется ручная редакторская проверка перед публикацией).");

  if (editorNote) {
    parts.push(`Заметка редактора: ${editorNote}`);
  }

  if (aiDraft.tags.length > 0) {
    parts.push(`Теги (черновик): ${aiDraft.tags.join(", ")}`);
  }

  return parts.join("\n\n");
}

serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }

  try {
    assertHttpMethod(request);

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse({ code: "UNAUTHORIZED", message: "Missing Authorization header.", ok: false }, 401);
    }

    const body = await parseBody(request);
    const { anon, cerebrasBaseUrl, cerebrasFallbackModel, cerebrasKey, cerebrasModel, service, url } = getServerEnv();
    const access = await requireEditorOrAdmin(url, anon, authorization);

    const { normalizedUrl } = normalizeUrl(body.url ?? "");
    const serviceClient = createClient(url, service, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const duplicateByUrl = await findDuplicateBySourceUrl(serviceClient, normalizedUrl);
    if (duplicateByUrl) {
      return jsonResponse({
        code: "DUPLICATE",
        existingPostId: duplicateByUrl.id,
        existingPostTitle: duplicateByUrl.title,
        message: "Материал с этим source URL уже импортирован.",
        ok: false,
      });
    }

    const fetched = await fetchHtml(normalizedUrl);
    const fetchedNormalized = normalizeUrl(fetched.responseUrl || normalizedUrl);
    const canonicalSourceUrl = fetchedNormalized.normalizedUrl;
    const canonicalSourceDomain = fetchedNormalized.hostname;

    if (canonicalSourceUrl !== normalizedUrl) {
      const duplicateByCanonicalUrl = await findDuplicateBySourceUrl(serviceClient, canonicalSourceUrl);
      if (duplicateByCanonicalUrl) {
        return jsonResponse({
          code: "DUPLICATE",
          existingPostId: duplicateByCanonicalUrl.id,
          existingPostTitle: duplicateByCanonicalUrl.title,
          message: "Материал с этим source URL уже импортирован.",
          ok: false,
        });
      }
    }

    const extracted = extractArticleData(fetched.html, canonicalSourceUrl, canonicalSourceDomain);
    const softDuplicate = await findSoftDuplicateByTitle(serviceClient, canonicalSourceDomain, extracted.title);
    if (softDuplicate) {
      return jsonResponse({
        code: "DUPLICATE_SOFT",
        existingPostId: softDuplicate.id,
        existingPostTitle: softDuplicate.title,
        message: "Похожий материал из этого источника уже есть в контуре.",
        ok: false,
      });
    }

    const { data: topicsData, error: topicsError } = await serviceClient
      .from("topics")
      .select("id, slug, name, created_at")
      .order("created_at", { ascending: true });

    if (topicsError) {
      throw new ImportError("DB_ERROR", `Failed to load topics. ${topicsError.message}`);
    }

    const topics = (topicsData ?? []) as TopicRow[];
    if (topics.length === 0) {
      throw new ImportError("TOPICS_EMPTY", "В системе нет разделов для сохранения черновика.");
    }

    const aiTransform = await transformWithAi(
      cerebrasKey,
      cerebrasBaseUrl,
      cerebrasModel,
      cerebrasFallbackModel,
      extracted,
      topics,
      body.note,
    );
    const aiDraft = aiTransform.draft;
    const topicBySlug = new Map(topics.map((topic) => [topic.slug.toLowerCase(), topic]));
    const suggestedTopic = aiDraft.topic_slug ? topicBySlug.get(aiDraft.topic_slug.toLowerCase()) : null;
    const selectedTopic = suggestedTopic ?? topics[0];

    const warnings = [
      ...extracted.warnings,
      ...aiDraft.warnings,
    ];

    if (!suggestedTopic) {
      warnings.push("AI не выбрал валидный раздел, применен раздел по умолчанию.");
    }

    const draftContent = buildDraftContent(aiDraft, extracted, body.note);
    const { data: inserted, error: insertError } = await serviceClient
      .from("posts")
      .insert({
        author_id: access.userId,
        content: draftContent,
        cover_url: aiDraft.cover_image_url ?? extracted.imageUrl ?? null,
        excerpt: aiDraft.excerpt || null,
        import_note: body.note ?? null,
        import_origin: "manual_import_ai",
        is_published: false,
        source_domain: canonicalSourceDomain,
        source_url: canonicalSourceUrl,
        title: aiDraft.title,
        topic_id: selectedTopic.id,
      })
      .select("id, title")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const duplicate = await findDuplicateBySourceUrl(serviceClient, canonicalSourceUrl);
        if (duplicate) {
          return jsonResponse({
            code: "DUPLICATE",
            existingPostId: duplicate.id,
            existingPostTitle: duplicate.title,
            message: "Материал с этим source URL уже импортирован.",
            ok: false,
          });
        }
      }

      throw new ImportError("DB_ERROR", `Не удалось сохранить черновик. ${insertError.message}`);
    }

    return jsonResponse({
      ok: true,
      post: {
        id: inserted.id,
        title: inserted.title,
      },
      aiModelUsed: aiTransform.aiModelUsed,
      aiModelsTried: aiTransform.aiModelsTried,
      aiWasFallback: aiTransform.aiWasFallback,
      sourceDomain: canonicalSourceDomain,
      sourceUrl: canonicalSourceUrl,
      warnings: [...new Set(warnings)].slice(0, 12),
    });
  } catch (error) {
    if (error instanceof ImportError) {
      return jsonResponse({
        code: error.code,
        details: error.details,
        message: error.message,
        ok: false,
      });
    }

    console.error("import-post-draft failed", error);
    return jsonResponse({
      code: "INTERNAL_ERROR",
      message: "Внутренняя ошибка импорта. Повторите попытку позже.",
      ok: false,
    });
  }
});

