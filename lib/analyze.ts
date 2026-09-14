import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Analysis, type AnalyzeResponse, type BoundingBox } from "./schema";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";
export const EFFORT = (process.env.CLAUDE_EFFORT ?? "high") as
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type SupportedMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export const SUPPORTED_MEDIA_TYPES: SupportedMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const SYSTEM_PROMPT = `You are a senior auto physical-damage appraiser working for a US auto insurer. You review claim photos and produce a first-pass assessment that a human adjuster will verify.

How to work:
- Identify the vehicle from visible cues: badges, grille and lamp shapes, body lines, wheel design, interior details. If unsure between candidates, pick the most likely and lower identification_confidence. Never invent a make or model when the image gives no basis; use "Unknown" instead.
- Describe only damage you can actually see. Distinguish clearly between visible damage and likely hidden damage.
- For each damaged area, give a bbox locating it in the photo: x, y, w, h as fractions of image width and height (0 to 1), origin at the top-left corner. Before committing, check that the box actually contains the damaged surface itself (the dent, scuff, or crack), then pad it so it covers the affected panel; when unsure, make the box larger rather than shifting it. Use null only if the area is not visible in the frame.
- Report the color as the car's paint color, not the lighting.
- Estimate repair cost for a typical US independent body shop: parts (OEM list price unless the vehicle is older than 10 years, then aftermarket where common), body labor at about $60-75/hour, paint and materials, and paint blend of adjacent panels where a refinish is needed. Give a realistic range and state your assumptions. Costs are in USD.
- If the photo does not clearly show a road vehicle, set is_vehicle_image to false, describe what you see in damage.summary, and return zero-cost estimates with empty line items.
- Be concise and concrete. Write like an appraisal note, not an essay.`;

export type ImageInput = {
  data: string; // base64, no data: prefix
  mediaType: SupportedMediaType;
};

export async function analyzeDamage(
  image: ImageInput,
  context?: string,
): Promise<AnalyzeResponse> {
  const client = new Anthropic();
  const started = Date.now();

  const userText = context?.trim()
    ? `Assess the damage in this claim photo. Additional context from the claimant or adjuster: "${context.trim()}"`
    : "Assess the damage in this claim photo.";

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: EFFORT,
      format: zodOutputFormat(Analysis),
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.data },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `The model declined to analyze this image${
        response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."
      }`,
    );
  }

  if (!response.parsed_output) {
    throw new Error("The model returned a response that did not match the expected format.");
  }

  return {
    analysis: normalize(response.parsed_output),
    meta: {
      model: response.model,
      effort: EFFORT,
      duration_ms: Date.now() - started,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/** Light sanity pass so the UI never shows an inverted range or out-of-bounds confidence. */
function normalize(a: Analysis): Analysis {
  const areas = a.damage.areas.map((area) => ({ ...area, bbox: clampBox(area.bbox) }));
  const low = Math.max(0, Math.min(a.estimate.low_usd, a.estimate.high_usd));
  const high = Math.max(a.estimate.low_usd, a.estimate.high_usd, 0);
  const likely = Math.min(Math.max(a.estimate.likely_usd, low), high);
  return {
    ...a,
    vehicle: {
      ...a.vehicle,
      identification_confidence: Math.min(1, Math.max(0, a.vehicle.identification_confidence)),
    },
    damage: { ...a.damage, areas },
    estimate: {
      ...a.estimate,
      low_usd: Math.round(low),
      high_usd: Math.round(high),
      likely_usd: Math.round(likely),
    },
  };
}

/**
 * Clamp a box to the image frame and drop degenerate ones. Models sometimes
 * return pixel-ish or percentage values; anything outside 0-1 is treated as
 * unusable rather than guessed at.
 */
function clampBox(b: BoundingBox | null): BoundingBox | null {
  if (!b) return null;
  const vals = [b.x, b.y, b.w, b.h];
  if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) return null;
  const x = Math.min(b.x, 1);
  const y = Math.min(b.y, 1);
  const w = Math.min(b.w, 1 - x);
  const h = Math.min(b.h, 1 - y);
  if (w < 0.01 || h < 0.01) return null;
  return { x, y, w, h };
}
