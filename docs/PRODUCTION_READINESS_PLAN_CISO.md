# Production Readiness Plan for a European Regulated Insurance Deployment

## 1. Executive Summary

This document defines the enhancements required to move Fenderly from prototype to production at a large European motor insurer. The plan is security-first, model-risk-managed, audit-ready, and written for a service that runs inside the insurer's own cloud tenancy in an EU or UK region, behind the insurer's gateway and identity provider, integrated with the security tooling and operational systems the insurer already runs. It assumes the current architecture (Next.js UI plus API route and Claude structured output) and upgrades it to enterprise standards for confidentiality, integrity, availability, safety, and regulatory defensibility under EU and UK law.

Primary outcomes:

1. Protect claimant, policyholder, and claim data to enterprise and regulatory expectations, with data residency in the EU or UK.
2. Control AI model risk with measurable evaluation, governance, and meaningful human oversight.
3. Integrate with the insurer's security infrastructure, identity, and operations rather than running parallel tooling.
4. Establish operational controls that support internal audit, legal, privacy, compliance, and incident response, including the regulatory clocks that apply to a European insurer.
5. Add policy-aware claim review so a claims handler can select the applicable policy, compare the claim against coverage, calculate the claimant's cost after excess, and identify excluded repair items with evidence.

Regulatory statements in this plan are a solutions-engineering view for planning. The insurer's legal, compliance, and data protection functions confirm applicability, dates, and interpretation in discovery.

## 2. Control Objectives and Non-Negotiables

The production system must satisfy these non-negotiable requirements before broad rollout:

1. Zero Trust access controls on all interfaces and workloads.
2. Strong data protection for images and claim metadata in transit and at rest, with customer-managed keys.
3. Vendor and model risk controls with legal, security, and compliance sign-off.
4. Continuous model evaluation with release gates tied to business risk.
5. Full auditability of decisions, overrides, and model, prompt, and pricing versions.
6. Human-in-the-loop for claim decisions affecting customer outcomes. The approval is meaningful: the handler sees the evidence, can change the outcome, and the record shows what changed.
7. Policy interpretation must be source-backed, versioned, and approved through claims and legal governance rather than inferred by a free-form model response.
8. Claim data, logs, and model inference remain in EU or UK regions unless the data protection officer approves a documented transfer mechanism.
9. Contracts with the vendor and every sub-processor meet DORA Article 30 and the insurer's outsourcing policy before real claims are processed.
10. Employee performance metrics (handling time, override rates) are measured only at the granularity agreed with the works council or equivalent where one exists.

## 3. Target-State Production Architecture Enhancements

## 3.1 Identity, Access, and Network

1. Ingress through the insurer's API gateway and WAF only; no vendor-managed public endpoint. mTLS from the gateway to the service.
2. SAML or OIDC federation with the insurer's identity provider (Entra ID, Okta, or Ping); MFA and conditional access enforced there; SCIM for joiner, mover, and leaver events. Service-to-service integrations use mTLS or workload identity.
3. Privileged access to the platform through the insurer's PAM tool with session recording; no standing admin credentials.
4. RBAC with least-privilege roles: Claims Handler, Team Leader, Technical Assessor, Claims Admin, Security Auditor, and one service account per integration.
5. Network segmentation: gateway tier, private application tier, private data tier. Private endpoints for storage, database, and the model route.
6. Outbound access through the insurer's egress proxy with an allow-list of three destinations: model endpoint, estimating provider, vehicle registration lookup. TLS inspection compatibility is confirmed in discovery.
7. Tenant isolation per legal entity where the group shares the platform.

## 3.2 Ingestion Hardening

1. Replace open URL fetching with signed object-store URLs issued by trusted services.
2. Add SSRF controls: DNS resolution checks, private range blocking, redirect re-validation, egress policy enforcement.
3. Stream-download with byte ceilings and early abort on oversized content.
4. Validate file signatures (magic bytes), not only MIME headers.
5. Strip EXIF metadata, including GPS, on upload. Reject or quarantine images that contain injury content per the insurer's policy.
6. Malware scanning through the insurer's content-scanning service where it exists.

## 3.3 Data Security and Privacy

1. Encrypt data in transit with TLS 1.2 or higher and at rest with customer-managed keys, HSM-backed where the insurer's policy requires.
2. Store images in the insurer's object storage with bucket policies and retention tags; photos never leave the tenancy except to the approved model route.
3. Minimise retained data fields; classify data assets by sensitivity; mask number plates and faces in logs, telemetry, and evaluation exports.
4. Implement retention and deletion controls by policy and country: claims-file retention periods differ across the group's entities.
5. Support data subject access requests and deletion with runbooks and evidence of completion within statutory time.
6. Apply immutable audit logs for access to sensitive claim artefacts.
7. Treat third-party claimants as data subjects with no contract with the insurer: lawful basis, transparency notice, and objection handling are designed for them, not only for policyholders.

## 3.4 Policy, Coverage, and Exclusions Management

1. Integrate with the insurer's policy administration system and document repository so the handler can search a customer policy and select the policy in force on the loss date.
2. Store policy declarations, endorsements, schedules, and wording versions with immutable version identifiers.
3. Compare claim facts against coverage terms, limits, conditions, and exclusions using a bounded rules layer with retrieval-backed references.
4. Calculate the claimant's expected out-of-pocket amount by applying the policy excess, coverage limits, depreciation or betterment rules where applicable, VAT treatment, and non-covered items.
5. Allow the handler to mark repair operations or line items as excluded from repair with a cited policy basis and an audit trail.
6. Require manual review when policy wording is ambiguous, endorsements conflict, or coverage depends on country-specific interpretation.

## 3.5 Application and API Security

1. Rate limiting, quota enforcement, and abuse detection per user, IP, and tenant at the gateway and in the application.
2. Idempotency keys and replay protections for integration paths.
3. Normalised public error messages; provider details in internal logs only.
4. Secure headers, strict CORS policy, and CSRF protections for browser sessions.
5. Secrets in the insurer's vault (HashiCorp Vault, Azure Key Vault, or AWS Secrets Manager) with rotation policies; certificates from the insurer's internal PKI.
6. Supply chain: SAST, dependency scanning, DAST, image signing, and an SBOM per release in the insurer's pipeline; admission control admits signed images only.

## 3.6 Resilience and Operations

1. Queue-based asynchronous processing for burst control. Hail and storm events can raise motor claim volumes by an order of magnitude for days.
2. SLOs, error budgets, and automated rollback criteria.
3. Multi-availability-zone deployment within the region; disaster recovery plan with RTO and RPO agreed against the insurer's tier for claims handling; periodic failover exercises.
4. Runbooks for degraded mode and manual fallback to handler-only workflow.
5. Two inference routes designed in (cloud-provider region and Anthropic API) so a provider outage or exit does not stop claims handling; exit plan and data return procedure documented.

## 3.7 Integration with the Insurer's Security Infrastructure

The service plugs into the security tooling the insurer already runs rather than shipping its own. Discovery confirms each item (section 10); build wires it in.

| Capability | Integration | Discovery question |
| --- | --- | --- |
| Security monitoring | Application, audit, and platform logs forwarded to the insurer's SIEM (Sentinel, Splunk, or QRadar) in its schema (CEF, OCSF, or its own), with agreed field names for claim ID, handler ID, model version, and decision. Detection use cases: mass export, unusual claim access, model-call spend anomalies, prompt-injection attempts, repeated failed authorisation. | Which SIEM, which ingestion method, what retention, who writes and tunes detections? |
| Endpoint and workload protection | The insurer's EDR agent and vulnerability scanner on nodes and images; findings in the insurer's vulnerability management tool with its remediation SLAs. | Which agents are mandatory on the Kubernetes platform, and who owns patching? |
| Secrets and keys | Secrets in the insurer's vault with rotation; customer-managed keys for storage and database; certificates from the internal PKI; key custody with the insurer. | Key custody model, rotation periods, certificate issuance process, HSM requirement. |
| Perimeter | The insurer's WAF rules and bot protection; rate limits at the gateway; DLP and CASB policies if photos could leave the tenancy. | Which gateway, what WAF baseline, who tunes rules? |
| Operations | Incidents and changes in the insurer's ITSM (ServiceNow or equivalent); configuration items in the CMDB; on-call through the insurer's paging; backups into the insurer's backup service with restore tests. | Severity matrix, change lead times, DR tier, RTO and RPO. |
| Assurance | Penetration test by the insurer's approved tester (CREST or equivalent in the UK); SAST, dependency scanning, DAST, and SBOM in the insurer's pipeline; image signing and admission control. | Which scanners are mandatory, what gates block a release? |
| Third-party risk | TPRM questionnaire (SIG or CAIQ), ISO 27001 or SOC 2 Type II evidence, Cyber Essentials Plus for UK entities, sub-processor list including the model provider and cloud provider. | Which questionnaire, what evidence is mandatory, what is the onboarding lead time? |

## 3.8 Enterprise Integration Architecture

| System | Pattern | Notes |
| --- | --- | --- |
| Claims management system (Guidewire ClaimCenter, Sapiens, Duck Creek, or in-house) | Inbound: FNOL and photo-added events from the insurer's event bus, or a polling adapter through API management. Outbound: attach draft assessment, create handler task, write back approved estimate and disposition with idempotency keys. | One adapter per CMS behind a stable internal interface; the first is the pilot entity's system. |
| Estimating platform (Audatex, DAT, GT Motive; Thatcham repair methods in the UK) | Server-side tool calls for parts, labour operations, and paint; results stored with source and date. | Licence terms and rate limits differ per country; confirm in discovery. |
| Vehicle registration lookup | Registration to make, model, colour, year, and engine; UK DVLA Vehicle Enquiry Service, commercial providers elsewhere. | Plates are personal data: hash in logs, pseudonymise in evaluation sets. |
| Identity | Federation and SCIM as in 3.1. | Broker or external assessor users need a separate identity route if brought into scope later. |
| Observability | OpenTelemetry traces and metrics into the insurer's APM (Dynatrace, Datadog, or Grafana); dashboards for queue depth, latency, cost, and override rate. | Cost per assessment includes retries and follow-ups. |
| Data platform | Nightly export of assessment records, without images, to the insurer's warehouse for evaluation and actuarial use. | Purpose limitation applies; agree fields with the data protection officer. |
| Document management | Photos and reports filed to the claims document store where the insurer requires it. | Retention follows the claims file. |
| Localisation | One prompt template with a per-country block (language, labour rates, VAT, parts norms, total-loss basis); `country` and `currency` in the output contract. | Country rules are configuration with their own tests, not code branches. |

## 4. AI and Model Risk Management Framework

## 4.1 Governance Structure

Establish a Model Risk Committee with representatives from the CISO, Claims, Compliance, Legal, the Data Protection Officer, Data Science, and Engineering. A named senior manager owns the AI use (Senior Managers regime in the UK; equivalent accountability in EU entities).

Required approvals before production releases:

1. Security architecture approval.
2. Privacy and legal processing approval (DPIA signed).
3. Model evaluation gate pass.
4. Claims operations sign-off on workflow and override UX.
5. Compliance confirmation that outsourcing and DORA obligations are met.

## 4.2 Model Inventory and Version Governance

Track and version all model-affecting artefacts:

1. Model identifier, provider route, and inference region.
2. Prompt templates, country blocks, and policy instructions.
3. Output schema versions.
4. Post-processing and business rules.
5. Tool integrations used for pricing, valuation, and registration lookup.
6. Policy document identifiers, endorsement versions, coverage rules versions, and excess calculation rules.

Every assessment record must store artefact versions for full reproducibility.

## 4.3 Evaluation Program (Pre-Production)

Build a representative evaluation set from historical claims under a documented lawful basis and purpose-compatibility assessment, pseudonymised where feasible, stored inside the insurer's tenancy. Include edge cases:

1. Vehicle diversity: makes, model years, trims, body styles, right-hand and left-hand drive as relevant.
2. Damage diversity: minor, severe, hidden-damage-prone, total-loss candidates under the country's total-loss basis.
3. Environmental variance: night, glare, rain, blur, partial framing.
4. Fraud patterns: duplicate or manipulated imagery.
5. Country pricing variance: labour rates, VAT, parts sourcing.
6. Policy coverage edge cases: exclusions, endorsements, limits, excess, and ambiguous wording.

Core metrics and minimum gates:

1. Vehicle identification accuracy.
2. Severity-routing agreement with expert handlers.
3. Estimate range coverage versus final approved estimate.
4. Median absolute error of likely estimate.
5. False negative rate for high-risk and total-loss candidates.
6. Override rate by handlers and reason taxonomy.
7. Calibration quality by confidence band.
8. Fairness review: results sliced by proxies that could correlate with protected characteristics (vehicle age and segment, postcode, claimant channel), with a documented conclusion.
9. Policy-document selection accuracy.
10. Coverage decision accuracy versus the claims and legal gold standard.
11. Excess application accuracy.
12. Exclusion citation precision and recall.

Release gates:

1. No critical regression on safety or business metrics versus baseline.
2. Performance above minimum thresholds for the pilot cohort.
3. Risk exceptions formally documented and approved.
4. Policy interpretation outputs are reproducible from the selected policy version and rules version.

## 4.4 Evaluation Program (Post-Production)

1. Daily drift checks on image quality, vehicle mix, and damage distribution.
2. Weekly scorecards for accuracy, overrides, latency, cost, and coverage decision quality.
3. Monthly recalibration and prompt and rule tuning review.
4. Triggered revalidation after model, prompt, schema, tool, or country-configuration changes.
5. Triggered revalidation after policy wording, endorsement library, or excess rule changes.
6. Consumer Duty outcome monitoring for UK entities: complaint and dispute rates on assisted claims compared with the baseline.

## 4.5 Safety Controls for Generative Outputs

1. Structured output enforcement with strict schema validation.
2. Business rule guardrails for implausible costs, missing required fields, contradictory indicators, and coverage decisions that do not match the selected policy document.
3. Policy reasoning must be citation-backed: every non-covered item, excluded operation, excess application, or policy-compliance conclusion must link to the selected policy version or rule source.
4. Prompt injection mitigation policy and adversarial tests.
5. Mandatory human approval before customer-facing actions.
6. Ambiguous or conflicting policy language must route to manual review rather than auto-determination.
7. Claimant-facing capture flow states that AI produces the guidance and the first-pass assessment.

## 5. Compliance and Legal Readiness: UK and EU Regulatory Register

"Impact" says what the solution must do; "Evidence" is the artefact the insurer's second line and auditors will ask for. Each row has an owner on the insurer side, named in discovery.

| Regime | Applies to | Impact on the solution | Evidence |
| --- | --- | --- | --- |
| GDPR (EU) and UK GDPR with the Data Protection Act 2018 | Claim photos (faces, number plates, EXIF locations), claimant narrative, handler identity; third-party claimants as data subjects | Lawful basis per data subject type; data minimisation (EXIF stripping, no injury photos, masking outside the claim record); Article 22 kept out of scope by meaningful human review; Article 28 processor terms with the vendor and the model or cloud provider; retention per country; DSAR and deletion within statutory time; EU or UK region inference, or standard contractual clauses plus a transfer impact assessment | DPIA (Article 35 applies), records of processing entry, DPA and sub-processor list, transfer impact assessment, retention schedule, DSAR runbook |
| UK Data (Use and Access) Act 2025 | UK entity | Changes the UK automated decision-making rules; legal confirms whether the assisted workflow relies on the new provisions or stays outside Article 22 by design; human review design is kept either way | Legal memo in the DPIA |
| EU AI Act (Regulation 2024/1689) | EU entities as deployer; the model provider for general-purpose model obligations | Motor damage estimation is not in the Annex III insurance item (life and health risk assessment and pricing), so the working classification is "not high-risk"; the insurer documents that decision and re-checks if scope grows toward coverage or pricing decisions about natural persons. Article 4 AI literacy: handler and supervisor training is a deliverable. Article 50 transparency for the claimant flow. Application dates for Annex III obligations have been subject to Commission deferral proposals; confirm the current position in discovery | AI Act classification memo, AI literacy training record, claimant disclosure text, model card |
| DORA (Regulation 2022/2554), applicable to EU insurers since January 2025 | EU entities | The vendor, the model provider, and the cloud provider are ICT third-party providers: register of information entries; decision whether the service supports a critical or important function (claims handling usually does); Article 30 contract provisions (service description, data location, availability and integrity, access and audit rights, incident support, subcontracting transparency, termination and exit); major ICT incident reporting on fixed clocks, so the vendor's notification SLA must leave the insurer time to report; resilience testing and an exit plan for critical services. NIS2 does not apply on top: DORA is the specific regime for financial entities | Register of information entry, Article 30 contract annex, incident notification SLA, exit plan, resilience test results |
| Solvency II, Insurance Distribution Directive, national supervisors (BaFin, ACPR, DNB, IVASS, DGSFP) | EU entities | Outsourcing of a critical or important function may need supervisor notification before go-live; EIOPA's 2025 opinion on AI governance sets expectations for proportionate governance, data governance, fairness, documentation, and human oversight; BaFin's VAIT remains a reference for German IT governance alongside DORA | Outsourcing notification, AI governance record mapped to the EIOPA opinion |
| FCA and PRA (UK) | UK entity | Consumer Duty: no worse outcomes for retail customers, monitored through complaints and disputes; ICOBS 8: claims handled promptly and fairly, the estimate is support not settlement; SYSC 8 and PRA SS2/21: material outsourcing assessment and notification; SYSC 15A operational resilience: the service inherits the impact tolerance of claims handling if it is an important business service; PRA SS1/23 model risk principles as the reference; Senior Managers regime accountability | Outsourcing assessment and notification, operational resilience mapping, model risk assessment, Consumer Duty outcome monitoring |
| Equality Act 2010 (UK) and EU equal treatment law | Both | Fairness review across proxies for protected characteristics with a documented conclusion | Fairness section in the evaluation report |
| Accessibility: European Accessibility Act (2025), UK Equality Act practice | Claimant capture flow, handler UI | Assess EAA scope for the claimant flow; build to WCAG 2.2 AA and EN 301 549 regardless | Accessibility statement and test report |
| ePrivacy | Claimant web flow | Consent for non-essential cookies; the capture flow is built to need none | Cookie audit |
| Employee consultation: German BetrVG section 87, Dutch Works Councils Act, French CSE | Countries with works councils | Handling-time and override metrics are employee performance monitoring; a works council agreement is required before the pilot measures them. This is a schedule dependency | Works council agreement or documented exemption |
| Security assurance | Vendor | ISO 27001 or SOC 2 Type II, Cyber Essentials Plus for UK, penetration test by the insurer's approved tester, SBOM, sub-processor list, NCSC cloud security principles mapping | TPRM pack |

Additional readiness items:

1. Map controls to the insurer's enterprise frameworks (ISO 27001 statement of applicability, NIST CSF, or its own control library).
2. Execute vendor due diligence for the model provider and all sub-processors; confirm zero-data-retention terms with the model provider and check model eligibility for them.
3. Obtain claims legal approval for policy-interpretation rules, excess handling, exclusion logic, and customer out-of-pocket calculations.

## 6. Observability, Audit, and Incident Response

## 6.1 Mandatory Telemetry

Collect structured, queryable telemetry for:

1. Request identity, authorisation context, and tenant.
2. Input characteristics (size, type, quality signals; no raw image unless policy permits).
3. Model metadata (model version, provider route, inference region, prompt version, country block, schema version, tool calls).
4. Output confidence and risk flags.
5. Policy document id and version selected, coverage decision, excess applied, excluded items, and rationale citations.
6. Handler overrides and final disposition.
7. Security events and blocked requests, forwarded to the SIEM.

## 6.2 Incident Response Playbooks

Define playbooks, integrated with the insurer's ITSM and SOC, for:

1. Personal data breach or unauthorised data exposure. Clocks: assess within hours; notify the supervisory authority within 72 hours of the insurer becoming aware where required; notify data subjects without undue delay where risk is high; the vendor notifies the insurer within the contractual window so the insurer can meet its own deadline.
2. Major ICT incident under DORA. The insurer classifies and reports on the DORA clocks (initial, intermediate, and final reports); the vendor supplies impact data within the contractual window. UK entity: FCA and PRA notification per SUP 15 and the firm's operational resilience obligations.
3. Model quality degradation or drift incident. Freeze the release, revert to the last approved version, log the decision, report to the Model Risk Committee.
4. Provider outage or extreme latency. Switch to the second inference route or manual fallback; record the decision.
5. Abuse and denial-of-wallet attacks.

Each playbook includes containment steps, communication paths, regulator notification decision points with the owner named, and evidence preservation procedures. An incident notification drill runs before the pilot.

## 7. Delivery Roadmap with CISO Checkpoints

The roadmap aligns with the 24-week Statement of Work.

## Phase 1: Discovery and Foundation Design (Weeks 1-4)

1. Security and integration discovery workshops (section 10); data flow diagram, threat model, security architecture document.
2. DPIA draft, records of processing entry, AI Act classification memo, DORA register entry, TPRM onboarding started, works council engagement plan.
3. Hosting platform, inference route, log schema, key custody, and identity federation decisions recorded.

Exit checkpoint:

1. Security architecture review passed by the insurer's architecture board.
2. DPIA in review; TPRM onboarding started; landing zone provisioning scheduled.

## Phase 2: Core Service and Foundation Hardening (Weeks 5-9)

1. Deployment into the insurer's non-production landing zone through its pipelines with security scanning green.
2. Gateway, WAF, identity federation, RBAC, secrets vault, SIEM forwarding, baseline logging.
3. SSRF defences, signed URL ingestion, EXIF stripping, rate limiting, quotas, and cost guardrails.
4. Model inventory, lineage, and version capture in production records; evaluation harness and baseline benchmark.

Exit checkpoint:

1. First deployment through the insurer's CI/CD with no open critical or high scanner findings.
2. Model Risk Committee signs off on pilot thresholds.

## Phase 3: Integration, UI, and Governance (Weeks 10-15)

1. Claims system, estimating, and registration adapters; ITSM and CMDB integration; localisation configuration and tests.
2. Data retention, deletion, and classification controls operational; DSAR runbook tested.
3. Policy document ingestion, selection workflow, and coverage-rule prototype validated with claims and legal.
4. Penetration test by the insurer's approved tester.

Exit checkpoint:

1. DPIA approved; DORA contract annex signed; outsourcing notification made where required.
2. Penetration test with no open critical or high findings.
3. Change advisory board approval for pilot deployment.

## Phase 4: Controlled Pilot (Weeks 16-21)

1. Deploy to a limited handler cohort in shadow then assisted mode, in one legal entity.
2. Works council agreement in place before handling-time measurement starts.
3. Monitor quality, override rates, and operational risk indicators weekly; incident notification drill and incident simulation exercises.
4. Validate policy-comparison workflow, excess calculation, and exclusion review with pilot handlers.

Exit checkpoint:

1. Pilot KPI thresholds met for at least three consecutive weeks.
2. CISO, Compliance, and Claims Operations approve expansion.

## Phase 5: Handover and Rollout Template (Weeks 22-24, then per entity)

1. Runbooks, SOC playbooks, training including AI literacy, rollback exercise, final evaluation report.
2. Per-country compliance pack as the entry criterion for each further entity: DPIA update, retention rules, supervisor notification where required, works council agreement where applicable, localisation tests.
3. Continuous monitoring, monthly governance reviews, annual model validation and control recertification.

Exit checkpoint:

1. Audit package complete and accepted by Internal Audit.
2. Production controls transitioned to the insurer's BAU operations and SOC.

## 8. CISO Approval Artefacts

The following artefacts should be complete before full rollout:

1. Threat model and architecture decision record.
2. Penetration test report with remediation evidence.
3. Data flow diagrams and data classification register.
4. Vendor security and legal due diligence pack, including the TPRM questionnaire and sub-processor list.
5. DPIA, records of processing entry, and transfer impact assessment where applicable.
6. AI Act classification memo and AI literacy training record.
7. DORA register of information entry, Article 30 contract annex, incident notification SLA, and exit plan.
8. Outsourcing assessment and supervisor notification where required.
9. Works council agreement or documented exemption.
10. Model risk assessment report, model card, and evaluation scorecards including the fairness review.
11. Incident response runbooks and tabletop exercise outcomes.
12. Access review evidence and segregation-of-duties matrix.
13. Logging, monitoring, and alerting control validation evidence, including SIEM ingestion.
14. SBOM and image signatures for the deployed release.
15. Accessibility statement and test report.
16. Policy-interpretation control matrix, source citation standard, and claims and legal sign-off on coverage rules.

## 9. Immediate Next Engineering and Governance Actions

1. Engage the insurer's security architect, data protection officer, and compliance owner in week 1; start TPRM onboarding and the DORA register entry.
2. Decide hosting platform and inference route by week 4, with the transfer analysis recorded in the DPIA.
3. Implement signed URL ingestion, EXIF stripping, and disable arbitrary remote URL fetch in production mode.
4. Add identity federation, RBAC, and gateway-enforced rate limiting before any deployment beyond the vendor's own environment.
5. Introduce structured audit logging with model, provider route, prompt, country block, and schema version stamps, forwarded to the SIEM.
6. Build the evaluation harness and define minimum launch thresholds with claims leadership, including the fairness review.
7. Establish Model Risk Committee cadence and approval workflow.
8. Add policy document ingestion, selection UI, coverage comparison, excess calculation, and excluded-item review workflow.
9. Define a citations-first policy reasoning contract with claims and legal approval.

## 10. Security and Integration Discovery

This is the content behind Phase 1. It runs as a workstream from week 1 alongside the claims and evaluation discovery.

## 10.1 Workshops (Weeks 1-3)

| Workshop | Attendees | Outputs |
| --- | --- | --- |
| Claims workflow and volumes | Claims lead, handlers, operations | Eligible claim types; daily and peak volumes; SLA clocks; FNOL channels; current estimating process |
| Integration inventory | Integration platform team, CMS owner, estimating platform owner | Systems, interfaces, environments, sandbox access dates, API management and event bus patterns, test data policy |
| Security architecture | Security architect, cloud platform team | Landing zone, network zones, ingress and egress rules, TLS inspection, private endpoints, mandatory agents, key custody, PKI, allowed regions, Kubernetes standards |
| Identity and access | IAM team | Identity provider, federation protocol, MFA and conditional access, SCIM, role model, PAM for privileged access, service account policy |
| Security operations | SOC lead, detection engineering | SIEM, log schema and transport, retention, detection use cases, incident severity matrix, on-call and escalation, ITSM process |
| Privacy | Data protection officer, legal | Lawful bases, DPIA scope, retention per country, DSAR and deletion process, transfer route, sub-processors, claimant disclosure text |
| Compliance and third-party risk | Compliance, procurement, TPRM | DORA register and contract annex, outsourcing classification and notification, TPRM questionnaire and evidence, exit plan expectations, audit rights |
| Model risk and AI governance | Model risk owner, actuarial or data science | Model inventory process, validation expectations, evaluation data access, fairness review scope, AI Act classification memo, AI literacy plan |
| Employee consultation | HR, works council liaison, claims lead | What is measured, at what granularity, and the agreement needed before the pilot |
| Change and release | Change management, platform team | Environments, promotion path, change board cadence and lead times, release windows, rollback expectations |

## 10.2 Artefacts Produced in Discovery

1. Data flow diagram with data classification per flow.
2. Threat model (STRIDE or the insurer's method) with mitigations mapped to this plan.
3. Security architecture document reviewed by the insurer's architecture board.
4. Integration design for the CMS, estimating, registration, identity, SIEM, and ITSM interfaces.
5. DPIA draft and records of processing entry.
6. AI Act classification memo and AI literacy plan.
7. DORA register entry and draft Article 30 contract annex.
8. TPRM evidence pack: certifications, penetration test summary, SBOM approach, sub-processor list.
9. Works council engagement plan.
10. Decision record: hosting platform, inference route, log schema, key custody, identity federation, environments.

## 10.3 Decisions That Gate the Build

| Decision | Options | Owner | Needed by |
| --- | --- | --- | --- |
| Hosting platform | Insurer Kubernetes on Azure or AWS EU or UK region | Cloud platform lead | Week 3 |
| Inference route | Cloud-provider EU region versus Anthropic API with DPA and zero retention | Security architect with the data protection officer | Week 4 |
| Log and audit schema | Insurer's SIEM schema | SOC lead | Week 4 |
| Key custody | Customer-managed keys, HSM-backed or not | Security architect | Week 4 |
| Identity federation | SAML or OIDC, SCIM scope, role model | IAM lead | Week 4 |
| Metrics granularity | Individual versus team level for handling time | Claims lead with works council | Week 6 |
| Evaluation data use | Lawful basis, pseudonymisation, storage | Data protection officer | Week 3 |

This plan is intended to be actionable, measurable, and defensible for enterprise security governance at a European insurer while preserving product velocity.
