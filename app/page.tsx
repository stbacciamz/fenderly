"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Analysis, AnalyzeResponse, Severity } from "@/lib/schema";

/* ------------------------------------------------------------------ */
/* Sample photos (public domain / CC, Wikimedia Commons)               */
/* ------------------------------------------------------------------ */

const SAMPLES = [
  {
    label: "Mustang front-end",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/1994_Ford_Mustang_GT_front-end_damage_2017-07-01.jpg/1280px-1994_Ford_Mustang_GT_front-end_damage_2017-07-01.jpg",
  },
  {
    label: "Blue hatchback dent",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/%C5%A0koda_Roomster_Blue_Dented.jpg/1280px-%C5%A0koda_Roomster_Blue_Dented.jpg",
  },
  {
    label: "Bumper scrape",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Bumper-crop.jpg/1280px-Bumper-crop.jpg",
  },
];

const LOADING_STEPS = [
  "Uploading photo",
  "Identifying vehicle",
  "Mapping visible damage",
  "Pricing parts and labor",
];

type HistoryEntry = {
  id: number;
  previewUrl: string;
  result: AnalyzeResponse;
};

type Mode = "upload" | "url";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [context, setContext] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  // Preview for uploaded files. Object URLs are revoked when replaced.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Fake progress steps while the model works (typically 10-30 s).
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const t = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      3500,
    );
    return () => clearInterval(t);
  }, [loading]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file (JPEG, PNG, WebP, or GIF).");
      return;
    }
    setError(null);
    setFile(f);
    setImageUrl("");
    setMode("upload");
  };

  const pickUrl = (u: string) => {
    setImageUrl(u);
    setFile(null);
    setPreviewUrl(u.trim() || null);
    setMode("url");
  };

  const canAnalyze = !loading && (mode === "upload" ? !!file : !!imageUrl.trim());

  const analyze = useCallback(async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowJson(false);

    try {
      const form = new FormData();
      if (mode === "upload" && file) {
        form.append("image", await downscale(file), "photo.jpg");
      } else {
        form.append("imageUrl", imageUrl.trim());
      }
      if (context.trim()) form.append("context", context.trim());

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = (await res.json()) as AnalyzeResponse | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Request failed (${res.status})`);
      }

      setResult(body);
      const entry: HistoryEntry = { id: Date.now(), previewUrl: previewUrl ?? "", result: body };
      setHistory((h) => [entry, ...h].slice(0, 8));
      setActiveId(entry.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [canAnalyze, mode, file, imageUrl, context, previewUrl]);

  const restore = (entry: HistoryEntry) => {
    setResult(entry.result);
    setPreviewUrl(entry.previewUrl);
    setActiveId(entry.id);
    setError(null);
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">◈</span>
            Fenderly <small>AI damage assessment</small>
          </div>
          <div className="topbar-right">Prototype · first-pass estimates for adjuster review</div>
        </div>
      </header>

      <main className="page">
        {/* ---------------------------- Input ---------------------------- */}
        <section>
          <div className="panel">
            <h2 className="panel-title">Claim photo</h2>
            <p className="panel-sub">Upload a photo of the damaged vehicle or paste an image URL.</p>

            <div className="tabs" role="tablist">
              <button
                role="tab"
                className="tab"
                aria-selected={mode === "upload"}
                onClick={() => setMode("upload")}
              >
                Upload
              </button>
              <button
                role="tab"
                className="tab"
                aria-selected={mode === "url"}
                onClick={() => setMode("url")}
              >
                Image URL
              </button>
            </div>

            {mode === "upload" ? (
              <div
                key="upload"
                className={`dropzone${isOver ? " is-over" : ""}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsOver(true);
                }}
                onDragLeave={() => setIsOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsOver(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <strong>{file ? file.name : "Drop a photo here or click to browse"}</strong>
                JPEG, PNG, WebP or GIF · large photos are resized in the browser
              </div>
            ) : (
              <div key="url" className="url-row">
                <input
                  className="input"
                  type="url"
                  placeholder="https://example.com/damaged-car.jpg"
                  value={imageUrl}
                  onChange={(e) => pickUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyze()}
                />
              </div>
            )}

            <div className="samples">
              <span style={{ fontSize: 12.5, color: "var(--muted)", alignSelf: "center" }}>
                Try a sample:
              </span>
              {SAMPLES.map((s) => (
                <button key={s.url} className="chip" onClick={() => pickUrl(s.url)}>
                  {s.label}
                </button>
              ))}
            </div>

            {previewUrl && (
              <div className="preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected vehicle"
                  onError={() => setError("Could not load a preview for that URL.")}
                />
                {file && <span className="preview-meta">{formatBytes(file.size)}</span>}
              </div>
            )}

            <label className="label" htmlFor="context">
              Additional context <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="context"
              className="input"
              placeholder="e.g. Rear-ended at low speed in a parking lot. 2019 Honda Civic."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />

            <button className="btn btn-block" onClick={analyze} disabled={!canAnalyze}>
              {loading ? "Analyzing…" : "Analyze damage"}
            </button>
          </div>

          {history.length > 0 && (
            <div className="panel">
              <h2 className="panel-title">Recent analyses</h2>
              <p className="panel-sub">This session only. Click to review.</p>
              <div className="history">
                {history.map((h) => (
                  <button
                    key={h.id}
                    className={h.id === activeId ? "is-active" : ""}
                    onClick={() => restore(h)}
                    title={`${h.result.analysis.vehicle.make} ${h.result.analysis.vehicle.model}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {h.previewUrl && <img src={h.previewUrl} alt="" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------- Output --------------------------- */}
        <section className="panel">
          <h2 className="panel-title">Assessment</h2>
          <p className="panel-sub">Vehicle identification, damage summary, and repair estimate.</p>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div className="loading">
              <div className="spinner" />
              <div>Reviewing the photo…</div>
              <ul className="loading-steps">
                {LOADING_STEPS.map((s, i) => (
                  <li key={s} className={i === loadingStep ? "is-active" : ""}>
                    {i < loadingStep ? "✓" : i === loadingStep ? "▸" : "·"} {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : result ? (
            <Results
              result={result}
              previewUrl={previewUrl}
              showJson={showJson}
              onToggleJson={() => setShowJson((v) => !v)}
            />
          ) : (
            !error && (
              <div className="empty">
                <div className="empty-icon">🚗</div>
                <div>Add a photo to get started.</div>
              </div>
            )
          )}
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

function Results({
  result,
  previewUrl,
  showJson,
  onToggleJson,
}: {
  result: AnalyzeResponse;
  previewUrl: string | null;
  showJson: boolean;
  onToggleJson: () => void;
}) {
  const a = result.analysis;
  const [copied, setCopied] = useState(false);
  // Index into damage.areas that is highlighted in both the map and the list.
  const [hoverArea, setHoverArea] = useState<number | null>(null);
  const hasMap = a.is_vehicle_image && !!previewUrl && a.damage.areas.some((x) => x.bbox);

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cards">
      {!a.is_vehicle_image && (
        <div className="alert alert-warn">
          This photo does not appear to show a vehicle. Results below are best-effort only.
        </div>
      )}

      {hasMap && (
        <DamageMap a={a} src={previewUrl!} hover={hoverArea} onHover={setHoverArea} />
      )}
      <VehicleCard a={a} />
      <DamageCard a={a} hover={hoverArea} onHover={setHoverArea} />
      <EstimateCard a={a} />

      {(a.image_quality_notes.length > 0 || a.recommended_next_steps.length > 0) && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Adjuster notes</h3>
          </div>
          {a.image_quality_notes.length > 0 && (
            <>
              <div className="subhead" style={{ marginTop: 0 }}>
                Image quality
              </div>
              <ul className="list">
                {a.image_quality_notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
          {a.recommended_next_steps.length > 0 && (
            <>
              <div className="subhead">Recommended next steps</div>
              <ul className="list">
                {a.recommended_next_steps.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="meta-row">
        <span>
          {result.meta.model} · effort {result.meta.effort} · {(result.meta.duration_ms / 1000).toFixed(1)}s ·{" "}
          {result.meta.input_tokens + result.meta.output_tokens} tokens
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onToggleJson}>
            {showJson ? "Hide JSON" : "View JSON"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={copy}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </span>
      </div>

      {showJson && <pre className="json">{JSON.stringify(result, null, 2)}</pre>}

      <p className="disclaimer">
        AI-generated first-pass estimate for triage purposes. Final figures require an adjuster or
        repair-shop inspection.
      </p>
    </div>
  );
}

/**
 * The claim photo with a loose box drawn over each located damage area.
 * Boxes are positioned in percentages, so they track the image at any width.
 */
function DamageMap({
  a,
  src,
  hover,
  onHover,
}: {
  a: Analysis;
  src: string;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const areas = a.damage.areas;
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Damage map</h3>
        <span className="badge badge-neutral">
          {areas.filter((x) => x.bbox).length} of {areas.length} areas located
        </span>
      </div>
      <div className="damage-map" onMouseLeave={() => onHover(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Claim photo with damage areas marked" />
        {areas.map((area, i) =>
          area.bbox ? (
            <div
              key={i}
              className={`bbox bbox-${area.severity}${hover === i ? " is-hover" : ""}${
                hover !== null && hover !== i ? " is-dim" : ""
              }${area.bbox.y < 0.06 ? " is-top" : ""}`}
              style={{
                left: `${area.bbox.x * 100}%`,
                top: `${area.bbox.y * 100}%`,
                width: `${area.bbox.w * 100}%`,
                height: `${area.bbox.h * 100}%`,
              }}
              onMouseEnter={() => onHover(i)}
              title={`${area.location} · ${area.damage_type}`}
            >
              <span className="bbox-label">
                {i + 1}
                <span className="bbox-label-text"> · {area.location}</span>
              </span>
            </div>
          ) : null,
        )}
      </div>
      <p className="map-note">
        Boxes are approximate. They point the adjuster at the area, they do not measure it.
      </p>
    </div>
  );
}

function VehicleCard({ a }: { a: Analysis }) {
  const v = a.vehicle;
  const pct = Math.round(v.identification_confidence * 100);
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Vehicle</h3>
        <span className="badge badge-neutral">{pct}% ID confidence</span>
      </div>
      <p className="vehicle-name">
        {v.make} {v.model}
      </p>
      <p className="vehicle-sub">
        {v.year_range} · {v.body_type}
      </p>
      <dl className="kv">
        <div>
          <dt>Make</dt>
          <dd>{v.make}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{v.model}</dd>
        </div>
        <div>
          <dt>Color</dt>
          <dd>{v.color}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            {pct}%
            <div className="confidence">
              <div style={{ width: `${pct}%` }} />
            </div>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DamageCard({
  a,
  hover,
  onHover,
}: {
  a: Analysis;
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const d = a.damage;
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Damage summary</h3>
        <SeverityBadge s={d.overall_severity} />
      </div>
      <p className="summary">{d.summary}</p>

      {d.areas.length > 0 && (
        <ul className="areas">
          {d.areas.map((area, i) => (
            <li
              key={i}
              className={hover === i ? "is-hover" : ""}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            >
              {area.bbox ? (
                <span className={`marker marker-${area.severity}`}>{i + 1}</span>
              ) : (
                <span className={`dot dot-${area.severity}`} />
              )}
              <span>
                <span className="loc">{area.location}</span> · {area.damage_type}
                <div className="desc">{area.description}</div>
              </span>
              <SeverityBadge s={area.severity} />
            </li>
          ))}
        </ul>
      )}

      {d.likely_hidden_damage.length > 0 && (
        <>
          <div className="subhead">Possible hidden damage</div>
          <ul className="list">
            {d.likely_hidden_damage.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </>
      )}

      <div className="chips">
        <span className={`badge ${d.drivable ? "badge-minor" : "badge-severe"}`}>
          {d.drivable ? "Likely drivable" : "Likely not drivable"}
        </span>
        <span className={`badge ${d.airbags_deployed ? "badge-severe" : "badge-neutral"}`}>
          {d.airbags_deployed ? "Airbags deployed" : "No airbag deployment visible"}
        </span>
      </div>
    </div>
  );
}

function EstimateCard({ a }: { a: Analysis }) {
  const e = a.estimate;
  const riskClass = { low: "badge-minor", medium: "badge-moderate", high: "badge-severe" }[
    e.total_loss_risk
  ];
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">Estimated repair cost</h3>
        <span className={`badge ${riskClass}`}>Total-loss risk: {e.total_loss_risk}</span>
      </div>
      <div className="estimate-hero">
        <span className="estimate-likely">{usd(e.likely_usd)}</span>
        <span className="estimate-range">
          range {usd(e.low_usd)} – {usd(e.high_usd)}
        </span>
      </div>

      {e.line_items.length > 0 && (
        <table className="items">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Low</th>
              <th className="num">High</th>
            </tr>
          </thead>
          <tbody>
            {e.line_items.map((li, i) => (
              <tr key={i}>
                <td>
                  {li.item} <span className="op">{li.operation}</span>
                </td>
                <td className="num">{usd(li.cost_low_usd)}</td>
                <td className="num">{usd(li.cost_high_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {e.assumptions.length > 0 && (
        <>
          <div className="subhead">Assumptions</div>
          <ul className="list">
            {e.assumptions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SeverityBadge({ s }: { s: Severity }) {
  return <span className={`badge badge-${s}`}>{s.replace("_", " ")}</span>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatBytes(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

/**
 * Downscale large photos in the browser before upload. Phone photos are often
 * 12 MP+; the model does not need more than ~1600 px on the long edge, and
 * smaller uploads are faster and cheaper. Falls back to the original file if
 * the browser cannot decode it.
 */
async function downscale(file: File, maxEdge = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
