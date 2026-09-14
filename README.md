# Fenderly — AI Vehicle Damage Assessment (prototype)

Upload a photo of a damaged car (or paste an image URL) and get back, on the same page:

- **Vehicle metadata** — make, model, approximate years, color, body type, and an identification confidence score
- **Damage summary** — an adjuster-style sentence, a per-area breakdown with severity, likely hidden damage, drivability and airbag flags
- **Damage map** — each damaged area drawn as a numbered box over the photo; hovering a box or its list entry highlights the other
- **Estimated repair cost** — a likely figure plus a low/high range, line items (parts, labor, refinish), total-loss risk, and the assumptions behind the numbers

Everything is produced by a single call to Claude (vision + structured outputs). The whole app is one Next.js project: a React page and one API route.

**Live demo:** https://fenderly.vercel.app

> Built for the Solutions Engineer take-home. Time-boxed to roughly four hours. The companion [Statement of Work](docs/SOW.md) describes how this would become a production claims-triage solution.

For implementation details of the server side, see the [Backend One-Pager](docs/BACKEND.md).

**Beyond the time box.** The application code, this README, and the first draft of the SOW were built inside the four-hour box. The remaining documents in [docs/](docs/) (architecture, production readiness, policy comparison, scaling) and the later SOW revisions were written afterwards in preparation for the walkthrough.

**Locale.** The prototype prices in USD for a US independent body shop, which keeps the demo self-contained. The SOW targets a European motor insurer; currency, labour rates, VAT, and repairer-network terms are localised during the engagement.

---

## 1. Setup

**Prerequisites:** Node.js 20+ and an Anthropic API key ([console.anthropic.com](https://console.anthropic.com/)).

```bash
git clone https://github.com/stbacciamz/fenderly.git
cd fenderly
npm install

cp .env.example .env.local
# open .env.local and set ANTHROPIC_API_KEY=sk-ant-...

npm run dev
# open http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

Optional environment variables (see `.env.example`):

| Variable            | Default         | Purpose                                                        |
| ------------------- | --------------- | -------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | —               | Required.                                                      |
| `CLAUDE_MODEL`      | `claude-opus-5` | Any Claude model with vision.                                  |
| `CLAUDE_EFFORT`     | `high`          | `low` / `medium` / `high` / `xhigh` / `max`. Lower is faster.  |

### Deploying

The project is a standard Next.js app and deploys to Vercel with no configuration: import the repo, add `ANTHROPIC_API_KEY` as an environment variable, deploy. The API route sets `maxDuration = 120` so slower analyses are not cut off. The browser downscales uploads to 1600 px before sending them, which keeps requests well under Vercel's 4.5 MB body limit.

---

## 2. Architecture

```
 Browser (app/page.tsx)                     Next.js API route                     Anthropic API
 ┌──────────────────────────┐   multipart   ┌──────────────────────────┐  HTTPS  ┌──────────────────┐
 │ drop zone / URL input    │ ────────────► │ POST /api/analyze        │ ──────► │ claude-opus-5    │
 │ client-side downscale    │  image|url    │  • validate + size-check │  image  │ vision +         │
 │ optional context text    │  + context    │  • fetch URL server-side │  + text │ structured output│
 │                          │               │  • base64 encode         │         │ (Zod schema)     │
 │ results cards + raw JSON │ ◄──────────── │  • lib/analyze.ts        │ ◄────── │                  │
 │ session history          │  JSON         │  • normalize + return    │  JSON   │                  │
 └──────────────────────────┘               └──────────────────────────┘         └──────────────────┘
```

| Layer     | What                                                                    | File                       |
| --------- | ----------------------------------------------------------------------- | -------------------------- |
| Front end | Single React client page: upload / URL tabs, preview, results, history  | `app/page.tsx`             |
| Styling   | Plain CSS with variables, no framework                                  | `app/globals.css`          |
| API       | Route handler: input validation, URL fetching, error mapping            | `app/api/analyze/route.ts` |
| AI logic  | System prompt, Claude call, response normalization                      | `lib/analyze.ts`           |
| Contract  | Zod schema shared by the model, the API, and the UI                     | `lib/schema.ts`            |

**Data flow**

1. The user drops a photo or pastes a URL. Uploaded photos are resized in the browser to a 1600 px long edge (phone photos are typically 12 MP; the model does not need more, and the upload is 5–10× smaller).
2. The page POSTs `multipart/form-data` to `/api/analyze` with `image` **or** `imageUrl`, plus an optional `context` string (e.g. "rear-ended at low speed").
3. The route validates the input. URLs are fetched server-side and base64-encoded so the model always sees the same bytes the user previewed and so hosts that block third-party fetches still work.
4. `analyzeDamage()` sends the image and the appraiser system prompt to Claude with `output_config.format` set from the Zod schema. The API guarantees the response matches the schema, so there is no JSON-repair code.
5. A small `normalize()` pass rounds figures and guarantees `low ≤ likely ≤ high`. The route returns `{ analysis, meta }`; `meta` carries model, effort, latency, and token counts for the footer.
6. The page renders the result as cards. The damage map draws each area's `bbox` (fractions of image width and height, origin top-left) over the preview as a percentage-positioned box, so it tracks the image at any width. "View JSON" shows the exact payload an integration would receive.

---

## 3. Design explanation

### Why these tools

- **Next.js (App Router) + TypeScript.** One repo, one deploy, one `npm run dev`. The API route runs on Node so the Anthropic SDK works unchanged, and the same project deploys to Vercel in a minute. For a customer demo that has to be turned around in a day, avoiding a separate backend service is the biggest time saver.
- **Claude Opus 5 with vision.** One model call does vehicle identification, damage description, and cost reasoning, so there is no pipeline to orchestrate and no per-task model to train. Opus is used rather than a smaller model because the estimate is a judgement task: it has to recognise a 1994 Mustang from a grille, reason about what a bent fender implies for the hood and headlamp, and price parts and labor. That is where model quality shows.
- **Structured outputs + Zod.** The schema in `lib/schema.ts` is the single source of truth: it is sent to the API as the output format, it types the server response, and it types the React props. The model cannot return a shape the UI does not handle, which removes an entire class of demo-day failures.
- **Plain CSS, no component library.** Faster to make look intentional than to fight a framework, and the whole UI is one readable file.

### How the AI logic works

The system prompt (`lib/analyze.ts`) frames Claude as a senior physical-damage appraiser at a US insurer and gives it working rules rather than a checklist:

- identify the vehicle from concrete cues (badges, lamp shapes, body lines) and lower `identification_confidence` rather than guess; return `Unknown` when there is no basis;
- describe only visible damage, and separate it from *likely hidden damage* (e.g. bumper reinforcement, parking sensors) so an adjuster knows what to inspect;
- price for a typical independent body shop with stated labor rates, OEM vs aftermarket parts by vehicle age, and paint blending of adjacent panels, and list those assumptions explicitly;
- locate each damaged area with a loose bounding box, checked to contain the damage itself and padded to the affected panel; `null` when the area is out of frame. `normalize()` drops any box outside the 0–1 frame rather than guessing;
- flag non-vehicle photos with `is_vehicle_image = false` instead of hallucinating a car.

The structured-output schema then forces the answer into a fixed shape with descriptive field docs, which does much of the prompting work: the model knows it must produce `line_items` with an `operation` of repair/replace/refinish, a `total_loss_risk`, and `recommended_next_steps`. Adaptive thinking is on (the default for Opus 5), so the model reasons before committing to figures; `CLAUDE_EFFORT` trades that depth against latency.

The optional context field lets a user add what a claimant would say on a first-notice-of-loss call ("rear-ended in a parking lot, 2019 Civic"). It is appended to the user turn and noticeably improves make/model identification and the plausibility of hidden-damage calls.

### What I would do with more time

**Product**
- Multi-photo claims: several angles of the same vehicle in one request, with the model cross-referencing them.
- Persist claims: Postgres (or Vercel Postgres / Supabase) with claim ID, photos in object storage, and the analysis JSON, so an adjuster queue and audit trail exist.
- Authentication and roles (adjuster vs. claimant), plus a claimant-facing mobile capture flow that coaches photo angles.
- Side-by-side comparison of the AI estimate against the shop estimate once it arrives, to build a calibration dataset.

**AI quality**
- Ground pricing in real data: a parts-price lookup (OEM catalog / Mitchell / CCC / Audatex APIs) and regional labor rates supplied to the model as tool calls, so numbers come from tables rather than the model's priors.
- VIN or license-plate OCR as a first step to pin make/model/year and trim before damage reasoning.
- An evaluation set of adjuster-graded photos to measure identification accuracy and estimate error, and to tune the prompt and effort level against real numbers.
- Fraud signals: duplicate-image detection, metadata checks, and inconsistency between claimant narrative and visible damage.

**Engineering**
- Streaming the response so the vehicle card appears before the estimate finishes.
- Rate limiting, request logging, and an allow-list for URL fetching (the current server-side fetch is fine for a demo but is an SSRF surface in production).
- HEIC support (iPhone default) via server-side conversion.

---

## Project layout

```
app/
  api/analyze/route.ts   POST endpoint
  layout.tsx             HTML shell + metadata
  page.tsx               the UI
  globals.css            styles
lib/
  analyze.ts             system prompt + Claude call
  schema.ts              Zod schema / TypeScript types
docs/
  SOW.md                 Statement of Work (3 pages)
  BACKEND.md             Backend one-pager
  ARCHITECTURE.md        Technical architecture, request lifecycle, LLM interface
  IMPLEMENTATION_DIAGRAM.md   Prototype and target enterprise deployment diagrams
  Application Design Notes.md Design rationale and path to production
  SCALING_AND_ENHANCEMENTS.md How the solution scales and improves
  PRODUCTION_READINESS_PLAN_CISO.md   Security, privacy, and governance plan
  POLICY_COMPARISON_TECHNICAL_IMPLEMENTATION_PLAN.md   Future option: coverage decisioning
.env.example
```

## API reference

`POST /api/analyze` — `multipart/form-data`

| Field      | Type   | Notes                                             |
| ---------- | ------ | ------------------------------------------------- |
| `image`    | file   | JPEG, PNG, WebP or GIF, ≤ 10 MB. Either this…     |
| `imageUrl` | string | …or a public http(s) image URL.                   |
| `context`  | string | Optional free text from the claimant or adjuster. |

Returns `200 { analysis, meta }` (shape in `lib/schema.ts`) or `4xx/5xx { error }`.

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "imageUrl=https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/1994_Ford_Mustang_GT_front-end_damage_2017-07-01.jpg/1280px-1994_Ford_Mustang_GT_front-end_damage_2017-07-01.jpg" \
  -F "context=Hit a deer at 40 mph"
```
