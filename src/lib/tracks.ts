// Learning tracks: one per subject. Each track holds interactive sessions today,
// and will hold a roadmap and hands-on projects later.
// Routes: /tracks/<track.id> for a track, /tracks/<track.id>/<session.id> for a session.
// To add a visual: build it in src/sessions/<track>/<session>/, register it in
// src/sessions/registry.tsx, then set the session's status to "live" here.

import { chooseLayout, type LayoutDecision, type SessionShape } from "./sessionLayout";

export type SessionStatus = "live" | "soon";

export type Session = {
  id: string; // URL segment, e.g. "two-sum" -> /tracks/dsa/two-sum
  title: string;
  blurb: string;
  status: SessionStatus;
  tag?: string; // small label, e.g. "DSA #01"
  /**
   * What the session contains. Required once a session is live: the layout
   * (one view, left to right, top to bottom) is chosen from it by
   * `chooseLayout` in src/lib/sessionLayout.ts.
   */
  shape?: SessionShape;
  /** Section id within the track, when the track groups its sessions (see Track.sections). */
  section?: string;
};

export type TrackSection = {
  id: string;
  title: string;
  blurb?: string;
  /** Live sessions in other tracks that cover part of this section, as "<track>/<session>". */
  related?: string[];
};

export type Track = {
  id: string; // used in /tracks/<id>
  title: string;
  short: string; // label for the top bar
  tagline: string;
  /** Optional one-liner on session pages: how live sessions fit together */
  learningPathBlurb?: string;
  accent: string; // CSS colour token from globals.css
  sessions: Session[];
  /** Optional groups for a long track. Sessions point at one with `section`; the track page shows them under these headings, in this order. */
  sections?: TrackSection[];
  roadmap: string[]; // planned stages, shown as "coming soon" for now
  projects: string[]; // planned build-it projects, shown as "coming soon" for now
};

export const TRACKS: Track[] = [
  {
    id: "dsa",
    title: "Data Structures & Algorithms",
    short: "DSA",
    tagline: "Spot the pattern, then watch each approach run and scale.",
    accent: "var(--dsa)",
    sessions: [
      {
        id: "two-sum",
        tag: "DSA #01",
        title: "Two Sum, three ways",
        blurb: "Step through brute force, two pointers and a hash map. Then scale n and see the gap.",
        status: "live",
        shape: { kind: "comparison", steps: 3 },
      },
      {
        id: "hash-map",
        title: "Hash map: group anagrams",
        blurb: "Give every word a key, then one lookup per word puts anagrams in the same bucket.",
        status: "live",
        shape: { kind: "algorithm", steps: 5, flow: "state" },
      },
      {
        id: "two-pointers",
        title: "Two pointers: most water",
        blurb: "Start at both ends and always move the shorter line. One pass instead of every pair.",
        status: "live",
        shape: { kind: "algorithm", steps: 5, flow: "state" },
      },
      { id: "sliding-window", title: "Sliding window", blurb: "Slide a fixed window and watch each step add one cell and drop one.", status: "live",
        shape: { kind: "algorithm", steps: 5, flow: "state" } },
      {
        id: "monotonic-stack",
        title: "Monotonic stack: next warmer day",
        blurb: "Keep the waiting days on a stack and answer each one the moment a warmer day arrives.",
        status: "live",
        shape: { kind: "algorithm", steps: 4, flow: "state" },
      },
      { id: "binary-search", title: "Binary search", blurb: "Halve the search space and see why it takes log n steps.", status: "live",
        shape: { kind: "algorithm", steps: 4, flow: "state" } },
      {
        id: "tree-recursion",
        title: "Trees: let the children answer first",
        blurb: "Find a tree's depth one call at a time and watch the call stack grow and shrink with it.",
        status: "live",
        shape: { kind: "algorithm", steps: 4, flow: "state" },
      },
      { id: "bfs-vs-dfs", title: "BFS vs DFS", blurb: "Run both on the same graph and compare the order they visit nodes.", status: "live",
        shape: { kind: "comparison", steps: 2 } },
      {
        id: "dynamic-programming",
        title: "Dynamic programming: coin change",
        blurb: "Fill a table from 0 upward so every answer is worked out once, and see where greedy goes wrong.",
        status: "live",
        shape: { kind: "algorithm", steps: 4, flow: "state" },
      },
    ],
    roadmap: ["Arrays & hashing", "Two pointers & sliding window", "Stacks, queues & linked lists", "Trees & graphs", "Dynamic programming"],
    projects: ["Build an LRU cache", "Autocomplete with a trie", "Route finder with Dijkstra"],
  },
  {
    id: "nodejs",
    title: "Node.js Internals",
    short: "Node.js",
    tagline: "See what really happens inside the runtime when your code runs.",
    accent: "var(--node)",
    sessions: [
      { id: "event-loop", title: "The event loop, phase by phase", blurb: "Queue timers, promises and I/O, then step through each loop phase.", status: "live",
        shape: { kind: "system", steps: 6, flow: "cycle" } },
      { id: "streams-backpressure", title: "Streams and backpressure", blurb: "Push data faster than it drains and watch the buffer fill.", status: "live",
        shape: { kind: "system", steps: 4, flow: "cycle", richSteps: true } },
      { id: "thread-pool", title: "The libuv thread pool", blurb: "Fire file and crypto work and see which calls block the pool.", status: "live",
        shape: { kind: "system", steps: 5, flow: "cycle" } },
    ],
    roadmap: ["Runtime & V8 basics", "Event loop & async", "Streams & buffers", "Workers & clustering", "Profiling & performance"],
    projects: ["Write a tiny HTTP server from sockets", "Build a rate-limited job queue", "Stream a large CSV into a database"],
  },
  {
    id: "system-design",
    title: "System Design",
    short: "System Design",
    tagline: "Push traffic through real architectures and watch where they break.",
    learningPathBlurb:
      "Spread the load, cache it close to users, and cap abusers. Then copy and split the data, keep one failing service from taking down the rest, and move slow work to queues.",
    accent: "var(--sys)",
    sections: [
      { id: "scalability", title: "Scalability and performance", blurb: "Handle more users without slowing down.", related: ["nodejs/streams-backpressure"] },
      { id: "data", title: "Data and databases", blurb: "Choose where data lives and how it stays correct." },
      { id: "networking", title: "Networking and APIs", blurb: "How services find and talk to each other." },
      { id: "reliability", title: "Reliability and resilience", blurb: "Keep working when parts fail." },
      { id: "distributed", title: "Distributed systems", blurb: "Many machines acting like one system." },
      { id: "architecture", title: "Software architecture", blurb: "How to split a codebase into parts." },
      { id: "security", title: "Security and access control", blurb: "Who can do what, and keeping data safe." },
      { id: "production", title: "Production engineering", blurb: "Run it, watch it and pay for it.", related: ["devops/ci-cd-pipeline", "devops/containers-vs-vms", "devops/rolling-deploys"] },
      { id: "web", title: "Web application design", blurb: "Putting it together for real products." },
      { id: "ai-apps", title: "AI: LLM application architecture", blurb: "The parts around the model.", related: ["ai/next-token", "ai/context-window", "ai-native/structured-output"] },
      { id: "ai-rag", title: "AI: RAG and knowledge systems", blurb: "Give the model the right documents.", related: ["ai/embeddings", "ai/hybrid-search", "ai/rag"] },
      { id: "ai-agents", title: "AI: Agents and orchestration", blurb: "Models that take actions.", related: ["ai-native/tool-calling", "ai/agent-patterns", "ai-automation/human-approval", "tools/mcp", "tools/cursor-agent"] },
      { id: "ai-memory", title: "AI: Context and memory", blurb: "What the model remembers between turns." },
      { id: "ai-quality", title: "AI: Evaluation and quality", blurb: "Know whether it actually works.", related: ["ai/evals"] },
      { id: "ai-serving", title: "AI: Model serving and infrastructure", blurb: "Running the models themselves." },
      { id: "ai-security", title: "AI: Security and governance", blurb: "New ways for AI systems to go wrong." },
      { id: "specialized", title: "Specialized systems", blurb: "Common product types that combine the above." },
      { id: "case-studies", title: "Case studies: design a system", blurb: "Put the pieces together: one product, end to end." },
    ],
    sessions: [
      // Scalability and performance
      { id: "scaling", title: "Vertical vs horizontal scaling", blurb: "Make one server bigger or add more servers, and see where each one hits a wall.", status: "soon", section: "scalability" },
      { id: "estimation", title: "Back-of-the-envelope estimates", blurb: "Turn daily users into requests per second, storage and bandwidth.", status: "soon", section: "scalability" },
      { id: "load-balancing", title: "Load balancing strategies", blurb: "Queues, health checks, and timeouts — not just which server is next.", status: "live",
        section: "scalability",
        shape: { kind: "system", steps: 4, flow: "cycle", richSteps: true } },
      { id: "autoscaling", title: "Autoscaling", blurb: "Add servers when traffic climbs and remove them when it drops, without flapping.", status: "soon", section: "scalability" },
      { id: "caching", title: "Caching and eviction", blurb: "Watch a cache hit, miss and evict, then predict the next request.", status: "live",
        section: "scalability",
        shape: { kind: "simulation", steps: 10 } },
      { id: "cache-invalidation", title: "Cache invalidation", blurb: "Write-through, write-behind, TTLs and explicit purges: keeping cached data fresh.", status: "soon", section: "scalability" },
      {
        id: "cdn",
        title: "CDNs: caching at the edge",
        blurb: "Pick a TTL, ship a new logo, and see which cities still get the old one.",
        status: "live",
        section: "scalability",
        shape: { kind: "system", steps: 5, flow: "cycle" },
      },
      { id: "latency-throughput", title: "Latency, throughput and concurrency", blurb: "Why a faster request and more requests per second are different goals.", status: "soon", section: "scalability" },
      { id: "database-bottlenecks", title: "Database bottlenecks", blurb: "Connection pools, slow queries, N+1 calls and read replicas.", status: "soon", section: "scalability" },
      {
        id: "rate-limiting",
        title: "Rate limiting",
        blurb: "Fixed window, sliding window and token bucket on the same burst.",
        status: "live",
        section: "scalability",
        shape: { kind: "comparison", steps: 3 },
      },
      { id: "backpressure", title: "Backpressure and load shedding", blurb: "Slow the sender or drop work on purpose before the whole system falls over.", status: "soon", section: "scalability" },
      { id: "probabilistic-counting", title: "Counting at scale: HyperLogLog and count-min sketch", blurb: "Count unique visitors and frequent items in kilobytes, by accepting a small error.", status: "soon", section: "scalability" },
      { id: "top-k", title: "Top-K, trending and leaderboards", blurb: "Rank millions of scores live, and find what's trending right now.", status: "soon", section: "scalability" },
      // Data and databases
      { id: "sql-vs-nosql", title: "SQL, document and graph databases", blurb: "Same data in three models: joins, flexible documents, or relationships first.", status: "soon", section: "data" },
      { id: "data-modeling", title: "Data modeling: normalize or denormalize", blurb: "Design a schema, then trade duplicate data for faster reads.", status: "soon", section: "data" },
      { id: "database-indexes", title: "Indexes and query optimization", blurb: "Find one row in a million with a B-tree instead of a full scan, and pay for it on writes.", status: "soon", section: "data" },
      { id: "transactions", title: "Transactions, ACID and isolation levels", blurb: "Two people book the last seat at once: see which isolation level stops the double booking.", status: "soon", section: "data" },
      {
        id: "replication",
        title: "Replication and stale reads",
        blurb: "Write to the leader, read from a follower, and crash the leader mid-write.",
        status: "live",
        section: "data",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
      {
        id: "sharding",
        title: "Sharding: choosing the shard key",
        blurb: "Hash, country or date: see hot shards and queries that ask every shard.",
        status: "live",
        section: "data",
        shape: { kind: "system", steps: 5, flow: "state" },
      },
      { id: "bloom-filters", title: "Bloom filters", blurb: "Answer \"definitely not here\" without touching the database, with a tunable false-positive rate.", status: "soon", section: "data" },
      { id: "storage-engines", title: "B-trees vs LSM trees and the write-ahead log", blurb: "How databases lay data on disk, and why one is faster for reads and the other for writes.", status: "soon", section: "data" },
      { id: "change-data-capture", title: "Change data capture", blurb: "Stream every database change to search, caches and analytics without dual writes.", status: "soon", section: "data" },
      { id: "schema-migrations", title: "Zero-downtime schema migrations", blurb: "Change a table under live traffic: expand, migrate, then contract.", status: "soon", section: "data" },
      { id: "time-series", title: "Time-series databases", blurb: "Metrics and sensor data: append-only writes, downsampling and retention.", status: "soon", section: "data" },
      // Networking and APIs
      { id: "request-journey", title: "DNS, TCP, TLS and HTTP: one request", blurb: "Follow a request from a domain name to a response, one layer at a time.", status: "soon", section: "networking" },
      { id: "api-styles", title: "REST, GraphQL, gRPC and WebSockets", blurb: "Four ways to shape an API, and what each one is good at.", status: "soon", section: "networking" },
      { id: "sync-vs-async", title: "Synchronous vs asynchronous communication", blurb: "Wait for the answer, or hand off the work and get told later.", status: "soon", section: "networking" },
      { id: "api-gateway", title: "API gateways and service discovery", blurb: "One front door for auth, routing and limits, and how it finds services that move.", status: "soon", section: "networking" },
      { id: "idempotency", title: "Idempotency and request deduplication", blurb: "Send the same payment twice and charge it once.", status: "soon", section: "networking" },
      { id: "webhooks", title: "Webhooks", blurb: "Call another system when something happens: signatures, retries and replay.", status: "soon", section: "networking" },
      { id: "service-mesh", title: "Service mesh", blurb: "Sidecars handle retries, TLS and traffic splits between services.", status: "soon", section: "networking" },
      { id: "http2-http3", title: "HTTP/2, HTTP/3 and QUIC", blurb: "Multiplexing, head-of-line blocking, and why HTTP/3 moved to UDP.", status: "soon", section: "networking" },
      // Reliability and resilience
      { id: "availability", title: "Availability and the nines", blurb: "What 99.9% really allows, and how redundancy buys more nines.", status: "soon", section: "reliability" },
      { id: "graceful-degradation", title: "Fault tolerance and graceful degradation", blurb: "Turn off the extras so the core feature keeps working.", status: "soon", section: "reliability" },
      {
        id: "circuit-breaker",
        title: "Retries and circuit breakers",
        blurb: "Turn a retry storm into a fast failure and let the broken service recover.",
        status: "live",
        section: "reliability",
        shape: { kind: "system", steps: 5, flow: "cycle" },
      },
      { id: "bulkheads", title: "Bulkheads", blurb: "Split resources so one slow dependency can't use up every thread.", status: "soon", section: "reliability" },
      { id: "failover-dr", title: "Failover, disaster recovery, RTO and RPO", blurb: "Lose a region and measure how long you're down and how much data you lose.", status: "soon", section: "reliability" },
      { id: "cap-theorem", title: "CAP theorem and quorums", blurb: "Split the network and choose: answer with stale data, or refuse until it heals.", status: "soon", section: "reliability" },
      { id: "distributed-transactions", title: "Distributed transactions and two-phase commit", blurb: "Commit across two databases, and see what happens when the coordinator dies.", status: "soon", section: "reliability" },
      { id: "hedged-requests", title: "Hedged requests and retry budgets", blurb: "Send a backup request to cut slow tails, without doubling the load.", status: "soon", section: "reliability" },
      // Distributed systems
      { id: "event-driven", title: "Event-driven architecture", blurb: "Services react to events instead of calling each other directly.", status: "soon", section: "distributed" },
      {
        id: "message-queues",
        title: "Message queues",
        blurb: "Slow consumers, duplicate charges and a dead-letter queue: at-least-once in action.",
        status: "live",
        section: "distributed",
        shape: { kind: "system", steps: 5, flow: "cycle" },
      },
      { id: "pub-sub", title: "Pub/sub and event streaming", blurb: "Publish once; many consumers read a partitioned log at their own pace.", status: "soon", section: "distributed" },
      { id: "delivery-guarantees", title: "Ordering, delivery guarantees and duplicates", blurb: "At-most-once, at-least-once, exactly-once, and keeping events in order.", status: "soon", section: "distributed" },
      { id: "eventual-consistency", title: "Eventual consistency", blurb: "Replicas disagree for a moment, then converge. When is that acceptable?", status: "soon", section: "distributed" },
      { id: "cqrs-event-sourcing", title: "CQRS and event sourcing", blurb: "Store every change as an event and build separate read models from them.", status: "soon", section: "distributed" },
      { id: "sagas-outbox", title: "Sagas and the transactional outbox", blurb: "Run a multi-service order without a global transaction, and never lose the event.", status: "soon", section: "distributed" },
      { id: "consensus", title: "Leader election and consensus", blurb: "Nodes vote in a leader with Raft; crash it and watch them elect another.", status: "soon", section: "distributed" },
      { id: "distributed-locks", title: "Distributed locks", blurb: "Only one worker may run the job: leases, fencing tokens and expired locks.", status: "soon", section: "distributed" },
      { id: "consistent-hashing", title: "Consistent hashing", blurb: "Add and remove nodes and see how few keys move.", status: "live",
        section: "distributed",
        shape: { kind: "system", steps: 5, flow: "state" } },
      { id: "unique-ids", title: "Unique IDs at scale", blurb: "Auto-increment, UUIDs and Snowflake IDs: ordering, collisions and coordination.", status: "soon", section: "distributed" },
      { id: "clocks", title: "Clocks and ordering", blurb: "Machine clocks drift: Lamport and vector clocks order events without them.", status: "soon", section: "distributed" },
      { id: "gossip", title: "Gossip protocols", blurb: "Spread membership and state through a cluster by talking to a few peers at a time.", status: "soon", section: "distributed" },
      { id: "merkle-trees", title: "Merkle trees and anti-entropy", blurb: "Find which data two replicas disagree on without comparing every row.", status: "soon", section: "distributed" },
      // Software architecture
      { id: "monolith-vs-microservices", title: "Monolith, modular monolith or microservices", blurb: "Where to draw service boundaries, and what each split costs.", status: "soon", section: "architecture" },
      { id: "clean-architecture", title: "Layered, clean and hexagonal architecture", blurb: "Keep business logic apart from the database and the web framework: ports and adapters.", status: "soon", section: "architecture" },
      { id: "domain-driven-design", title: "Domain-driven design", blurb: "Bounded contexts, aggregates and a shared language with the business.", status: "soon", section: "architecture" },
      { id: "adrs", title: "Architecture decision records", blurb: "Write down why a choice was made so the next person doesn't undo it.", status: "soon", section: "architecture" },
      // Security and access control
      { id: "authn-vs-authz", title: "Authentication vs authorization", blurb: "Who you are versus what you're allowed to do.", status: "soon", section: "security" },
      { id: "oauth-oidc", title: "OAuth 2.0, OpenID Connect and JWTs", blurb: "Sign in with another provider and pass tokens between services safely.", status: "soon", section: "security" },
      { id: "access-control", title: "Role- and attribute-based access control", blurb: "RBAC and ABAC: permissions by role, or by rules about the user and the data.", status: "soon", section: "security" },
      { id: "encryption", title: "Encryption at rest and in transit", blurb: "TLS on the wire, encrypted disks and keys you can rotate.", status: "soon", section: "security" },
      { id: "secrets", title: "Secrets management", blurb: "Keep API keys and passwords out of code, and rotate them without downtime.", status: "soon", section: "security" },
      { id: "audit-logs", title: "Audit logs", blurb: "Record who did what and when, in a log nobody can quietly edit.", status: "soon", section: "security" },
      { id: "threat-modeling", title: "Threat modeling and security boundaries", blurb: "Map where untrusted input enters and what an attacker could reach.", status: "soon", section: "security" },
      { id: "web-vulnerabilities", title: "XSS, CSRF and SQL injection", blurb: "The classic web attacks from the OWASP Top 10, and what stops each one.", status: "soon", section: "security" },
      { id: "ddos-waf", title: "DDoS protection and WAFs", blurb: "Absorb floods of traffic and filter bad requests before they reach your servers.", status: "soon", section: "security" },
      // Production engineering
      { id: "observability", title: "Logs, metrics and distributed tracing", blurb: "Follow one slow request across five services.", status: "soon", section: "production" },
      { id: "monitoring-alerting", title: "Monitoring, SLOs and alerting", blurb: "Alert on what users feel, not on every CPU spike.", status: "soon", section: "production" },
      { id: "deployment-strategies", title: "Blue-green and canary deployments", blurb: "Ship to a small slice of traffic first, and roll back in seconds.", status: "soon", section: "production" },
      { id: "infrastructure-as-code", title: "Infrastructure as code", blurb: "Describe servers and networks in files you can review and repeat.", status: "soon", section: "production" },
      { id: "capacity-planning", title: "Capacity planning and cost optimization", blurb: "Forecast growth, size for the peak, and stop paying for idle machines.", status: "soon", section: "production" },
      { id: "feature-flags", title: "Feature flags", blurb: "Ship code dark, turn it on for 1% of users, and switch it off without a deploy.", status: "soon", section: "production" },
      { id: "chaos-engineering", title: "Chaos engineering", blurb: "Break things on purpose in a controlled way to find weak spots first.", status: "soon", section: "production" },
      { id: "incident-response", title: "Incident response and postmortems", blurb: "Roles, communication and a blameless write-up when production goes down.", status: "soon", section: "production" },
      // Web application design
      { id: "frontend-architecture", title: "Frontend architecture", blurb: "Component boundaries, state, data fetching and rendering choices.", status: "soon", section: "web" },
      { id: "backend-architecture", title: "Backend architecture", blurb: "API boundaries, service layers and where business rules live.", status: "soon", section: "web" },
      { id: "api-design", title: "API design: pagination, versioning and errors", blurb: "Resource modeling, cursors vs offsets, validation and useful error responses.", status: "soon", section: "web" },
      { id: "session-auth", title: "Sessions, tokens and refresh flows", blurb: "Cookies or tokens, short-lived access and safe refresh.", status: "soon", section: "web" },
      { id: "realtime", title: "Real-time: WebSockets, SSE and presence", blurb: "Push live updates and show who is online, and what each approach costs.", status: "soon", section: "web" },
      { id: "file-uploads", title: "File uploads and object storage", blurb: "Signed URLs, multipart uploads and processing media after upload.", status: "soon", section: "web" },
      { id: "background-jobs", title: "Background jobs and scheduling", blurb: "Workers, retries, cron and dead-letter queues for work users shouldn't wait on.", status: "soon", section: "web" },
      { id: "multi-tenancy", title: "Multi-tenancy", blurb: "Keep each customer's data apart, with per-tenant settings and limits.", status: "soon", section: "web" },
      { id: "search", title: "Search: indexing, filtering and ranking", blurb: "Full-text search that returns the right results first.", status: "soon", section: "web" },
      { id: "offline-sync", title: "Mobile and offline sync", blurb: "Local databases, syncing back, resolving conflicts and push notifications.", status: "soon", section: "web" },
      { id: "collaborative-editing", title: "Collaborative editing", blurb: "Two people type in the same document: operational transforms and CRDTs.", status: "soon", section: "web" },
      { id: "email-notifications", title: "Email and notification delivery", blurb: "Queues, providers, retries, preferences and not sending the same alert twice.", status: "soon", section: "web" },
      // AI: LLM application architecture
      { id: "llm-gateway", title: "LLM gateways: routing, fallbacks and versions", blurb: "Pick a model per request, fall back when a provider fails, and pin versions.", status: "soon", section: "ai-apps" },
      { id: "prompt-versioning", title: "Prompt templates and versioning", blurb: "Treat prompts like code: templates, versions and safe rollouts.", status: "soon", section: "ai-apps" },
      { id: "token-budgets", title: "Context windows and token budgets", blurb: "Decide what fits in the prompt when everything can't.", status: "soon", section: "ai-apps" },
      { id: "streaming-responses", title: "Streaming responses", blurb: "Send tokens as they're generated, through every hop to the browser.", status: "soon", section: "ai-apps" },
      { id: "inference-cost", title: "Inference latency and token cost", blurb: "Where the seconds and the money go, and how to cut both.", status: "soon", section: "ai-apps" },
      { id: "prompt-rag-finetune", title: "Prompting vs RAG vs fine-tuning", blurb: "Which one to reach for: missing knowledge, missing behavior, or missing format.", status: "soon", section: "ai-apps" },
      { id: "semantic-caching", title: "Semantic caching", blurb: "Reuse an answer when a new question means the same thing as an old one.", status: "soon", section: "ai-apps" },
      // AI: RAG and knowledge systems
      { id: "document-ingestion", title: "Document ingestion and chunking", blurb: "Parse PDFs and pages, then split them so each chunk still makes sense.", status: "soon", section: "ai-rag" },
      { id: "vector-databases", title: "Embeddings and vector databases", blurb: "Store vectors, search them fast, and filter by metadata.", status: "soon", section: "ai-rag" },
      { id: "retrieval-evaluation", title: "Retrieval evaluation and reranking", blurb: "Measure whether the right chunks come back, then reorder them.", status: "soon", section: "ai-rag" },
      { id: "citations", title: "Citations and source attribution", blurb: "Show which document each part of the answer came from.", status: "soon", section: "ai-rag" },
      { id: "incremental-indexing", title: "Incremental indexing", blurb: "Update the index when one document changes, without rebuilding everything.", status: "soon", section: "ai-rag" },
      { id: "re-embedding", title: "Changing embedding models", blurb: "Swap the embedding model without breaking search: dual indexes and backfills.", status: "soon", section: "ai-rag" },
      // AI: Agents and orchestration
      { id: "tool-execution", title: "Tool execution and sandboxing", blurb: "Run the tool the model asked for, safely, with limits.", status: "soon", section: "ai-agents" },
      { id: "agent-state-machines", title: "Agent loops and state machines", blurb: "Model an agent as explicit states so you can see and resume where it is.", status: "soon", section: "ai-agents" },
      { id: "workflows-vs-agents", title: "Workflows vs autonomous agents", blurb: "Fixed steps you control, or a model that decides the next step.", status: "soon", section: "ai-agents" },
      { id: "task-planning", title: "Planning and task decomposition", blurb: "Break a big request into steps, and replan when one fails.", status: "soon", section: "ai-agents" },
      { id: "multi-agent", title: "Multi-agent coordination", blurb: "Several agents share work: hand-offs, shared state and conflicts.", status: "soon", section: "ai-agents" },
      { id: "durable-execution", title: "Durable execution and recovery", blurb: "Crash mid-task and resume from the last step instead of starting over.", status: "soon", section: "ai-agents" },
      // AI: Context and memory
      { id: "conversation-state", title: "Conversation and session state", blurb: "Store the chat so it survives reloads, devices and server restarts.", status: "soon", section: "ai-memory" },
      { id: "agent-memory", title: "Short-term and long-term memory", blurb: "Working memory, semantic facts and episodes: what to keep and for how long.", status: "soon", section: "ai-memory" },
      { id: "memory-updates", title: "Memory extraction, updates and conflicts", blurb: "Pull facts from chats, fix wrong ones, and resolve contradictions.", status: "soon", section: "ai-memory" },
      { id: "context-compression", title: "Context selection and compression", blurb: "Summarize and pick what matters when the history is too long.", status: "soon", section: "ai-memory" },
      { id: "memory-isolation", title: "Per-user memory and isolation", blurb: "One user's memories must never reach another user.", status: "soon", section: "ai-memory" },
      // AI: Evaluation and quality
      { id: "golden-datasets", title: "Golden datasets and regression tests", blurb: "A fixed set of questions with known good answers, run on every change.", status: "soon", section: "ai-quality" },
      { id: "answer-quality", title: "Retrieval quality vs answer quality", blurb: "Faithfulness, relevance and correctness: find which stage caused a bad answer.", status: "soon", section: "ai-quality" },
      { id: "online-evals", title: "Online evals, A/B tests and feedback", blurb: "Measure quality on real traffic and feed it back into the next version.", status: "soon", section: "ai-quality" },
      { id: "agent-tracing", title: "Tracing and debugging agents", blurb: "See every model call, tool call and decision in one timeline.", status: "soon", section: "ai-quality" },
      // AI: Model serving and infrastructure
      { id: "hosted-vs-self-hosted", title: "Hosted APIs vs self-hosted models", blurb: "Pay per token or run your own GPUs: cost, control and effort.", status: "soon", section: "ai-serving" },
      { id: "inference-batching", title: "GPU capacity, batching and queueing", blurb: "Group requests to keep GPUs busy without making users wait.", status: "soon", section: "ai-serving" },
      { id: "quantization", title: "Quantization and serving optimization", blurb: "Smaller numbers, smaller models, faster answers, and what you lose.", status: "soon", section: "ai-serving" },
      { id: "provider-limits", title: "Provider rate limits and quotas", blurb: "Stay under tokens-per-minute limits across many users and keys.", status: "soon", section: "ai-serving" },
      // AI: Security and governance
      { id: "prompt-injection", title: "Prompt injection, direct and indirect", blurb: "Instructions hidden in user input or in a retrieved document take over the model.", status: "soon", section: "ai-security" },
      { id: "tool-permissions", title: "Tool permissions and least privilege", blurb: "Give an agent only the tools and scopes this task needs.", status: "soon", section: "ai-security" },
      { id: "data-leakage", title: "Sensitive-data leakage", blurb: "Stop secrets and personal data from reaching prompts, logs or other users.", status: "soon", section: "ai-security" },
      { id: "permission-aware-retrieval", title: "Tenant-aware retrieval", blurb: "Only retrieve documents the current user is allowed to see.", status: "soon", section: "ai-security" },
      { id: "output-validation", title: "Output validation and action approval", blurb: "Check what the model produced before the backend acts on it.", status: "soon", section: "ai-security" },
      { id: "ai-audit", title: "AI auditability and data retention", blurb: "Keep a record of what the model saw and did, for as long as you need it, and no longer.", status: "soon", section: "ai-security" },
      { id: "guardrails", title: "Guardrails and content moderation", blurb: "Check inputs and outputs for unsafe content, off-topic requests and policy breaks.", status: "soon", section: "ai-security" },
      // Specialized systems
      { id: "payments-ledgers", title: "Payments and ledgers", blurb: "Double-entry ledgers, reconciliation and never losing a cent.", status: "soon", section: "specialized" },
      { id: "data-pipelines", title: "Event pipelines and data warehouses", blurb: "Move events into analytics: batch vs streaming, and late data.", status: "soon", section: "specialized" },
      { id: "object-storage", title: "Distributed object storage", blurb: "How systems like S3 store and replicate huge numbers of files.", status: "soon", section: "specialized" },
      { id: "multi-region", title: "Multi-region systems", blurb: "Serve users from several regions: latency, failover and data residency.", status: "soon", section: "specialized" },
      { id: "edge-iot", title: "Edge and IoT systems", blurb: "Devices with patchy connections: telemetry, sync and updates.", status: "soon", section: "specialized" },
      // Case studies: design a system
      { id: "design-url-shortener", title: "Design a URL shortener", blurb: "Short codes, redirects at scale, and counting clicks.", status: "soon", section: "case-studies" },
      { id: "design-rate-limiter", title: "Design a rate limiter", blurb: "A shared limiter for many servers: where counters live and what happens when it fails.", status: "soon", section: "case-studies" },
      { id: "design-notification-system", title: "Design a notification system", blurb: "Push, email and SMS to millions of users, with preferences and retries.", status: "soon", section: "case-studies" },
      { id: "design-chat", title: "Design a chat app", blurb: "Messages, delivery receipts, presence and group chats.", status: "soon", section: "case-studies" },
      { id: "design-news-feed", title: "Design a news feed", blurb: "Fan-out on write vs fan-out on read, and what to do about celebrities.", status: "soon", section: "case-studies" },
      { id: "design-autocomplete", title: "Design search autocomplete", blurb: "Suggestions in under 100 ms as the user types.", status: "soon", section: "case-studies" },
      { id: "design-file-sync", title: "Design file sync (like Dropbox)", blurb: "Chunked uploads, deduplication and syncing edits across devices.", status: "soon", section: "case-studies" },
      { id: "design-video-streaming", title: "Design video streaming", blurb: "Upload, transcode, and adaptive bitrate playback through a CDN.", status: "soon", section: "case-studies" },
      { id: "design-ride-sharing", title: "Design ride sharing (like Uber)", blurb: "Find nearby drivers with geohashing and match them in real time.", status: "soon", section: "case-studies" },
      { id: "design-web-crawler", title: "Design a web crawler", blurb: "Crawl billions of pages politely, without fetching the same page twice.", status: "soon", section: "case-studies" },
      { id: "design-payment-system", title: "Design a payment system", blurb: "Charge exactly once, keep a ledger, and reconcile with the bank.", status: "soon", section: "case-studies" },
      { id: "design-document-assistant", title: "Design a document assistant", blurb: "RAG with citations that only shows each user documents they're allowed to read.", status: "soon", section: "case-studies" },
      { id: "design-coding-agent", title: "Design a coding agent", blurb: "Read the repo, propose a fix, run the tests, and report the evidence.", status: "soon", section: "case-studies" },
    ],
    roadmap: ["Foundations and trade-offs", "Distributed systems and production design", "AI application architecture", "Agent and AI production systems", "Advanced architecture"],
    projects: ["Design a URL shortener", "Design a chat service", "Design a news feed"],
  },
  {
    id: "devops",
    title: "DevOps",
    short: "DevOps",
    tagline: "Ship, scale and recover. See every step of the pipeline move.",
    accent: "var(--ops)",
    sections: [
      { id: "linux", title: "Linux and the command line", blurb: "The operating system every server runs." },
      { id: "networking", title: "Networking for DevOps", blurb: "How traffic reaches your servers.", related: ["system-design/request-journey"] },
      { id: "git", title: "Version control and collaboration", blurb: "Working on the same code without stepping on each other." },
      { id: "containers", title: "Containers", blurb: "Package an app with everything it needs." },
      { id: "ci-cd", title: "CI/CD", blurb: "From a commit to production, automatically.", related: ["tools/github-actions", "system-design/deployment-strategies", "system-design/feature-flags"] },
      { id: "kubernetes", title: "Kubernetes", blurb: "Run containers across many machines." },
      { id: "iac", title: "Infrastructure as code", blurb: "Servers and networks described in files.", related: ["system-design/infrastructure-as-code"] },
      { id: "cloud", title: "Cloud platforms", blurb: "Renting computers, storage and services.", related: ["system-design/object-storage", "system-design/multi-region"] },
      { id: "observability", title: "Observability", blurb: "See what production is doing.", related: ["system-design/observability", "system-design/monitoring-alerting"] },
      { id: "sre", title: "SRE and reliability", blurb: "Keeping production healthy as a practice.", related: ["system-design/availability", "system-design/incident-response", "system-design/chaos-engineering", "system-design/failover-dr"] },
      { id: "devsecops", title: "DevSecOps", blurb: "Security built into the pipeline.", related: ["system-design/secrets", "system-design/threat-modeling"] },
      { id: "platform", title: "Platform engineering", blurb: "Making the right way the easy way." },
      { id: "devops-projects", title: "Case studies: run it in production", blurb: "Put the pieces together end to end." },
    ],
    sessions: [
      // Linux and the command line
      { id: "linux-processes", title: "Processes, signals and systemd", blurb: "Start, stop and supervise programs, and what happens on kill -9.", status: "soon", section: "linux" },
      { id: "files-permissions", title: "Files, users and permissions", blurb: "Who can read, write and run what, and why chmod 777 is a bad fix.", status: "soon", section: "linux" },
      { id: "shell-scripting", title: "Shell scripting and pipes", blurb: "Chain small commands into a script that does real work.", status: "soon", section: "linux" },
      { id: "system-resources", title: "CPU, memory and disk", blurb: "Read top, free and df, and find what is slowing the machine down.", status: "soon", section: "linux" },
      { id: "package-management", title: "Package management", blurb: "Install, pin and update software with apt, yum and friends.", status: "soon", section: "linux" },
      { id: "ssh", title: "SSH and remote access", blurb: "Keys, agents, jump hosts and logging in without passwords.", status: "soon", section: "linux" },
      // Networking for DevOps
      { id: "ip-subnets", title: "IP addresses, subnets and CIDR", blurb: "What 10.0.0.0/16 means, and how to split a network into subnets.", status: "soon", section: "networking" },
      { id: "ports-firewalls", title: "Ports, firewalls and security groups", blurb: "Open exactly the ports you need and block everything else.", status: "soon", section: "networking" },
      { id: "dns-records", title: "DNS records in practice", blurb: "A, CNAME, MX and TXT records, TTLs, and why a DNS change takes time.", status: "soon", section: "networking" },
      { id: "reverse-proxy-config", title: "Reverse proxies in practice", blurb: "Put NGINX in front of an app: routing, headers and timeouts.", status: "soon", section: "networking" },
      { id: "tls-certificates", title: "TLS certificates", blurb: "Issue, install and auto-renew certificates with Let's Encrypt.", status: "soon", section: "networking" },
      { id: "vpc", title: "VPCs, public and private subnets", blurb: "Keep databases off the internet and still let servers reach out.", status: "soon", section: "networking" },
      // Version control and collaboration
      { id: "git-internals", title: "How Git stores history", blurb: "Commits, trees and blobs: what a branch really is.", status: "soon", section: "git" },
      { id: "branching-strategies", title: "Trunk-based development vs GitFlow", blurb: "Short-lived branches or long release branches, and how each affects merges.", status: "soon", section: "git" },
      { id: "pull-requests", title: "Pull requests and code review", blurb: "Small changes, required checks and review rules that keep main green.", status: "soon", section: "git" },
      { id: "monorepo-vs-polyrepo", title: "Monorepo vs polyrepo", blurb: "One repository for everything, or one per service.", status: "soon", section: "git" },
      { id: "releases-versioning", title: "Semantic versioning and releases", blurb: "Version numbers, changelogs and tagging a release.", status: "soon", section: "git" },
      // Containers
      { id: "containers-vs-vms", title: "Containers vs virtual machines", blurb: "Start a container, then boot a VM, and see what each one shares.", status: "live", section: "containers",
        shape: { kind: "comparison", steps: 2 } },
      { id: "images-layers", title: "Images and layers", blurb: "How an image is built from layers, and why order in a Dockerfile matters.", status: "soon", section: "containers" },
      { id: "dockerfiles", title: "Writing a good Dockerfile", blurb: "Build caching, multi-stage builds and small images.", status: "soon", section: "containers" },
      { id: "container-networking", title: "Container networking", blurb: "Bridges, port mapping and containers finding each other by name.", status: "soon", section: "containers" },
      { id: "volumes", title: "Volumes and persistent data", blurb: "Keep data when the container is deleted.", status: "soon", section: "containers" },
      { id: "docker-compose", title: "Docker Compose", blurb: "Run an app, its database and its cache together with one file.", status: "soon", section: "containers" },
      { id: "container-registries", title: "Container registries", blurb: "Push, pull, tag and clean up images.", status: "soon", section: "containers" },
      { id: "container-security", title: "Container security", blurb: "Scan images, run as non-root, and drop what the app doesn't need.", status: "soon", section: "containers" },
      // CI/CD
      { id: "ci-cd-pipeline", title: "A CI/CD pipeline, stage by stage", blurb: "Break a test or a build and see where the pipeline stops.", status: "live", section: "ci-cd",
        shape: { kind: "system", steps: 5, flow: "pipeline" } },
      { id: "pipeline-tests", title: "Tests in the pipeline", blurb: "Which tests run on every commit, which run nightly, and why the order matters.", status: "soon", section: "ci-cd" },
      { id: "build-caching", title: "Build caching and artifacts", blurb: "Stop rebuilding what didn't change, and keep the exact build you ship.", status: "soon", section: "ci-cd" },
      { id: "environments", title: "Dev, staging, production and preview environments", blurb: "How many environments you need, and keeping them alike.", status: "soon", section: "ci-cd" },
      { id: "gitops", title: "GitOps", blurb: "Git is the source of truth; a controller makes the cluster match it.", status: "soon", section: "ci-cd" },
      { id: "supply-chain", title: "Software supply chain security", blurb: "Lock files, SBOMs, signed images and trusting what you deploy.", status: "soon", section: "ci-cd" },
      // Kubernetes
      { id: "k8s-architecture", title: "Control plane, nodes and pods", blurb: "What each part of a cluster does, and what happens when you apply a manifest.", status: "soon", section: "kubernetes" },
      { id: "deployments-replicasets", title: "Deployments and ReplicaSets", blurb: "Declare how many copies you want and let Kubernetes keep it true.", status: "soon", section: "kubernetes" },
      { id: "rolling-deploys", title: "Kubernetes rolling deploys", blurb: "Roll out a bad version and watch probes and rollback kick in.", status: "live", section: "kubernetes",
        shape: { kind: "system", steps: 5, flow: "cycle" } },
      { id: "services-ingress", title: "Services and Ingress", blurb: "Give pods a stable address and route outside traffic to them.", status: "soon", section: "kubernetes" },
      { id: "configmaps-secrets", title: "ConfigMaps and Secrets", blurb: "Pass configuration and credentials to pods without rebuilding images.", status: "soon", section: "kubernetes" },
      { id: "probes", title: "Liveness, readiness and startup probes", blurb: "Tell Kubernetes when to restart a pod and when to send it traffic.", status: "soon", section: "kubernetes" },
      { id: "resource-limits", title: "Requests, limits and OOM kills", blurb: "Reserve CPU and memory, and see what happens when a pod uses too much.", status: "soon", section: "kubernetes" },
      { id: "pod-autoscaling", title: "Horizontal pod autoscaling", blurb: "Add pods when CPU or queue length climbs.", status: "soon", section: "kubernetes" },
      { id: "statefulsets", title: "StatefulSets and persistent volumes", blurb: "Run databases on Kubernetes: stable names and disks that follow the pod.", status: "soon", section: "kubernetes" },
      { id: "helm-kustomize", title: "Helm and Kustomize", blurb: "Package and customize manifests for each environment.", status: "soon", section: "kubernetes" },
      { id: "scheduling", title: "Scheduling, taints and affinity", blurb: "Decide which pods land on which nodes.", status: "soon", section: "kubernetes" },
      // Infrastructure as code
      { id: "terraform-plan-apply", title: "Terraform: plan and apply", blurb: "Describe infrastructure, preview the change, then apply it.", status: "soon", section: "iac" },
      { id: "terraform-state", title: "State, locking and drift", blurb: "Where Terraform remembers what exists, and what happens when someone clicks in the console.", status: "soon", section: "iac" },
      { id: "terraform-modules", title: "Modules and reuse", blurb: "Package a VPC or a database once and reuse it everywhere.", status: "soon", section: "iac" },
      { id: "config-management", title: "Configuration management with Ansible", blurb: "Configure many existing servers the same way, repeatably.", status: "soon", section: "iac" },
      { id: "immutable-infrastructure", title: "Immutable infrastructure", blurb: "Replace servers instead of patching them in place.", status: "soon", section: "iac" },
      { id: "policy-as-code", title: "Policy as code", blurb: "Block risky changes automatically, like a public bucket or an open port.", status: "soon", section: "iac" },
      // Cloud platforms
      { id: "cloud-models", title: "IaaS, PaaS, SaaS and serverless", blurb: "How much you manage yourself at each level.", status: "soon", section: "cloud" },
      { id: "regions-zones", title: "Regions and availability zones", blurb: "Spread across zones so one data center failing doesn't take you down.", status: "soon", section: "cloud" },
      { id: "compute-options", title: "VMs, containers or functions", blurb: "Pick where your code runs, by cost, control and scale.", status: "soon", section: "cloud" },
      { id: "cloud-storage", title: "Block, file and object storage", blurb: "Disks, shared drives and buckets, and when to use each.", status: "soon", section: "cloud" },
      { id: "managed-databases", title: "Managed databases", blurb: "Let the provider run backups, failover and patches, and what you give up.", status: "soon", section: "cloud" },
      { id: "cloud-iam", title: "Cloud IAM: roles and policies", blurb: "Grant services and people exactly the access they need.", status: "soon", section: "cloud" },
      { id: "serverless", title: "Serverless functions", blurb: "Cold starts, timeouts, concurrency limits and paying per call.", status: "soon", section: "cloud" },
      { id: "cloud-costs", title: "Cloud cost management", blurb: "See where the bill comes from and cut it: rightsizing, reserved and spot capacity.", status: "soon", section: "cloud" },
      // Observability
      { id: "structured-logging", title: "Structured logs and log aggregation", blurb: "JSON logs, shipped to one place, searchable by request ID.", status: "soon", section: "observability" },
      { id: "prometheus-metrics", title: "Metrics with Prometheus", blurb: "Counters, gauges and histograms, scraped and queried.", status: "soon", section: "observability" },
      { id: "dashboards", title: "Dashboards that answer questions", blurb: "The four golden signals: latency, traffic, errors and saturation.", status: "soon", section: "observability" },
      { id: "opentelemetry", title: "Tracing with OpenTelemetry", blurb: "Instrument services once and send traces anywhere.", status: "soon", section: "observability" },
      { id: "alerts-oncall", title: "Alerts and on-call", blurb: "Page a person only when users are hurting, and route it to the right one.", status: "soon", section: "observability" },
      // SRE and reliability
      { id: "slos-error-budgets", title: "SLIs, SLOs and error budgets", blurb: "Agree how reliable is reliable enough, and spend the rest on shipping.", status: "soon", section: "sre" },
      { id: "runbooks", title: "Runbooks", blurb: "Step-by-step fixes for known problems, written before 3 a.m.", status: "soon", section: "sre" },
      { id: "backups-restore", title: "Backups and restore drills", blurb: "A backup you have never restored is not a backup.", status: "soon", section: "sre" },
      { id: "toil-automation", title: "Toil and automation", blurb: "Find repetitive manual work and automate it away.", status: "soon", section: "sre" },
      { id: "capacity-load-testing", title: "Load testing", blurb: "Find the breaking point before your users do.", status: "soon", section: "sre" },
      // DevSecOps
      { id: "pipeline-secrets", title: "Secrets in pipelines and clusters", blurb: "Keep tokens out of logs and images, and rotate them safely.", status: "soon", section: "devsecops" },
      { id: "vulnerability-scanning", title: "Dependency and image scanning", blurb: "Find known vulnerabilities before they ship, and decide what to fix first.", status: "soon", section: "devsecops" },
      { id: "network-policies", title: "Kubernetes network policies", blurb: "Only let the pods that need to talk, talk.", status: "soon", section: "devsecops" },
      { id: "audit-compliance", title: "Audit trails and compliance", blurb: "Prove who changed what in production, for SOC 2 and similar audits.", status: "soon", section: "devsecops" },
      // Platform engineering
      { id: "developer-platforms", title: "Internal developer platforms", blurb: "One place for teams to create services, deploy and see their status.", status: "soon", section: "platform" },
      { id: "golden-paths", title: "Golden paths and templates", blurb: "A ready-made starting point with CI, monitoring and security already wired in.", status: "soon", section: "platform" },
      { id: "dora-metrics", title: "DORA metrics", blurb: "Deploy frequency, lead time, change failure rate and time to restore.", status: "soon", section: "platform" },
      // Case studies: run it in production
      { id: "ship-node-app", title: "Ship an app from laptop to Kubernetes", blurb: "Containerize it, build it in CI, deploy it, and expose it with TLS.", status: "soon", section: "devops-projects" },
      { id: "zero-downtime-release", title: "A zero-downtime release", blurb: "Database migration plus a canary rollout, with a rollback plan.", status: "soon", section: "devops-projects" },
      { id: "preview-environments", title: "Preview environments for every pull request", blurb: "Spin up a full copy of the app per PR and tear it down on merge.", status: "soon", section: "devops-projects" },
      { id: "outage-drill", title: "Run an outage drill", blurb: "Kill a database at noon, follow the runbook, and write the postmortem.", status: "soon", section: "devops-projects" },
    ],
    roadmap: ["Linux, networking and Git", "Containers and CI/CD", "Kubernetes and infrastructure as code", "Cloud, observability and SRE", "Security and platform engineering"],
    projects: ["Containerise and deploy a Node app", "Build a CI pipeline with tests and previews", "Set up metrics, logs and alerts"],
  },
  {
    id: "ai",
    title: "AI Engineering",
    short: "AI",
    tagline: "Open up the model and tune the knobs yourself.",
    learningPathBlurb:
      "Tokens, attention and sampling show how the model reads and writes. Then the context window, search and retrieval decide what it sees, and evals tell you if it worked.",
    accent: "var(--ai)",
    sessions: [
      {
        id: "tokenization",
        title: "How text becomes tokens",
        blurb: "Train a tiny BPE tokenizer merge by merge, then type your own text and count the tokens.",
        status: "live",
        shape: { kind: "algorithm", steps: 5, flow: "state" },
      },
      {
        id: "attention",
        title: "Attention, one head",
        blurb: "Pick a word and see which words it looks at: score, scale, mask, softmax, blend.",
        status: "live",
        shape: { kind: "process", steps: 6, flow: "pipeline", richSteps: true },
      },
      {
        id: "next-token",
        tag: "AI #02",
        title: "How an LLM picks the next token",
        blurb: "Drag temperature, top-k and top-p. Watch the odds move, then sample.",
        status: "live",
        shape: { kind: "process", steps: 8, flow: "cycle", richSteps: true },
      },
      {
        id: "context-window",
        title: "The context window, turn by turn",
        blurb: "Play a long chat and watch the prompt fill the window. Then trim it, and see what it costs.",
        status: "live",
        shape: { kind: "process", steps: 6, flow: "cycle" },
      },
      { id: "embeddings", title: "Embeddings and similarity search", blurb: "Move a query in vector space and see which notes come back.", status: "live",
        shape: { kind: "process", steps: 4, flow: "pipeline", richSteps: true } },
      {
        id: "hybrid-search",
        title: "Hybrid search and reranking",
        blurb: "Keyword search, vector search, rank fusion and a reranker. See which one finds the right note.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
      { id: "rag", title: "RAG, step by step", blurb: "Chunk, retrieve and prompt, and see what the model actually gets.", status: "live",
        shape: { kind: "system", steps: 6, flow: "pipeline", richSteps: true } },
      {
        id: "evals",
        title: "Evals: is the new prompt better?",
        blurb: "Grade two prompt versions with code checks and an LLM judge, then check the judge against people.",
        status: "live",
        shape: { kind: "process", steps: 6, flow: "pipeline", richSteps: true },
      },
      {
        id: "agent-patterns",
        title: "Agent patterns: workflow or agent?",
        blurb: "Chaining, routing, parallel calls, orchestrator-workers, evaluator loops and a true agent, side by side.",
        status: "live",
        shape: { kind: "comparison", steps: 6 },
      },
    ],
    roadmap: ["Tokens & attention", "Sampling & the context window", "Embeddings & hybrid search", "RAG", "Evaluation", "Agents & tools"],
    projects: ["Build a RAG chatbot over your docs", "Build a tool-using agent", "Write an eval harness"],
  },
  {
    id: "ai-native",
    title: "AI Native",
    short: "AI Native",
    tagline: "Build products where the model is the interface, and the output has a shape.",
    accent: "var(--native)",
    sessions: [
      {
        id: "structured-output",
        title: "Force valid JSON",
        blurb: "Turn a schema on and watch illegal tokens get refused.",
        status: "live",
        shape: { kind: "process", steps: 4, flow: "pipeline", richSteps: true },
      },
      {
        id: "tool-calling",
        title: "Call a tool, then answer",
        blurb: "Give the model a weather tool, then take it away and watch it guess.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
    ],
    roadmap: ["The model as the product", "Structured output", "Tools and agents", "Evals", "Shipping a model feature"],
    projects: ["A support reply that only returns JSON", "An agent with two tools", "An eval set of 20 questions"],
  },
  {
    id: "ai-automation",
    title: "AI Automation",
    short: "Automation",
    tagline: "Run work without a person in every step, and pause where a person still matters.",
    accent: "var(--auto)",
    sessions: [
      {
        id: "workflow",
        title: "One item through a workflow",
        blurb: "Send three different emails down the same path and watch the branch change.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
      {
        id: "human-approval",
        title: "Pause for a person",
        blurb: "Draft a refund, then approve or reject it before anything is sent.",
        status: "live",
        shape: { kind: "system", steps: 4, flow: "pipeline" },
      },
      {
        id: "schedules",
        title: "Run it on a schedule",
        blurb: "Fire the same workflow on a clock and see what a missed run does.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "cycle" },
      },
    ],
    roadmap: ["Triggers", "Branches", "Human approval", "Schedules and retries", "Watching failures"],
    projects: ["Triage an inbox into Slack", "Approve refunds before they send", "A daily digest that runs at 8am"],
  },
  {
    id: "tools",
    title: "Tools",
    short: "Tools",
    tagline: "See how the tools around the model actually move: agents, MCP, and workflow builders.",
    accent: "var(--tools)",
    sessions: [
      {
        id: "cursor-agent",
        title: "A coding agent's loop",
        blurb: "Watch search, edit, and a check repeat until the test passes.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "cycle", richSteps: true },
      },
      {
        id: "mcp",
        title: "MCP: tools the model can call",
        blurb: "A server lists tools. The app forwards the one the model picks.",
        status: "live",
        shape: { kind: "system", steps: 6, flow: "pipeline" },
      },
      {
        id: "n8n",
        title: "An n8n workflow, node by node",
        blurb: "Cross a threshold and see the run switch from email to Slack.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
      {
        id: "github-actions",
        title: "GitHub Actions on every push",
        blurb: "Follow a workflow file from the push event to the job log.",
        status: "live",
        shape: { kind: "system", steps: 5, flow: "pipeline" },
      },
    ],
    roadmap: ["Coding agents", "MCP and tool servers", "Workflow builders", "CI tools", "Model APIs"],
    projects: ["Connect one MCP tool", "An n8n flow with a branch", "A GitHub Action that runs tests"],
  },
];

export const getTrack = (id: string) => TRACKS.find((t) => t.id === id);

export const trackHref = (t: Track) => `/tracks/${t.id}`;
export const sessionHref = (t: Track, s: Session) => `/tracks/${t.id}/${s.id}`;

export const getSession = (trackId: string, sessionId: string) => {
  const track = getTrack(trackId);
  const session = track?.sessions.find((s) => s.id === sessionId);
  return track && session ? { track, session } : undefined;
};

// every live session, in track order: used for static routes
export const liveSessions = () =>
  TRACKS.flatMap((track) =>
    track.sessions.filter((s) => s.status === "live").map((session) => ({ track, session })),
  );

/** Home hero: one flagship session, not necessarily first in catalog order */
export const homeStartSession = () => {
  const featured = getSession("ai", "next-token");
  if (featured?.session.status === "live") return featured;
  return liveSessions()[0];
};

// previous and next session in the same track, so a learner can keep going
export const neighbours = (track: Track, sessionId: string) => {
  const i = track.sessions.findIndex((s) => s.id === sessionId);
  return { prev: track.sessions[i - 1], next: track.sessions[i + 1] };
};

export const liveCount = (t: Track) => t.sessions.filter((s) => s.status === "live").length;

// the first live session in a track: where its "Start" button goes
export const firstLive = (t: Track) => t.sessions.find((s) => s.status === "live");

// A track's sessions under its section headings, in section order. Tracks with no sections
// come back as one unnamed group. Sessions with an unknown section land in "Other".
export const sessionGroups = (t: Track) => {
  if (!t.sections?.length) return [{ section: null, sessions: t.sessions }];
  const known = new Set(t.sections.map((x) => x.id));
  const groups = t.sections.map((section) => ({ section, sessions: t.sessions.filter((s) => s.section === section.id) }));
  const rest = t.sessions.filter((s) => !s.section || !known.has(s.section));
  return rest.length ? [...groups, { section: { id: "other", title: "Other" } as TrackSection, sessions: rest }] : groups;
};

/**
 * The layout for a live session, from its declared `shape`.
 * Throws for a live session with no shape, so `next build` fails until the
 * author says what the session contains.
 */
export const layoutFor = (track: Track, session: Session): LayoutDecision => {
  if (!session.shape) {
    throw new Error(
      `Session ${track.id}/${session.id} is live but has no \`shape\` in src/lib/tracks.ts. ` +
        'Add one (kind, steps, flow, richSteps) so its layout can be chosen. See "Choosing a session layout" in README.md.',
    );
  }
  return chooseLayout(session.shape);
};
