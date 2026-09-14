import { z } from "zod";

/**
 * The contract between Claude, the API route, and the UI.
 *
 * This schema is passed to Claude as a structured-output format, so the model
 * is constrained to return exactly this shape. The same schema types the
 * response on the client.
 */

export const Severity = z.enum(["minor", "moderate", "severe", "total_loss"]);
export type Severity = z.infer<typeof Severity>;

/**
 * Where a damaged area sits in the photo, as fractions of image width and
 * height (0 to 1, origin top-left). Used to draw an overlay on the preview.
 */
export const BoundingBox = z.object({
  x: z.number().describe("Left edge as a fraction of image width, 0 to 1."),
  y: z.number().describe("Top edge as a fraction of image height, 0 to 1."),
  w: z.number().describe("Width as a fraction of image width, 0 to 1."),
  h: z.number().describe("Height as a fraction of image height, 0 to 1."),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

export const DamageArea = z.object({
  location: z
    .string()
    .describe("Panel or component, e.g. 'Rear bumper, left side', 'Front passenger door'"),
  damage_type: z
    .string()
    .describe("Short type, e.g. 'dent', 'scratch', 'crack', 'crumple', 'broken glass', 'misalignment'"),
  description: z.string().describe("One or two sentences describing what is visible."),
  severity: Severity,
  bbox: BoundingBox.nullable().describe(
    "Loose box around this damaged area in the photo. Null if it cannot be located.",
  ),
});
export type DamageArea = z.infer<typeof DamageArea>;

export const LineItem = z.object({
  item: z.string().describe("Part or operation, e.g. 'Rear bumper cover'"),
  operation: z
    .enum(["repair", "replace", "refinish", "labor", "diagnostic", "other"])
    .describe("What is being done."),
  cost_low_usd: z.number().describe("Low end of the estimate for this item."),
  cost_high_usd: z.number().describe("High end of the estimate for this item."),
});

export const Analysis = z.object({
  is_vehicle_image: z
    .boolean()
    .describe("False if the image does not clearly show a car, truck, van, or SUV."),
  vehicle: z.object({
    make: z.string().describe("Manufacturer, or 'Unknown' if it cannot be determined."),
    model: z.string().describe("Model name, or 'Unknown'."),
    year_range: z
      .string()
      .describe("Approximate model years, e.g. '2018-2021', or 'Unknown'."),
    color: z.string().describe("Primary exterior color as a plain word, e.g. 'Silver'."),
    body_type: z.string().describe("Sedan, SUV, pickup, hatchback, coupe, van, etc."),
    identification_confidence: z
      .number()
      .describe("0 to 1. How confident the make/model identification is."),
  }),
  damage: z.object({
    summary: z
      .string()
      .describe(
        "One or two sentences an adjuster would write, e.g. 'Left rear bumper dent with paint transfer and scratching; tail lamp intact.'",
      ),
    overall_severity: Severity,
    areas: z.array(DamageArea).describe("Each distinct damaged area that is visible."),
    likely_hidden_damage: z
      .array(z.string())
      .describe("Damage that is plausible but not visible, e.g. 'bumper reinforcement bar', 'parking sensors'."),
    drivable: z
      .boolean()
      .describe("Best judgement of whether the vehicle is safely drivable as pictured."),
    airbags_deployed: z.boolean().describe("True only if deployed airbags are visible."),
  }),
  estimate: z.object({
    currency: z.literal("USD"),
    low_usd: z.number().describe("Low end of the total repair estimate."),
    high_usd: z.number().describe("High end of the total repair estimate."),
    likely_usd: z.number().describe("Single most likely total."),
    line_items: z.array(LineItem),
    total_loss_risk: z
      .enum(["low", "medium", "high"])
      .describe("Likelihood repair cost approaches vehicle value."),
    assumptions: z
      .array(z.string())
      .describe("Assumptions behind the estimate: labor rate, OEM vs aftermarket parts, region, etc."),
  }),
  image_quality_notes: z
    .array(z.string())
    .describe("Anything limiting the assessment: blur, glare, partial view, low resolution. Empty if none."),
  recommended_next_steps: z
    .array(z.string())
    .describe("2 to 4 short actions for the adjuster, e.g. 'Request photo of the opposite side'."),
});

export type Analysis = z.infer<typeof Analysis>;

/** Shape returned by POST /api/analyze on success. */
export type AnalyzeResponse = {
  analysis: Analysis;
  meta: {
    model: string;
    effort: string;
    duration_ms: number;
    input_tokens: number;
    output_tokens: number;
  };
};
