# Statement of Work

**Project:** Fenderly - AI Motor Claims Triage and Damage Estimation

**Prepared for:** [Insurer] Group Claims, [Country] motor business

**Prepared by:** Solutions Engineering

**Date:** 14 September 2026 | **Version:** 1.3 - proposed engagement

## 1. Objectives and Engagement Boundary

Develop the single-photo prototype into an integrated claims assessment service: vehicle details, visible damage, and repair-cost ranges for faster review, consistent triage, and less avoidable follow-up.

The 24-week engagement covers discovery, build, a controlled pilot, and handover for private motor claims in one country and legal entity, in [EUR/GBP]. The service runs inside the insurer's cloud tenancy in an EU or UK region, behind its gateway and identity provider. Claims handlers approve every customer-facing estimate; the service does not determine coverage, liability, or settlement. Further entities need a compliance pack and separate approval.

## 2. Project Scope

| Deliverable | Included capability |
| --- | --- |
| Assessment API | Accept 1-8 photos and first-notice-of-loss (FNOL) context; return make, model, colour, visible and suspected damage, line items, cost range, assumptions, and triage flags. |
| Review and capture | Handler view with edits, reasons, and disposition; mobile-web capture with guidance and an AI-use disclosure. |
| Grounding and integration | Estimating adapter (Audatex, DAT, or GT Motive) with the insurer's labour rates; registration lookup; one claims management system (CMS) adapter with write-back; SSO with SCIM; SIEM and ITSM integration; deployment through the insurer's pipelines; per-country localisation. |
| Compliance and operations | DPIA, AI Act memo, DORA register entry and contract annex, works council pack, AI literacy training, model card; role-based access, audit history, evaluation harness, monitoring, retention, runbooks. |

**Excluded:** coverage interpretation, excess calculation, automated settlement, injury and liability assessment, fleet products, fraud models and registries, policy administration integration, repairer allocation, cross-border claims, and replacement of the estimating platform. Cited policy comparison and an evidence-gathering agent are future options, separately scoped.

## 3. Technical Approach

**Architecture and hosting.** Containerised services deploy to the insurer's Kubernetes platform in an EU or UK region through Terraform and its CI/CD, with dependency scanning, image signing, and a software bill of materials per release. Ingress is through the insurer's gateway and WAF with no public endpoint; egress reaches only the model endpoint, estimating provider, and registration lookup. Photos and claim records stay in the insurer's storage under customer-managed keys.

**AI model and inference location.** Claude Opus 5, configured in the prototype, is the candidate: vision interprets photos and structured output supplies the contract. Phase 1 benchmarks quality, latency, and cost, pins the version, and selects the inference route: the insurer's cloud provider in an EU region (Bedrock, Vertex AI, or Foundry), or the Anthropic API under a data processing agreement, zero-retention terms, and a transfer assessment. Code validates outputs and recomputes totals; uncertain prices and hidden damage require professional review.

**Claims, pricing, and localisation.** FNOL events send claim ID, incident facts, and photo references from the CMS; completion attaches a draft assessment and a handler task; approval triggers idempotent write-back. Tools query the estimating provider and labour rates by vehicle, operation, and country. One prompt template carries a per-country block for language, labour rates, VAT, and total-loss basis.

**Identity and security operations.** Sign-in uses the insurer's identity provider with MFA and SCIM provisioning; every claim request checks entitlement. Audit and security events stream to the insurer's SIEM, incidents and changes to its ITSM, secrets to its vault. EXIF stripping, quotas, encryption, retention, and version logs are enforced (see the Production Readiness Plan).

<!-- pagebreak -->

## 4. Milestones, Ownership, and Timeline

The 24-week schedule assumes the commitments in Section 5. Each phase requires written acceptance by the insurer's product owner and claims lead, with security and compliance approval before live use. Weekly status reports track delivery, risks, and decisions.

| Phase / owner | Deliverables | Exit gate |
| --- | --- | --- |
| 1. Discovery, weeks 1-4 / SE lead with the insurer's security architect and DPO | Workflow and volumes, integration inventory, security architecture review, threat model, DPIA draft, AI Act memo, DORA register entry, hosting and inference-route decision, works council plan, evaluation protocol. | Insurer signs scope, security design, hosting decision, target metrics, sample-size plan, and dependency dates; TPRM onboarding started. |
| 2. Core service, weeks 5-9 / backend + AI engineers | Multi-photo API, versioned results, evaluation harness, baseline report, CMS integration spike, deployment to the insurer's non-production landing zone with SSO and SIEM forwarding. | Contract, validation, and failure-routing tests pass; at least 90% make/model accuracy on the validation cohort, abstentions counted as incorrect; first deployment through the insurer's CI/CD. |
| 3. Integration and UI, weeks 10-15 / engineering team | Estimating and registration adapters, review and capture flow, CMS write-back, audit trail, retention controls, dashboards, localisation, ITSM integration. | Staging UAT passes; penetration test by the insurer's approved tester with no open critical or high findings; DPIA approved; DORA annex signed; change board approval for pilot. |
| 4. Pilot, weeks 16-21 / claims lead + AI engineer | One entity, 2-3 handler teams; two weeks shadow, then four weeks assisted use after the entry gate below. | Works council agreement before handling-time measurement; Section 7 gates pass for the frozen release; incident notification drill completed. |
| 5. Handover, weeks 22-24 / SE + platform leads | Runbooks, SOC playbooks, training, rollback exercise, final evaluation report, per-country rollout template. | Operations and SOC accept handover; internal audit accepts the audit package; sponsor approves continuation or remediation. |

**Assisted-use entry gate:** the frozen candidate must pass agreed Section 7 thresholds on the locked test set, with written claims, security, and compliance approval. Failed gates or insufficient volume require remediation or a schedule change before proceeding.

## 5. Staffing, Dependencies, and Change Control

**Vendor commitment:** two full-time software engineers (backend/integration, frontend/platform); one full-time AI/evaluation engineer; a half-time SE/delivery lead; a quarter-time security specialist. Subject to commercial agreement.

**Insurer commitment:** a product owner and claims lead throughout; a security architect through week 15; the DPO and a compliance owner at the discovery and pilot gates; landing zone by week 4 and API management access by week 6; an integration engineer half-time through week 15; a works council liaison from week 1; SOC onboarding in weeks 8-15; 2-3 pilot teams with review capacity.

**Access and data:** by week 4, the insurer supplies photos, FNOL facts, estimates, invoices, and dispositions for a target 1,500 historical claims under a documented lawful basis, pseudonymised where feasible and held in its tenancy, plus CMS sandbox access, estimating licences, and identity configuration. Cohorts are split by claim; specialists resolve disputed labels. Delays shift milestones through change control.

**Commercial and delivery controls:** fees, licences, and support terms require a separate agreement including the DORA Article 30 provisions, an incident notification SLA, sub-processor change notice, audit rights, and exit assistance. Missing access, additional integrations or entities, or altered scope and targets require a written impact assessment and approval from both sponsors.

<!-- pagebreak -->

## 6. Risk Assessment

| Risk / accountable owner | Mitigation |
| --- | --- |
| Poor photos, hidden damage, or misidentification / claims lead | Request clearer evidence, cross-check registration and CMS records, separate visible from suspected damage, route uncertainty to inspection. |
| Pricing gaps or optimistic estimates / AI lead | Cite provider sources and dates, flag missing data, check arithmetic in code, measure errors by severity and vehicle segment. |
| EU and UK regulatory obligations / insurer compliance lead | Confirm applicability in Phase 1 (GDPR, AI Act, DORA, outsourcing rules, FCA and PRA); complete the DPIA and classification memo before pilot; keep human approval meaningful and recorded. |
| Data residency and transfer / DPO with security lead | Prefer EU or UK region inference; otherwise sign the DPA and zero-retention terms and complete a transfer impact assessment before real claim data is sent. |
| Integration lead times and employee monitoring / SE lead with claims lead | Landing zone, API management, TPRM, and change board cycles start in week 1 with named owners; works council engaged in week 1, metrics at team level where required. |
| Data exposure, malicious inputs, or misuse / security lead | Test authorisation, ingestion restrictions, prompt injection, and quotas in the insurer's pipeline and penetration test; require handler approval before customer release. |
| Model drift, outages, cost, or provider exit / platform lead | Pin versions, gate updates with evaluations, cap retries and spend, keep two inference routes and a manual queue, document the exit plan. |
| Localisation errors or low adoption / AI lead with claims lead | Country rules are configuration with per-country tests; co-design with pilot handlers and validate corrections independently. |

## 7. Success Metrics and Acceptance

These planning targets are validated against insurer baselines and model benchmarks in Phase 1, then signed with the eligible population, load, sample sizes, and measurement protocol. They are not claims of current performance.

| Measure | Definition and pilot target |
| --- | --- |
| Vehicle identification | Make and model match verified records on at least 95% of eligible test claims; abstentions count as incorrect. |
| Estimate quality | At least 75% of final invoices fall within the predicted range; median absolute percentage error of the likely estimate at most 20%. |
| Range usefulness | Median normalised range width, (high - low) / final cost, at most 60%; report the 90th percentile. Coverage and width must pass together. |
| Triage quality | At least 90% agreement with reviewed routing labels; at least 85% recall for total-loss cases under the country's basis, with subgroup counts and confidence intervals. |
| Handling efficiency | At least 30% reduction in median active handler time versus a matched baseline, at the granularity agreed with the works council. |
| Review and adoption | At least 90% of eligible pilot claims reviewed in the UI; material override rate at most 25%; material edits defined in Phase 1. |
| Service performance | p95 submission-to-result latency at most 60 seconds at agreed load, including queue and retries; 99% of valid jobs complete within five minutes. |
| Unit economics | Mean model and infrastructure cost at most 0.50 [EUR/GBP] per completed assessment, retries included; licence and review cost reported separately. |
| Operational compliance | Complete audit record for every assessment; DSAR, deletion, and incident notification drills within statutory and contractual time; no critical or high findings open at pilot start. |

**Measurement and acceptance.** Freeze the candidate before locked-test scoring. Repair-cost metrics use final invoices for eligible repaired claims; disclose exclusions and assess total losses separately. Report segment results, fairness slices, abstentions, and failures. Claims and engineering leads sign the report; the sponsor accepts against the phase gates. Documented exceptions require approval and cannot waive the entry gate.
