# Technical Implementation Plan: Policy Comparison and Coverage Decisioning

## 1. Goal

Build an adjuster workflow that can:

1. Look up a customer policy.
2. Select the policy document in force at date of loss.
3. Compare claim facts and proposed repair line items against policy coverage.
4. Determine policy compliance.
5. Calculate claimant out-of-pocket cost (including deductible/excess).
6. Flag repair elements that should be excluded, with policy citations.

The solution must be secure, auditable, and suitable for regulated insurance operations.

## 2. Functional Scope

### 2.1 In Scope

1. Policy lookup by policy number, claimant name, vehicle VIN/plate, and claim id.
2. Policy version selection based on effective dates and endorsements.
3. Coverage decision per claim and per estimate line item.
4. Deductible/excess and limit application.
5. Exclusion recommendation with citation to policy section.
6. Adjuster review/override workflow with mandatory rationale.
7. Full audit logs and version lineage.

### 2.2 Out of Scope (Phase 1)

1. Fully automated claim acceptance without adjuster sign-off.
2. Non-auto policy products.
3. Legal adjudication of ambiguous policy language.

## 3. Proposed Architecture

## 3.1 New Components

1. Policy Connector Service:
   - Fetch policy metadata, declarations, endorsements, limits, deductible/excess.
   - Pull policy documents from policy admin/document store APIs.
2. Policy Document Processing Pipeline:
   - Parse and chunk policy docs.
   - Extract structured clauses (coverage, exclusions, conditions, limits).
   - Persist clause index and references.
3. Coverage Rules Engine:
   - Deterministic rules for deductible/excess math, limits, and product/jurisdiction rules.
   - Executes before/after model reasoning.
4. Coverage Reasoning Service:
   - LLM-assisted interpretation constrained by selected policy clauses and claim facts.
   - Must output structured decision plus citations.
5. Decision Orchestrator:
   - Combines claim estimate + policy selection + rules + model output.
   - Produces final review package for adjuster.

## 3.2 Integration Pattern

1. Adjuster UI calls backend with claim id.
2. Backend retrieves policy candidates.
3. Adjuster selects the in-force policy record/document.
4. Backend builds a policy context package (declarations + endorsements + relevant clauses).
5. Orchestrator runs:
   - deterministic checks,
   - model coverage reasoning,
   - deductible/excess calculation,
   - exclusion scoring.
6. UI renders recommendation + citations + editable outcome.

## 4. Data Model Changes

Add the following core entities (logical schema):

1. Policy
   - policy_id, carrier_policy_number, insured_party_id, product_type, jurisdiction
   - effective_from, effective_to, status
2. PolicyVersion
   - policy_version_id, policy_id, version_hash, issued_at
   - declarations_json, limits_json, deductible_json
3. Endorsement
   - endorsement_id, policy_version_id, code, title, effective_from, effective_to
4. PolicyDocument
   - document_id, policy_version_id, document_type, uri, checksum, parsed_status
5. PolicyClause
   - clause_id, document_id, section_ref, clause_type (coverage/exclusion/condition/limit)
   - text, embedding_ref, jurisdiction_tags
6. ClaimPolicyDecision
   - decision_id, claim_id, selected_policy_version_id
   - compliance_status (compliant/partially_compliant/non_compliant/manual_review)
   - recommended_payout_usd, claimant_out_of_pocket_usd
   - deductible_applied_usd, limit_applied_usd
   - model_version, prompt_version, rules_version
7. LineItemCoverageDecision
   - id, decision_id, estimate_line_item_id
   - coverage_status (covered/excluded/partial/review)
   - covered_amount_usd, excluded_amount_usd
   - primary_clause_id, explanation, confidence
8. DecisionAuditEvent
   - event_id, decision_id, actor, action, before_json, after_json, reason, timestamp

## 5. API Design

## 5.1 Backend Endpoints

1. GET /api/policies/search
   - Inputs: query fields (policy number, claim id, VIN, insured name)
   - Output: candidate policies with effective windows
2. GET /api/policies/{policyId}/versions
   - Output: policy versions + endorsements + effective periods
3. POST /api/claims/{claimId}/policy-decision
   - Input: selected_policy_version_id, claim context, estimate payload id
   - Output: structured policy comparison decision
4. GET /api/claims/{claimId}/policy-decision/{decisionId}
   - Output: decision details, citations, line-item decisions, audit metadata
5. POST /api/claims/{claimId}/policy-decision/{decisionId}/override
   - Input: adjuster edits + mandatory reason
   - Output: saved override + audit event id

## 5.2 Response Contract (Key Fields)

1. policy_selection:
   - policy_id, version_id, effective_window, endorsement_ids
2. compliance:
   - status, rationale, required_manual_review
3. financials:
   - estimated_repair_total
   - covered_total
   - excluded_total
   - deductible_or_excess
   - claimant_out_of_pocket
4. exclusions:
   - line_item_ref, exclusion_reason, clause_citation
5. citations:
   - document_id, section_ref, excerpt, confidence
6. governance:
   - model_version, prompt_version, rules_version, decision_timestamp

## 6. Decisioning Logic

## 6.1 Deterministic First Pass

1. Validate policy is active on date of loss.
2. Apply product-level eligibility checks.
3. Apply deductible/excess and policy limits.
4. Tag obvious non-covered categories via rules.

## 6.2 Retrieval + LLM Reasoning

1. Retrieve top relevant policy clauses by claim facts and estimate line items.
2. Provide only selected policy version content and relevant clauses to the model.
3. Require strict JSON output:
   - compliance status,
   - line item coverage status,
   - clause citations,
   - uncertainty flags.
4. Reject output with missing citations or unsupported conclusions.

## 6.3 Post-Processing Guards

1. Verify every exclusion maps to an allowed clause type.
2. Recompute totals deterministically (never trust model arithmetic alone).
3. If contradictions exist, route to manual review state.

## 7. UI/UX Implementation (Adjuster Flow)

## 7.1 New Screens/Sections

1. Policy Search Panel:
   - search and select customer policy.
2. Policy Version Selector:
   - display effective periods, endorsements, and document set.
3. Coverage Comparison Panel:
   - claim line items with covered/excluded/partial badges.
4. Financial Breakdown Panel:
   - insurer pay, claimant pay, deductible/excess, excluded cost.
5. Citation Drawer:
   - clickable policy excerpts for each coverage decision.
6. Override Workflow:
   - require reason code and free text to change recommendation.

## 7.2 UX Controls Required for Compliance

1. No one-click auto-approve based solely on AI recommendation.
2. Highlight low-confidence or ambiguous decisions.
3. Lock finalization until mandatory fields and rationale are complete.

## 8. Security and Compliance Controls

## 8.1 Access and Data Protection

1. SSO + RBAC for adjuster operations.
2. ABAC filters to enforce region/business-unit data boundaries.
3. Encryption in transit and at rest with enterprise key management.

## 8.2 Service Hardening

1. API gateway + WAF.
2. Input validation and strict schema enforcement on all endpoints.
3. Rate limiting and tenant/user quotas.
4. Secrets in vault with rotation.

## 8.3 Audit and Traceability

1. Immutable audit trail for policy selection, model recommendations, and overrides.
2. Persist model, prompt, rules, and policy-document versions per decision.
3. Preserve citation evidence for each exclusion/non-compliance determination.

## 8.4 Regulatory Safeguards

1. Human-in-the-loop mandatory for customer-impacting decisions.
2. Jurisdiction-specific rule packs and disclosure templates.
3. Data retention/deletion aligned to enterprise claims policy.

## 9. Model Evaluation and Quality Gates

## 9.1 Offline Evaluation Set

Build a labeled set including:

1. Straightforward covered claims.
2. Endorsement-driven exceptions.
3. Ambiguous wording and conflict scenarios.
4. Exclusion-heavy claims.
5. Different deductible/excess structures.

## 9.2 Core Metrics

1. Policy selection accuracy.
2. Coverage decision accuracy (claim-level and line-item).
3. Deductible/excess calculation accuracy.
4. Exclusion precision/recall.
5. Citation validity rate.
6. Adjuster override rate and override reason distribution.
7. Manual-review capture rate for ambiguous cases.

## 9.3 Release Gates

1. No critical regression in coverage correctness.
2. Citation validity above agreed threshold.
3. Financial calculation error rate below agreed threshold.
4. All high-severity policy scenarios pass deterministic regression tests.

## 10. Implementation Phases (12-16 Weeks)

## Phase 0 (Week 1-2): Design and Controls

1. Finalize data contracts with policy admin and document systems.
2. Approve target decision schema with Claims and Legal.
3. Define evaluation dataset and acceptance thresholds.

Deliverables:

1. ADRs, API specs, entity model, threat model.

## Phase 1 (Week 3-5): Policy Retrieval Foundation

1. Build policy search and version endpoints.
2. Implement policy document ingestion and parsing pipeline.
3. Build clause extraction and indexing.

Deliverables:

1. Working policy lookup and policy version selector backend.

## Phase 2 (Week 6-8): Decision Engine MVP

1. Build deterministic rules engine for effective date, limits, deductible/excess.
2. Build LLM coverage reasoner with citation-constrained structured output.
3. Implement decision orchestration endpoint.

Deliverables:

1. End-to-end backend policy decision service in staging.

## Phase 3 (Week 9-11): Adjuster UI and Overrides

1. Implement policy search/selection UI.
2. Implement coverage comparison and financial panels.
3. Implement override flow with mandatory rationale and audit events.

Deliverables:

1. Full adjuster workflow for policy-aware claim assessment.

## Phase 4 (Week 12-14): Security, Evaluation, and Pilot Readiness

1. Complete hardening controls and observability.
2. Run offline evaluations and fix failure modes.
3. Execute UAT with adjusters, claims ops, and legal reviewers.

Deliverables:

1. Go/no-go report with KPI results and risk exceptions.

## Phase 5 (Week 15-16): Controlled Pilot

1. Launch shadow mode, then assisted decision mode.
2. Weekly calibration and governance reviews.
3. Finalize rollout recommendation.

Deliverables:

1. Pilot report and production rollout checklist.

## 11. Testing Strategy

1. Unit tests:
   - deductible/excess formulas,
   - limit handling,
   - exclusion rule mapping.
2. Contract tests:
   - policy admin/document APIs,
   - decision response schema.
3. Integration tests:
   - claim estimate to policy decision pipeline.
4. Adversarial tests:
   - prompt injection via claimant context,
   - malformed policy docs,
   - conflicting endorsements.
5. Security tests:
   - authz bypass, excessive data exposure, abuse throttling.

## 12. Delivery Team and Ownership

1. Backend engineers: policy connector, decision service, APIs.
2. Frontend engineers: adjuster workflow UI.
3. ML/AI engineer: retrieval, prompts, evaluation harness.
4. Security engineer: threat model, hardening, control validation.
5. Claims SME + Legal SME: policy interpretation sign-off.
6. Product manager: scope and acceptance criteria ownership.

## 13. Definition of Done

Feature is production-ready when all are true:

1. Adjusters can select in-force policy docs and run policy comparison in the main workflow.
2. System outputs compliance status, claimant cost, and exclusion decisions with citations.
3. Deterministic financial calculations match approved formulas.
4. Full decision lineage (policy/rules/model versions) is auditable.
5. Security controls and model evaluation gates are passed and signed off by CISO, Claims, and Legal.