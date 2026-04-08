# Hashop: A Web2.5 Local-First Bridge

## Abstract
We present Hashop, a routing and runtime framework that allows cloud-class web applications to execute on vendor-owned machines while remaining globally reachable without hosted infrastructure. Hashop blends cryptographic identity, optional hub relays, and sandboxed runtimes to create a “Web2.5” bridge focused on developer ergonomics and user privacy. This paper outlines the theoretical model, protocol suite, and minimal viable architecture required to validate Hashop, and discusses security, privacy, and future research directions.

## 1. Introduction
Modern web services rely on centralized infrastructure that conflicts with local-first aspirations. Vendors wish to own their compute while retaining global reach and reliability. Existing tunneling tools solve connectivity but leave gaps in identity, sandboxing, and user trust. Hashop targets this niche by combining:
- Local-first execution of applications (Wasm/container) on vendor hardware.
- Minimal control-plane relays for discovery and routing, operated optionally by Snafles-hub.
- Strong identity and signed manifests enabling tamper-proof routing.
- Sandboxing and zero-telemetry guarantees to preserve sovereignty.

This work contributes a concrete theoretical design for Hashop suitable for a proof-of-concept and positions it as a research-worthy system exploring Web2.5 bridging.

## 2. System Overview
### 2.1 Actors
- **Node Agent**: Runs on vendor hardware, maintains identities, executes apps in sandboxes, and manages tunnels.
- **Snafles-hub**: Optional relay/directory that caches short-lived manifests and issues relay tokens.
- **Relays**: Stateless endpoints (hub or third party) that forward client traffic through encrypted tunnels.
- **Clients**: Resolve vendor identifiers, verify manifests, and interact with services via signed NEGOTIATE flows.

### 2.2 Goals
1. Global reachability for local applications without vendor-run cloud servers.
2. Cryptographic assurance that clients interact with authentic services.
3. Sandboxed execution with explicit capability policies.
4. Zero-content retention at the hub; privacy-preserving telemetry.
5. Developer-friendly UX (CLI + SDK) enabling single-command setup.

## 3. Protocol Primitives
Hashop’s control plane consists of five primitives:
1. `ANNOUNCE(manifest, pub_endpoint, signature, heartbeat)`: Node advertises availability to hub/DHT. Manifest is signed canonical JSON or YAML.
2. `QUERY(identifier)`: Client or relay resolves manifest/pubkey mapping.
3. `NEGOTIATE(request, signed_intent)`: Client and node exchange signed transactions (orders, RPC).
4. `TUNNEL-ESTABLISH(agent_token, relay_options)`: Agent creates reverse tunnel (WebRTC preferred; WireGuard fallback) with mutual TLS using node keys.
5. `EXECUTE(image|bundle, policy)`: Runtime executes Wasm/container bundles under sandbox policy; rejects unsigned assets.

The primitives emphasize composability, minimalism, and auditability.

## 4. Identity and Registry Design
### 4.1 Local Keypairs
Each node generates an Ed25519 keypair via `hashop init`. Keys authenticate ANNOUNCE, manifests, and runtime attestations. Private keys stay on device; hardware-backed storage is recommended.

### 4.2 Optional Central Registry
Snafles-hub offers a lightweight registry storing `{id, pubkey, relay_token, last_heartbeat}`. Vendors may opt out by publishing manifests via P2P/DHT networks. Clients trust signatures rather than hub state.

### 4.3 Verification Flow
1. Client fetches manifest (hub endpoint or DHT).
2. Client verifies signature against registry/DHT pubkey.
3. Client establishes TLS/mTLS tunnel to the node endpoint or relay token specified in the manifest.

## 5. Runtime and Sandbox Architecture
### 5.1 Wasm-First Execution
Primary execution path uses Wasmtime/Wasmer. Policies declare capabilities: network egress domains, file access, environment variables, resource quotas (CPU/memory).

### 5.2 Container Fallback
For workloads requiring full OS features, runtime launches Podman/Docker containers with signed OCI images. Policies map to seccomp/AppArmor profiles and explicit device allowances (e.g., GPU).

### 5.3 Manifest-Driven Policies
Manifests include `sandbox_policy` referencing policy templates (e.g., `wasm-lite`, `container-strict`). Runtime enforces policy at EXECUTE and records signed events in an append-only ledger for auditing.

## 6. Tunneling and Routing
### 6.1 Agent Behavior
The local agent:
- Probes for public reachability (UPnP/NAT-PMP).
- Establishes tunnels when direct ingress fails, using hub-issued relay tokens.
- Maintains heartbeats and rotates tokens.

### 6.2 Relay Architecture
Relays operate as stateless proxies forwarding encrypted streams. They never store payloads. Multi-relay support and community-hosted relays enhance resilience.

### 6.3 Failover and Offline Caching
Nodes may maintain multiple tunnels. Optional vendor-controlled caches (e.g., IPFS snapshots) serve read-only content when the node is offline, signed to prevent tampering.

## 7. Developer Experience
### 7.1 CLI Workflow
- `hashop init`: generate keys + sample manifest.
- `hashop serve bundle --policy=...`: launch runtime locally and expose metrics.
- `hashop announce --hub=<url>`: send ANNOUNCE to hub.
- `hashop publish --manifest=...`: upload manifest to registry.
- `hashop status`: display tunnel health, heartbeats, and sandbox audits.

### 7.2 SDKs and Installers
SDKs in Node.js/Python handle manifest signing and NEGOTIATE sessions. Installers provide single-command bootstrap with dependency checks and auto-updates.

## 8. Security, Privacy, and Telemetry
- **Zero-content hub**: Stores only manifests and metadata; never logs payloads.
- **Signed intents**: Both sides sign requests/responses, enabling repudiation-resistant logs.
- **Capability isolation**: Default deny-all network egress; explicit whitelists required.
- **Local audit ledger**: Signed append-only log for EXECUTE events enables forensic audits.
- **Opt-in analytics**: Users choose if aggregate, anonymized stats are reported.

## 9. Theoretical Evaluation Plan
### 9.1 Success Metrics
1. **Reachability**: External clients load `https://hashop.test/shop/vendorx` and receive live responses from the local runtime.
2. **Integrity**: Clients detect tampered manifests or unsigned bundles (should fail).
3. **Sandbox Enforcement**: Attempts to exceed policy (e.g., unauthorized network egress) are blocked and logged.
4. **Privacy**: Hub logs demonstrate absence of payload data.

### 9.2 Evaluation Methodology
- Emulate a vendor node and hub within controlled environments.
- Use integration tests to exercise ANNOUNCE → QUERY → TUNNEL → NEGOTIATE flows.
- Inject adversarial scenarios (manifest replay, bundle tampering, relay compromise) to validate security responses.

## 10. Roadmap and Research Questions
1. **Canonical Manifest Encoding**: Select or design a canonical JSON/YAML scheme to avoid signature variance.
2. **Relay Credential Lifecycle**: Study scalable distribution/rotation of WebRTC/TLS credentials.
3. **Policy Language**: Define a declarative capability language balancing expressiveness and simplicity.
4. **Hubless Discovery**: Explore DHT or gossip mechanisms for fully decentralized operation.
5. **Audit Transparency**: Investigate client-facing tools showing what data leaves vendor machines.

## 11. Related Work
Hashop intersects with tunneling services (ngrok, Cloudflare Tunnel), decentralized storage/discovery (IPFS, libp2p), and Wasm-first runtimes (Fermyon, Suborbital). Unlike pure tunneling, Hashop integrates identity, sandboxing, and signed transactions into a cohesive Web2.5 bridge.

## 12. Conclusion
Hashop’s theoretical design demonstrates a viable path toward local-first yet globally reachable web services. By treating routing, identity, sandboxing, and privacy as first-class citizens, Hashop offers research-worthy contributions to the emerging Web2.5 space. Future implementation can validate the hypotheses and extend toward P2P discovery, marketplace overlays, and multi-node orchestration, advancing the state of local-first cloud replacements.
