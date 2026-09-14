# How would you scale or enhance your solution?

I would evolve Fenderly in stages: establish assessment quality, make the workflow reliable under load, and integrate it into the adjuster's daily work. My first product enhancement would be guided multi-photo assessment. Once that foundation is proven, I would add an agent that identifies missing evidence and manages follow-up.

The prototype deliberately uses one Next.js application, one analysis endpoint, and one model invocation per assessment. That fits the assignment's time constraint and demonstrates the complete customer workflow. The next investment should address a measured customer need or operational bottleneck.

## 1. Establish whether the assessments are useful

Before expanding usage, I would build an evaluation set from representative historical claims with photos, verified vehicle details, adjuster assessments, and final repair invoices. I would separate development, validation, and test data by claim so that different photos of the same vehicle damage cannot leak across those sets.

I would measure vehicle identification, damage and triage quality, estimate error, and how often the final repair bill falls within the predicted range. I would also measure range width: an estimate is not useful simply because a very wide range contains the final bill. Results should be broken down by severity, vehicle type, and image quality, with abstentions and failures reported explicitly.

The existing Zod contract ensures output structure; it does not prove factual accuracy. I would add business checks for non-negative line items and reconciliation between line items and totals. Adjuster corrections would become evaluation candidates after specialist validation, rather than automatically becoming ground truth.

## 2. Improve evidence and ground the estimate

**My first visible enhancement would be multi-photo capture with targeted quality feedback.** The user could upload several angles, and the app would identify missing or unclear views. For example, it could request a close-up of an obscured rear lamp before revising the assessment. This directly addresses the limitations of estimating damage from one photo.

I would then integrate licensed parts prices, regional labor rates, and vehicle valuations. Today, pricing comes from model judgment and prompt assumptions. In the enhanced workflow, the model would identify likely repair operations, tools would retrieve supporting prices, and application code would calculate totals. Each price would retain its source and date; unavailable prices would remain explicit assumptions.

These changes would be evaluated against the baseline to establish whether they improve accuracy and reduce adjuster follow-up enough to justify their additional latency and cost.

## 3. Scale processing around model capacity

I would keep the Next.js UI and API, then move long-running analysis into background workers when concurrency or request duration requires it:

1. Upload photos to private object storage using short-lived, authorized upload URLs.
2. Create a durable claim assessment record and enqueue a job containing evidence references.
3. Return a job ID immediately; show actual job status through polling or server-sent events.
4. Have a worker validate the images, run the assessment, and persist the result.
5. Let the user return later and retrieve the completed assessment.

Postgres would hold claim state, assessment versions, and review history. The API and workers could scale independently, while the shared schema would remain the application contract.

Worker concurrency would be bounded by provider request/token limits and the agreed spending budget. Queue depth and oldest-job age would indicate pressure. Transient failures would receive bounded retries with backoff; persistent failures would enter a manual-review queue. Idempotency keys would prevent duplicate job creation and duplicate claim-system updates, with explicit handling for uncertain outcomes after provider timeouts.

Adding more application instances alone would not resolve a model-provider throughput limit. I would load-test the complete path and negotiate capacity or reduce work per assessment where measurements justify it.

## 4. Make customer adoption operationally credible

I would add federation with the insurer's identity provider, authorization on every claim and photo, tenant isolation where applicable, retention controls, and an audit trail. I would harden remote-image fetching against private-network access and redirects, enforce byte limits while reading images, verify image content, and add usage quotas.

The adjuster would have a review queue, the ability to correct results with a reason, and an explicit approval step before a customer-facing estimate is released. The prototype currently presents results for review but does not enforce that workflow.

I would start with one claims management system integration: receive claim context, attach the assessment, and write back the approved disposition. A shadow pilot would compare output with normal handling before assisted use begins.

At a large European insurer, adoption also depends on work that is not engineering: the compliance pack (DPIA, AI Act classification, DORA register entry and contract terms, works council agreement where handler metrics are measured) and integration with the insurer's own security infrastructure (identity provider, SIEM, secrets and key management, ITSM). These run in parallel with the build from week 1 and are described in the [Production Readiness Plan](PRODUCTION_READINESS_PLAN_CISO.md).

## 5. Optimize cost and latency against quality

I would track queue time, model latency, completion rate, retries, token usage, and cost per completed assessment. Cost reporting would include failed attempts and follow-ups, with licensed-data and human-review costs shown separately.

Model and effort settings are already configurable. I would benchmark candidate configurations on the same evaluation set and choose the least expensive option that meets agreed quality gates. Any escalation to a more capable configuration would use validated routing criteria, such as missing evidence or inconsistent results; a model's self-reported confidence alone would be insufficient.

Prompt and model changes would pass regression checks, then a staged release with rollback. The SOW's accuracy, latency, and cost figures are proposed pilot targets to validate, not current performance claims.

## 6. Add bounded agentic functionality

After the assessment and review workflow is reliable, I would introduce a **Claim Investigation Agent**. Its objective would be to prepare a sufficiently evidenced assessment for an adjuster.

It could choose to analyze another image, retrieve a price, or request a specific missing fact through the app. It would observe the result and decide whether to continue, wait for user input, or hand off. That ability to select and revise its next action is the agentic element.

The agent would use an allowlisted tool set, durable state, a recorded action history, and limits on steps, retries, and spending. It would stop when the evidence requirements are met or unresolved uncertainty requires professional inspection. It would not authorize payments or make final coverage decisions.

Policy comparison would be a separately scoped extension, using the policy in force at the loss date, cited clauses, deterministic financial calculations, and adjuster approval.

My delivery order would therefore be **quality baseline and essential access controls, multi-photo evidence, grounded pricing and reliable processing, claims-system integration, then agentic follow-up**. I would judge success by better estimates and less adjuster handling time, alongside acceptable reliability and unit cost.

Related documents: [Statement of Work](SOW.md) and [current implementation diagram](IMPLEMENTATION_DIAGRAM.md).
