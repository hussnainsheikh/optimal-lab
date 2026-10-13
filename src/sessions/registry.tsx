// Maps "<track id>/<session id>" to the interactive component for that session.
// A session in src/lib/tracks.ts with status "live" must have an entry here.

import type { ReactNode } from "react";
import AttentionDemo from "./ai/attention/AttentionDemo";
import ContextWindowDemo from "./ai/context-window/ContextWindowDemo";
import EmbeddingsDemo from "./ai/embeddings/EmbeddingsDemo";
import EvalsDemo from "./ai/evals/EvalsDemo";
import HybridSearchDemo from "./ai/hybrid-search/HybridSearchDemo";
import NextTokenDemo from "./ai/next-token/NextTokenDemo";
import RagDemo from "./ai/rag/RagDemo";
import TokenizationDemo from "./ai/tokenization/TokenizationDemo";
import WorkflowDemo from "./ai-automation/workflow/WorkflowDemo";
import ApprovalDemo from "./ai-automation/human-approval/ApprovalDemo";
import StructuredDemo from "./ai-native/structured-output/StructuredDemo";
import ToolCallDemo from "./ai-native/tool-calling/ToolCallDemo";
import PipelineDemo from "./devops/ci-cd-pipeline/PipelineDemo";
import ContainersDemo from "./devops/containers-vs-vms/ContainersDemo";
import BinarySearchDemo from "./dsa/binary-search/BinarySearchDemo";
import SlidingWindowDemo from "./dsa/sliding-window/SlidingWindowDemo";
import TwoSumDemo from "./dsa/two-sum/TwoSumDemo";
import BackpressureDemo from "./nodejs/streams-backpressure/BackpressureDemo";
import EventLoopDemo from "./nodejs/event-loop/EventLoopDemo";
import CachingDemo from "./system-design/caching/CachingDemo";
import LoadBalanceDemo from "./system-design/load-balancing/LoadBalanceDemo";
import AgentLoopDemo from "./tools/cursor-agent/AgentLoopDemo";
import McpDemo from "./tools/mcp/McpDemo";
import N8nDemo from "./tools/n8n/N8nDemo";

import AgentPatternsDemo from "./ai/agent-patterns/AgentPatternsDemo";
import ChunkingDemo from "./ai/chunking/ChunkingDemo";
import AutoscalingDemo from "./system-design/autoscaling/AutoscalingDemo";
import DeliveryDemo from "./system-design/delivery-guarantees/DeliveryDemo";
import SagaDemo from "./system-design/sagas-outbox/SagaDemo";
import PoolDemo from "./databases/connection-pooling/PoolDemo";
import JoinDemo from "./databases/join-algorithms/JoinDemo";
import NatDemo from "./networking/nat/NatDemo";
import VirtualMemoryDemo from "./operating-systems/virtual-memory/VirtualMemoryDemo";
import CssGridDemo from "./frontend/css-grid/CssGridDemo";
import AsyncAwaitDemo from "./frontend/promises-async/AsyncAwaitDemo";
import SignatureDemo from "./security/digital-signatures/SignatureDemo";
import HeapDemo from "./dsa/heap-top-k/HeapDemo";
import FastSlowDemo from "./dsa/fast-slow-pointers/FastSlowDemo";
import TrieDemo from "./dsa/trie/TrieDemo";
import UnionFindDemo from "./dsa/union-find/UnionFindDemo";
import PrefixSumDemo from "./dsa/prefix-sum/PrefixSumDemo";
import MergeIntervalsDemo from "./dsa/merge-intervals/MergeIntervalsDemo";
import BacktrackingDemo from "./dsa/backtracking/BacktrackingDemo";
import DijkstraDemo from "./dsa/dijkstra/DijkstraDemo";
import TopoSortDemo from "./dsa/topological-sort/TopoSortDemo";
import LruDemo from "./dsa/lru-cache/LruDemo";
import SubnetDemo from "./devops/ip-subnets/SubnetDemo";
import GitObjectsDemo from "./devops/git-internals/GitObjectsDemo";
import TerraformDemo from "./devops/terraform-plan-apply/TerraformDemo";
import SloDemo from "./devops/slos-error-budgets/SloDemo";
import ReactLoopDemo from "./ai/react-loop/ReactLoopDemo";
import StreamingUiDemo from "./ai-native/streaming-ui/StreamingUiDemo";
import RetriesDemo from "./ai-automation/retries-errors/RetriesDemo";
import ConfidenceDemo from "./ai-automation/confidence-fallbacks/ConfidenceDemo";
import RouterDemo from "./tools/model-routers/RouterDemo";
import StreamHopsDemo from "./system-design/streaming-responses/StreamHopsDemo";
import JwtDemo from "./security/jwt/JwtDemo";
import CsrfDemo from "./security/csrf/CsrfDemo";
import SqliDemo from "./security/sql-injection/SqliDemo";
import PipelineStagesDemo from "./frontend/rendering-pipeline/PipelineStagesDemo";
import BrowserLoopDemo from "./frontend/browser-event-loop/BrowserLoopDemo";
import HydrationDemo from "./frontend/hydration/HydrationDemo";
import LcpDemo from "./frontend/core-web-vitals/LcpDemo";
import FlexboxDemo from "./frontend/flexbox/FlexboxDemo";
import ProbesDemo from "./devops/probes/ProbesDemo";
import LimitsDemo from "./devops/resource-limits/LimitsDemo";
import BloomDemo from "./system-design/bloom-filters/BloomDemo";
import SnowflakeDemo from "./system-design/unique-ids/SnowflakeDemo";
import LockDemo from "./system-design/distributed-locks/LockDemo";
import MvccDemo from "./databases/mvcc/MvccDemo";
import LostUpdateDemo from "./databases/isolation-anomalies/LostUpdateDemo";
import DnsDemo from "./networking/dns-resolution/DnsDemo";
import CongestionDemo from "./networking/congestion-control/CongestionDemo";
import DeadlockDemo from "./operating-systems/deadlocks/DeadlockDemo";
import SchedulingDemo from "./operating-systems/cpu-scheduling/SchedulingDemo";
import PasswordDemo from "./security/password-hashing/PasswordDemo";
import LayersDemo from "./devops/images-layers/LayersDemo";
import BlockingDemo from "./nodejs/blocking-the-event-loop/BlockingDemo";
import CapDemo from "./system-design/cap-theorem/CapDemo";
import IdempotencyDemo from "./system-design/idempotency/IdempotencyDemo";
import BtreeDemo from "./databases/btree-index/BtreeDemo";
import ReRendersDemo from "./frontend/re-renders/ReRendersDemo";
import HandshakeDemo from "./networking/tcp-handshake/HandshakeDemo";
import RaceDemo from "./operating-systems/race-conditions/RaceDemo";
import XssDemo from "./security/xss/XssDemo";
import LlmJudgeDemo from "./ai/llm-as-judge/LlmJudgeDemo";
import LoraDemo from "./ai/lora/LoraDemo";
import QueryRewriteDemo from "./ai/query-rewriting/QueryRewriteDemo";
import KvCacheDemo from "./ai/kv-cache/KvCacheDemo";
import TrainingDemo from "./ai/training-loss/TrainingDemo";
import SchedulesDemo from "./ai-automation/schedules/SchedulesDemo";
import RollingDeployDemo from "./devops/rolling-deploys/RollingDeployDemo";
import BfsDfsDemo from "./dsa/bfs-vs-dfs/BfsDfsDemo";
import DynamicProgrammingDemo from "./dsa/dynamic-programming/DynamicProgrammingDemo";
import TreeRecursionDemo from "./dsa/tree-recursion/TreeRecursionDemo";
import HashMapDemo from "./dsa/hash-map/HashMapDemo";
import MonotonicStackDemo from "./dsa/monotonic-stack/MonotonicStackDemo";
import TwoPointersDemo from "./dsa/two-pointers/TwoPointersDemo";
import ThreadPoolDemo from "./nodejs/thread-pool/ThreadPoolDemo";
import ConsistentHashDemo from "./system-design/consistent-hashing/ConsistentHashDemo";
import GithubActionsDemo from "./tools/github-actions/GithubActionsDemo";

import CdnDemo from "./system-design/cdn/CdnDemo";
import CircuitBreakerDemo from "./system-design/circuit-breaker/CircuitBreakerDemo";
import MessageQueueDemo from "./system-design/message-queues/MessageQueueDemo";
import RateLimitDemo from "./system-design/rate-limiting/RateLimitDemo";
import ReplicationDemo from "./system-design/replication/ReplicationDemo";
import ShardingDemo from "./system-design/sharding/ShardingDemo";

const SESSIONS: Record<string, ReactNode> = {
  "dsa/two-sum": <TwoSumDemo />,
  "ai/training-loss": <TrainingDemo />,
  "ai/kv-cache": <KvCacheDemo />,
  "ai/chunking": <ChunkingDemo />,
  "system-design/autoscaling": <AutoscalingDemo />,
  "system-design/delivery-guarantees": <DeliveryDemo />,
  "system-design/sagas-outbox": <SagaDemo />,
  "databases/connection-pooling": <PoolDemo />,
  "databases/join-algorithms": <JoinDemo />,
  "networking/nat": <NatDemo />,
  "operating-systems/virtual-memory": <VirtualMemoryDemo />,
  "frontend/css-grid": <CssGridDemo />,
  "frontend/promises-async": <AsyncAwaitDemo />,
  "security/digital-signatures": <SignatureDemo />,
  "dsa/heap-top-k": <HeapDemo />,
  "dsa/fast-slow-pointers": <FastSlowDemo />,
  "dsa/trie": <TrieDemo />,
  "dsa/union-find": <UnionFindDemo />,
  "dsa/prefix-sum": <PrefixSumDemo />,
  "dsa/merge-intervals": <MergeIntervalsDemo />,
  "dsa/backtracking": <BacktrackingDemo />,
  "dsa/dijkstra": <DijkstraDemo />,
  "dsa/topological-sort": <TopoSortDemo />,
  "dsa/lru-cache": <LruDemo />,
  "devops/ip-subnets": <SubnetDemo />,
  "devops/git-internals": <GitObjectsDemo />,
  "devops/terraform-plan-apply": <TerraformDemo />,
  "devops/slos-error-budgets": <SloDemo />,
  "ai/react-loop": <ReactLoopDemo />,
  "ai-native/streaming-ui": <StreamingUiDemo />,
  "ai-automation/retries-errors": <RetriesDemo />,
  "ai-automation/confidence-fallbacks": <ConfidenceDemo />,
  "tools/model-routers": <RouterDemo />,
  "system-design/streaming-responses": <StreamHopsDemo />,
  "security/jwt": <JwtDemo />,
  "security/csrf": <CsrfDemo />,
  "security/sql-injection": <SqliDemo />,
  "frontend/rendering-pipeline": <PipelineStagesDemo />,
  "frontend/browser-event-loop": <BrowserLoopDemo />,
  "frontend/hydration": <HydrationDemo />,
  "frontend/core-web-vitals": <LcpDemo />,
  "frontend/flexbox": <FlexboxDemo />,
  "devops/probes": <ProbesDemo />,
  "devops/resource-limits": <LimitsDemo />,
  "system-design/bloom-filters": <BloomDemo />,
  "system-design/unique-ids": <SnowflakeDemo />,
  "system-design/distributed-locks": <LockDemo />,
  "databases/mvcc": <MvccDemo />,
  "databases/isolation-anomalies": <LostUpdateDemo />,
  "networking/dns-resolution": <DnsDemo />,
  "networking/congestion-control": <CongestionDemo />,
  "operating-systems/deadlocks": <DeadlockDemo />,
  "operating-systems/cpu-scheduling": <SchedulingDemo />,
  "security/password-hashing": <PasswordDemo />,
  "system-design/idempotency": <IdempotencyDemo />,
  "system-design/cap-theorem": <CapDemo />,
  "devops/images-layers": <LayersDemo />,
  "nodejs/blocking-the-event-loop": <BlockingDemo />,
  "frontend/re-renders": <ReRendersDemo />,
  "databases/btree-index": <BtreeDemo />,
  "networking/tcp-handshake": <HandshakeDemo />,
  "operating-systems/race-conditions": <RaceDemo />,
  "security/xss": <XssDemo />,
  "ai/llm-as-judge": <LlmJudgeDemo />,
  "ai/query-rewriting": <QueryRewriteDemo />,
  "ai/lora": <LoraDemo />,
  "dsa/hash-map": <HashMapDemo />,
  "dsa/two-pointers": <TwoPointersDemo />,
  "dsa/sliding-window": <SlidingWindowDemo />,
  "dsa/monotonic-stack": <MonotonicStackDemo />,
  "dsa/binary-search": <BinarySearchDemo />,
  "dsa/bfs-vs-dfs": <BfsDfsDemo />,
  "dsa/tree-recursion": <TreeRecursionDemo />,
  "dsa/dynamic-programming": <DynamicProgrammingDemo />,
  "nodejs/event-loop": <EventLoopDemo />,
  "nodejs/streams-backpressure": <BackpressureDemo />,
  "nodejs/thread-pool": <ThreadPoolDemo />,
  "system-design/load-balancing": <LoadBalanceDemo />,
  "system-design/caching": <CachingDemo />,
  "system-design/cdn": <CdnDemo />,
  "system-design/rate-limiting": <RateLimitDemo />,
  "system-design/consistent-hashing": <ConsistentHashDemo />,
  "system-design/replication": <ReplicationDemo />,
  "system-design/sharding": <ShardingDemo />,
  "system-design/message-queues": <MessageQueueDemo />,
  "system-design/circuit-breaker": <CircuitBreakerDemo />,
  "devops/ci-cd-pipeline": <PipelineDemo />,
  "devops/containers-vs-vms": <ContainersDemo />,
  "devops/rolling-deploys": <RollingDeployDemo />,
  "ai/tokenization": <TokenizationDemo />,
  "ai/attention": <AttentionDemo />,
  "ai/next-token": <NextTokenDemo />,
  "ai/context-window": <ContextWindowDemo />,
  "ai/embeddings": <EmbeddingsDemo />,
  "ai/hybrid-search": <HybridSearchDemo />,
  "ai/rag": <RagDemo />,
  "ai/evals": <EvalsDemo />,
  "ai/agent-patterns": <AgentPatternsDemo />,
  "ai-native/structured-output": <StructuredDemo />,
  "ai-native/tool-calling": <ToolCallDemo />,
  "ai-automation/workflow": <WorkflowDemo />,
  "ai-automation/human-approval": <ApprovalDemo />,
  "ai-automation/schedules": <SchedulesDemo />,
  "tools/cursor-agent": <AgentLoopDemo />,
  "tools/mcp": <McpDemo />,
  "tools/n8n": <N8nDemo />,
  "tools/github-actions": <GithubActionsDemo />,
};

export const sessionDemo = (trackId: string, sessionId: string): ReactNode =>
  SESSIONS[`${trackId}/${sessionId}`];
