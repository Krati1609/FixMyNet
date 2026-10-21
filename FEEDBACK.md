# Hackathon Feedback & Post-Mortem: FixMyNet

This document outlines honest product and developer feedback from building **FixMyNet**.

---

## 1. Tools and SDKs Used

* **Model Context Protocol SDK (`@modelcontextprotocol/sdk` v1.32.1)**:
  Used to implement the network diagnostic tools on the server and to invoke them from the client bridge over the Streamable HTTP transport (spec version `2025-11-25+`, stateless mode).
* **Node.js & Express**:
  Used to expose the `/mcp` Streamable HTTP endpoint, DNS rebinding headers, and the `/api/chat` client bridge with session context.
* **Web Speech API & `window.speechSynthesis`**:
  Used in the browser for voice recognition (microphone input) and spoken voice feedback to simulate natural voice assistant workflows without requiring proprietary physical devices.
* **React & Vite**:
  Used for a single-screen dashboard with split chat and real-time MCP protocol inspection.
* **Antigravity**:
  Used as the AI pair programmer and agentic workspace for rapid architecture design, test harness creation, and debugging.

---

## 2. What Worked Well

* **Streamable HTTP Transport Unification**:
  Moving from the legacy dual-endpoint SSE architecture to a single `/mcp` endpoint simplifies routing, reverse proxies, and CORS configuration.
* **Stateless Mode with per-request Transports**:
  Creating a fresh `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` works cleanly for serverless and horizontal scaling without memory leaks.
* **Fault-First Routing with Session Memory**:
  Checking for fault descriptions first and remembering the diagnosed fault ID allows users to naturally ask "how do I fix it?" or "what are the diagnostic steps?" without having to restate the problem.
* **Deterministic Scoring + Voice Summaries**:
  Separating structured JSON data from speakable voice responses allowed both programmatic integration and natural-sounding voice output.
* **Real-time Protocol Visibility**:
  Having a visible side panel showing the raw JSON-RPC tool calls, arguments, and latency provides judges with direct proof of MCP execution.
* *[My Honest Notes: Add any specific personal highlights here]*

---

## 3. What Needs Work

* **Streamable HTTP Documentation**:
  The distinction between stateful (with session IDs and long-lived SSE) and stateless modes in the JavaScript SDK could benefit from more end-to-end vanilla Express examples in the official docs.
* **Web Speech API Browser Variance**:
  Chrome and Edge support `webkitSpeechRecognition` well, but Firefox and Safari still require text input fallback.
* **Standardized Audio Metadata in MCP**:
  MCP tool outputs currently handle text, images, and resources; having standard voice/speech synthesis hints in the schema would streamline voice assistants.
* *[My Honest Notes: Add any developer friction points or issues you encountered]*

---

## 4. Onboarding Experience

* **Getting Started**:
  Setting up modern ES modules with Node.js and `@modelcontextprotocol/sdk` is straightforward once the package exports and Zod compatibility are clear.
* **Debugging**:
  Testing with custom client scripts using `StreamableHTTPClientTransport` proved much faster and more repeatable than manual browser testing.
* *[My Honest Notes: Add your impressions on learning curve and setup time]*

---

## 5. Would I Build Again?

* **Verdict**:
  Yes. The Model Context Protocol provides an open, standardized contract between agentic assistants and domain-specific tools. Expanding this server to support automated ping/traceroute network probes and hardware switch APIs would be a natural next step.
* *[My Honest Notes: Final personal verdict on the hackathon experience]*
