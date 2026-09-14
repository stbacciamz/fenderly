# Backend One-Pager

This document explains how the backend works for Fenderly, from request intake to AI response.

## Purpose

The backend exposes one endpoint, `POST /api/analyze`, that accepts an image (upload or URL), validates and normalizes it, sends it to Claude with a strict schema, and returns structured JSON suitable for UI rendering and downstream integrations.

## Runtime and Entry Point

- Route: `app/api/analyze/route.ts`
- Runtime: Node.js (`export const runtime = "nodejs"`)
- Max route duration: 120 seconds (`export const maxDuration = 120`)

Node runtime is required because the route uses the Anthropic SDK and Buffer operations.

## Request Contract

Endpoint accepts `multipart/form-data` with:

- `image` (File): JPEG/PNG/WebP/GIF, max 10 MB
- `imageUrl` (string): public `http(s)` URL to an image
- `context` (string, optional): additional claimant/adjuster notes

Exactly one of `image` or `imageUrl` is expected. If both are missing, the route returns HTTP 400.

## Processing Flow

1. Verify server config
- Checks `ANTHROPIC_API_KEY` early.
- If missing, returns HTTP 500 with a clear setup error.

2. Parse form data
- Calls `req.formData()`.
- If parsing fails or request is not multipart, returns HTTP 400.

3. Build image payload
- If `image` file is present, `imageFromFile()`:
  - enforces max size (10 MB),
  - validates media type,
  - converts bytes to base64.
- If `imageUrl` is provided, `imageFromUrl()`:
  - validates URL shape and `http/https` protocol,
  - fetches server-side with a 15s timeout,
  - validates response content type,
  - enforces max size (10 MB),
  - converts bytes to base64.

4. Call AI analyzer
- Invokes `analyzeDamage(image, context)` from `lib/analyze.ts`.
- On success, returns JSON `{ analysis, meta }`.
- On failure, maps Anthropic errors to user-friendly messages and returns HTTP 502.

## AI Layer

Core file: `lib/analyze.ts`

### Model configuration

- `MODEL`: from `CLAUDE_MODEL` env, default `claude-opus-5`
- `EFFORT`: from `CLAUDE_EFFORT` env, default `high`

### Prompting strategy

A single system prompt frames the model as a senior US auto appraiser and sets rules for:

- conservative vehicle identification,
- visible vs likely hidden damage separation,
- realistic cost assumptions,
- non-vehicle image handling (`is_vehicle_image = false`).

Optional `context` is appended in user text to improve claim-specific reasoning.

### Structured output enforcement

- Uses `client.messages.parse(...)` with `output_config.format = zodOutputFormat(Analysis)`.
- `Analysis` schema lives in `lib/schema.ts`.
- If output does not conform, backend throws and returns an error instead of passing malformed JSON.

### Post-processing normalization

Before returning:

- rounds estimate values,
- guarantees `low_usd <= likely_usd <= high_usd`,
- clamps `identification_confidence` into `[0, 1]`.

This prevents inconsistent numeric ranges reaching the UI.

## Schema as Single Source of Truth

Core file: `lib/schema.ts`

Zod schema defines:

- vehicle identification block,
- damage summary and area-level severity,
- estimate totals and line items,
- image quality notes,
- recommended next steps.

The same schema serves three roles:

- AI output contract,
- API response typing,
- frontend type safety.

## Error Handling Model

Route-level behavior:

- HTTP 400: invalid input (missing image, bad URL, unsupported type, oversize)
- HTTP 500: server misconfiguration (missing API key)
- HTTP 502: upstream/model failures

Anthropic-specific mapping includes:

- authentication failures,
- rate limiting,
- bad request errors,
- generic API errors.

This keeps client messaging actionable while preserving backend simplicity.

## Operational Notes

- Upload limit is intentionally strict (10 MB) and the frontend downsizes images first.
- URL fetching is server-side for consistent bytes and broader compatibility.
- Current URL fetch behavior is suitable for prototype/demo use; production should add SSRF controls (allow-list/private-network protections).

## Success Response Shape

`POST /api/analyze` returns:

- `analysis`: schema-validated assessment payload
- `meta`:
  - model
  - effort
  - duration_ms
  - input_tokens
  - output_tokens

This gives the UI both business output and traceability metadata for latency/cost visibility.