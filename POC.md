# Hashop Theoretical Proof of Concept

## 1. Objective
Validate that a vendor-operated machine can run a cloud-grade web app locally while remaining globally reachable without the vendor maintaining an external server. The proof-of-concept (POC) emphasizes the routing + runtime framework, strong identity, sandboxed execution, and zero-telemetry hub positioning.

### POC Success Criteria
- A vendor runs `hashop serve` on a local machine and exposes a sample app (e.g., a minimalist shop).
- External visitors open `https://hashop.test/shop/vendorx` and interact with that app via a relay-backed tunnel.
- Clients verify manifests and signed responses without trusting the hub for content.
- Runtime enforces sandbox policy (Wasm-first; container fallback) and refuses unsigned bundles.

## 2. Core Actors
- **Node Agent (vendor machine)**: Generates identity, serves manifests, manages sandbox execution, opens tunnels.
- **Snafles-hub (optional relay/directory)**: Stores short-lived ANNOUNCE records `{id, pubkey, relay_token, TTL}`, brokers tunnels, provides discovery UI.
- **Relays**: Stateless proxies (could be hub-hosted or third-party) that terminate mTLS and forward to live tunnels.
- **Clients**: Resolve vendor IDs, verify manifest signatures, and issue NEGOTIATE requests.

## 3. Minimal Protocol Suite
| Primitive | Direction | Purpose | POC Realization |
|-----------|-----------|---------|------------------|
| `ANNOUNCE(manifest, pub_endpoint, signature, heartbeat)` | Node → Hub/DHT | Advertise availability + policy | CLI command `hashop announce` posts manifest; hub caches for TTL (default 60s) |
| `QUERY(identifier)` | Client/Hub | Resolve manifest + pubkey | Hub REST endpoint `/registry/:id` returns canonical manifest |
| `NEGOTIATE(request, signed_intent)` | Client ↔ Node | Order/RPC handshake | Sample flow: client signs intent `GET /order` and node counter-signs responses |
| `TUNNEL-ESTABLISH(agent_token, relay_options)` | Node ↔ Relay | Create reverse tunnel | Agent auto-selects WebRTC datachannel; falls back to WireGuard via CLI flags |
| `EXECUTE(image|bundle, policy)` | Node Runtime | Launch sandboxed service | Runtime loads Wasm bundle `vendorx/shop.wasm` with policy `wasm-lite` |

Each primitive is independent, composable, and signed using the node’s Ed25519 keypair. Messages default to canonical JSON to guarantee deterministic signatures.

## 4. Identity & Registry Model
1. **Local keypair (mandatory)**: `hashop init` produces an Ed25519 key, stores it securely (e.g., `$HOME/.hashop/keys/<id>.key`), and writes a sample manifest referencing a starter bundle.
2. **Optional registry**: Vendors call `REGISTER(id, pubkey, domain_hint)`; hub persists only `{id, pubkey, last_heartbeat, relay_token}`. Operators can opt out and rely on a DHT or share manifests directly.
3. **Verification flow**:
   - Client fetches manifest via hub or P2P.
   - Client verifies signature using registry-stored pubkey.
   - Client establishes TLS/mTLS tunnel referencing the manifest endpoints.

## 5. Runtime, Sandboxing, and Bundles
- **Wasm-first**: Execute Wasm modules through Wasmtime/Wasmer. Policies define capabilities (`http`, `fs-read`, `net-egress:*`).
- **Container fallback**: For apps needing Syscalls/GPU, use Podman/Docker with seccomp + AppArmor profiles. Only signed OCI images allowed.
- **Manifest-driven policy**: `sandbox_policy: "wasm-lite"` resolves to a predefined capability template. Execution fails if the bundle’s declared resources exceed policy.
- **Audit log**: Runtime appends signed events (`EXECUTE_START`, `EXECUTE_END`, exit codes) to a local append-only log (SQLite or log-structured file) for post-mortem proofs.

## 6. Tunneling & Routing UX
1. **Auto-agent behavior**:
   - Probe for inbound reachability (public IP, UPnP/NAT-PMP).
   - If closed, negotiate relay via `TUNNEL-ESTABLISH` using hub-issued token.
   - Maintain heartbeats; refresh tokens before expiry.
2. **Routing options**:
   - Default hub relays (Snafles-hub).
   - Custom relay endpoints configured via CLI/manifest (community/self-host).
   - P2P mode (no hub) by exchanging manifests and leveraging WebRTC hole punching.
3. **Failover**:
   - Multiple tunnels per node for redundancy.
   - Hub caches optional static assets (if vendor opts in) with vendor-signed snapshots.

## 7. Developer & User Experience
- **CLI**: `hashop init`, `hashop serve <bundle>`, `hashop announce --hub`, `hashop publish --manifest`, `hashop status`.
- **SDKs**: Lightweight Node.js/Python libraries to sign manifests, craft signed intents, and verify responses.
- **Installer**: Single-command install (brew/curl script) that sets up dependencies, downloads runtime, and walks through identity bootstrap.
- **User-facing UI**: Hub web portal listing live nodes (`/shop/<id>`) with relay-backed proxying. Power users can fetch manifests and connect directly or through alternative relays.

## 8. Theoretical POC Walkthrough
1. **Setup**:
   - Developer runs `hashop init` to create identity + sample manifest referencing `vendorx-shop.wasm`.
   - CLI stores manifest locally and outputs instructions to edit metadata/capabilities.
2. **Runtime launch**:
   - `hashop serve vendorx-shop.wasm --policy=wasm-lite`.
   - Runtime validates the bundle signature, enforces the policy, and exposes local HTTP port.
3. **Announcement**:
   - Agent posts `ANNOUNCE` with manifest + relay token to `https://hub.hashop.io/announce`.
   - Hub caches the manifest (TTL 60s) and displays vendor status in UI.
4. **Client access**:
   - Visitor opens `https://hashop.test/shop/vendorx`.
   - Hub verifies node heartbeat, forwards traffic through established tunnel, and returns responses.
   - Browser-side client library verifies response signatures embedded in headers or through a NEGOTIATE round-trip.
5. **Security enforcement**:
   - Runtime prevents outbound network calls unless allowed by policy (default deny).
   - Attempts to load unsigned bundles or mutated manifests fail with explicit errors logged locally.

## 9. Implementation Timeline (4-week MVP)
| Week | Focus | Output |
|------|-------|--------|
| 0 | Repo scaffolding, choose Wasm runtime + CLI language (Rust + Wasmtime recommended) | Git repo with modules for runtime, CLI, hub |
| 1 | Identity + manifest tooling | `hashop init`, canonical manifest schema, local manifest endpoint |
| 2 | Agent + relay prototype | Reverse tunnel via WebRTC/localtunnel, hub relay proxy + registry MVP |
| 3 | Signing + sandbox | Manifest signing/verification, Wasm sandbox enforcement, signed bundle validation |
| 4 | UX polish | CLI commands (serve/announce/publish/status), hub web UI proxying live nodes |

## 10. Validation & Telemetry Guardrails
- **Zero-content hub**: Hub stores only manifests, relay tokens, and heartbeat timestamps; no payload logging.
- **Observability**: Agent exposes local metrics endpoint (e.g., `/metrics`) for tunnel health; CLI surfaces status without phoning home.
- **Testing hooks**:
  - Integration test: spin up local node + hub container to ensure ANNOUNCE/QUERY/NEGOTIATE flows succeed.
  - Security test: attempt to execute unsigned bundle; expect runtime rejection.
  - Privacy test: inspect hub logs to confirm absence of content traces.

## 11. Risks & Open Questions
1. **TURN/WireGuard credential lifecycle**: Need a lightweight CA or token service to mint mTLS certificates/tokens with rotation.
2. **Canonical manifest encoding**: Choose JSON Canonicalization Scheme (JCS) or YAML subset to avoid signature mismatches.
3. **Policy authoring UX**: Provide templates + validation to prevent misconfigured sandboxes.
4. **Offline caching**: Determine how optional read-only caches interact with privacy goals (maybe IPFS snapshots signed by vendor).
5. **Marketplace overlays**: Out of scope for POC but should remain compatible with signed receipt model.

---

This theoretical POC demonstrates how Hashop can deliver “Web2.5” bridging: local-first compute with global reachability, cryptographic identities, optional centralized discovery, and strict sandboxing. Iterating on this blueprint should yield a tangible demo within one month while keeping future roadmap options open (P2P discovery, IPFS caching, etc.).
