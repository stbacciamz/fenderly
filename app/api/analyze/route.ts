import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  analyzeDamage,
  SUPPORTED_MEDIA_TYPES,
  type ImageInput,
  type SupportedMediaType,
} from "@/lib/analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB (client downscales before upload)

/**
 * POST /api/analyze
 *
 * Accepts multipart/form-data with either:
 *   - `image`: an image file, or
 *   - `imageUrl`: a public image URL
 * and an optional `context` text field.
 *
 * Returns { analysis, meta } (see lib/schema.ts) or { error }.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Copy .env.example to .env.local and add a key." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const context = typeof form.get("context") === "string" ? (form.get("context") as string) : "";

  let image: ImageInput;
  try {
    const file = form.get("image");
    const imageUrl = form.get("imageUrl");
    if (file instanceof File && file.size > 0) {
      image = await imageFromFile(file);
    } else if (typeof imageUrl === "string" && imageUrl.trim()) {
      image = await imageFromUrl(imageUrl.trim());
    } else {
      return NextResponse.json({ error: "Provide an image file or an image URL." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  try {
    const result = await analyzeDamage(image, context);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 502 });
  }
}

async function imageFromFile(file: File): Promise<ImageInput> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is larger than 10 MB. Please upload a smaller photo.");
  }
  const mediaType = normalizeMediaType(file.type);
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  return { data, mediaType };
}

async function imageFromUrl(url: string): Promise<ImageInput> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That does not look like a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) image URLs are supported.");
  }

  // Fetch server-side so the model always receives the same bytes the user
  // previewed, and so hosts that block third-party fetches still work.
  const res = await fetch(parsed, {
    headers: { "User-Agent": "fenderly/0.1 (prototype)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Could not download the image (HTTP ${res.status}).`);
  }
  const contentType = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
  const mediaType = normalizeMediaType(contentType);
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image at that URL is larger than 10 MB.");
  }
  return { data: bytes.toString("base64"), mediaType };
}

function normalizeMediaType(type: string): SupportedMediaType {
  const t = type === "image/jpg" ? "image/jpeg" : type;
  if (!SUPPORTED_MEDIA_TYPES.includes(t as SupportedMediaType)) {
    throw new Error(
      `Unsupported image type "${type || "unknown"}". Use JPEG, PNG, WebP, or GIF.`,
    );
  }
  return t as SupportedMediaType;
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The AI service is rate-limited right now. Please retry in a moment.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `The AI service rejected the request: ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `AI service error (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : "Unexpected error.";
}
