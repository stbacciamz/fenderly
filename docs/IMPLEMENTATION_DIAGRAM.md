# Fenderly - implementation architecture

Current prototype: one Next.js application, one analysis endpoint, and one model invocation per assessment.

```mermaid
flowchart LR
    subgraph Browser["USER'S BROWSER"]
        UI["React interface<br/>Upload or image URL + context<br/>Results, JSON and session history"]
    end

    subgraph Server["NEXT.JS SERVER · NODE.JS"]
        API["POST /api/analyze<br/>Validate input and image size/type<br/>Fetch URL if needed; encode base64"]
        AI["analyzeDamage()<br/>Appraiser prompt + Anthropic SDK<br/>Parse output; normalize totals/confidence"]
    end

    subgraph External["EXTERNAL SERVICES"]
        Claude["Anthropic Claude API<br/>Vision + structured output<br/>Vehicle, damage and estimated cost"]
        Host["Image host<br/>Used for URL input"]
    end

    Schema["Shared Zod contract · lib/schema.ts<br/>Model output format + SDK parsing<br/>TypeScript types for API and UI"]

    UI -->|"1 · multipart/form-data"| API
    API -->|"2 · image + context"| AI
    AI -->|"3 · HTTPS model request"| Claude
    Claude -->|"4 · structured assessment"| AI
    AI -->|"5 · analysis + metadata"| API
    API -->|"6 · JSON response"| UI
    API <-->|"Optional image fetch"| Host
    Schema -.->|"Output contract"| AI
    Schema -.->|"UI types"| UI

    classDef browser fill:#EEF6FF,stroke:#4285B4,color:#173550;
    classDef server fill:#EAF7F4,stroke:#238778,color:#143D36;
    classDef external fill:#F4EEFC,stroke:#8961AD,color:#422F57;
    classDef contract fill:#FFF6E4,stroke:#B99441,color:#55421E;
    class UI browser;
    class API,AI server;
    class Claude,Host external;
    class Schema contract;
```

## Target enterprise deployment

Production at a European insurer runs inside the insurer's own tenancy. The prototype's Vercel hosting and public endpoint do not carry over.

```mermaid
flowchart LR
    subgraph Insurer["INSURER TENANCY · EU/UK REGION"]
        GW["Gateway + WAF"]
        IdP["Identity provider<br/>SAML/OIDC + SCIM"]
        UI["Claims handler UI"]
        SVC["Assessment service + workers"]
        DB["Postgres · customer keys"]
        OBJ["Object storage · customer keys"]
        CMS["Claims management system"]
        BUS["Event bus / API management"]
        SIEM["SIEM + SOC"]
        ITSM["ITSM + CMDB"]
    end
    subgraph Providers["APPROVED PROVIDERS"]
        MODEL["Claude · EU-region cloud provider<br/>or Anthropic API + DPA/ZDR"]
        EST["Estimating platform<br/>Audatex / DAT / GT Motive"]
        REG["Vehicle registration lookup"]
    end
    UI --> GW --> SVC
    IdP -.-> UI
    IdP -.-> SVC
    CMS <--> BUS <--> SVC
    SVC --> DB
    SVC --> OBJ
    SVC -->|proxy allow-list| MODEL
    SVC -->|proxy allow-list| EST
    SVC -->|proxy allow-list| REG
    SVC -.->|audit, security events| SIEM
    SVC -.->|incidents, changes| ITSM

    classDef insurer fill:#EAF7F4,stroke:#238778,color:#143D36;
    classDef provider fill:#F4EEFC,stroke:#8961AD,color:#422F57;
    class GW,IdP,UI,SVC,DB,OBJ,CMS,BUS,SIEM,ITSM insurer;
    class MODEL,EST,REG provider;
```

Solid arrows are runtime data flow; dashed arrows are identity, logging, and operations integrations. The security tooling, identity provider, and operations systems are the insurer's existing services, confirmed in discovery. Details are in the [Production Readiness Plan](PRODUCTION_READINESS_PLAN_CISO.md), sections 3.7 and 3.8.

## Request walkthrough

The user submits a photo or URL with optional incident context. The Next.js API validates the input and prepares a base64 image. The AI layer makes one call to Claude with an appraiser prompt and a Zod-derived output schema. It parses the response, normalizes the total estimate range and identification confidence, and returns the assessment with model, timing, and token metadata. The browser renders the results on the same page. One schema connects the model interface to the application types.

## Implementation notes

- **Browser:** `app/page.tsx` downsizes uploaded images to a maximum 1600 px long edge. Recent analyses are kept in React memory, not durable storage. URL previews load directly in the browser; the optional server fetch shown above supplies the model's image bytes.
- **API:** `app/api/analyze/route.ts` accepts supported media up to 10 MB and applies a 15-second timeout to remote image fetching. Invalid input returns 400, missing API configuration 500, and analysis failures 502, with an error message displayed in the UI.
- **AI layer:** `lib/analyze.ts` contains the prompt, SDK call, refusal/missing-output handling, and normalization. The API key stays on the server. Model and effort are configurable through environment variables.
- **Contract:** `lib/schema.ts` supplies the output schema and inferred TypeScript types. The SDK parses the model response; the browser does not perform an additional runtime Zod validation. Schema conformity does not establish factual or pricing accuracy.
- **Assessment:** pricing comes from model judgment and prompt assumptions. The current normalization bounds and rounds total estimates and clamps identification confidence; it does not reconcile line-item sums against totals.
- **Prototype boundary:** the UI presents a first-pass assessment for review. There is no implemented approval workflow, claims database, policy integration, pricing lookup, agent loop, or response streaming. Solid arrows represent runtime data flow; dashed arrows represent code dependencies. The shared schema is a code module, not a deployed service.

The server boxes in the prototype diagram are modules within the same Next.js application, not separate microservices. In the enterprise diagram the assessment service and its workers are separate containers on the insurer's Kubernetes platform.
