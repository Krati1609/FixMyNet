# Hackathon Feedback: FixMyNet

This document outlines project tool usage and developer feedback for **FixMyNet**.

---

## 1. Tools and SDKs Used

* **`@modelcontextprotocol/sdk` (v1.32.1)**:
  Used to implement the self-hosted MCP server (`McpServer`, `StreamableHTTPServerTransport`) on `/mcp` in stateless mode and to invoke it from the backend bridge (`Client`, `StreamableHTTPClientTransport`) using the Streamable HTTP transport (negotiating protocol version `2025-11-25`).
* **Express**:
  Used to host the HTTP server on port 3001, providing the `/mcp` transport endpoint, CORS configuration, and the `/api/chat` session-aware conversational bridge.
* **Zod**:
  Used to define and validate input schemas and argument constraints for all 5 MCP tools (`diagnose_issue`, `get_fix_steps`, `get_diagnostic_steps`, `list_fault_categories`, `run_checklist`).
* **React + Vite**:
  Used to build the single-screen web interface, providing the voice chat interface and the real-time MCP Activity inspector side panel.
* **Web Speech API**:
  Used in the browser for microphone voice input (`webkitSpeechRecognition` / `SpeechRecognition`) and speech output (`window.speechSynthesis`).
* **Antigravity**:
  Used as the AI pair-programming assistant and development environment for architecture implementation, test harness design, and refactoring.
* **Node.js built-ins (`node:net`, `node:dns/promises`, `node:os`, `fetch`)**
Used for the `run_network_check` tool: TCP connection tests, system and public DNS lookups, adapter counts and an HTTPS request, with no extra dependencies.

---

## 2. AWS Services Used

* **None used** (FixMyNet runs self-hosted and 100% locally on Node.js without cloud dependencies).

---

## 3. What Worked Well

- The SDK's Streamable HTTP transport was easy to get running. A real client-to-server handshake negotiated protocol version 2025-11-25, so I could check the spec requirement with code.
- Having an official client in the same SDK made testing simple. I could test the server the way a real client would call it, and the same client powers the live activity panel in the app.
- Zod schemas keep tool inputs strict and make each tool's purpose clear to the client.
- The rules allow a simulated Alexa+ experience, so I could build and demo everything on my laptop without a device.
- Adding a sixth tool was quick. Register it in the MCP server, add one routing rule, and the activity panel and tests picked it up. The tool's output can also feed the existing diagnosis tool, so tools can build on each other.
- Node's built-ins were enough for real network checks, with no extra packages.

---

## 4. What Needs Work

- Stateless mode needs a fresh transport and server for every request, and reusing one can cause request ID conflicts. This isn't obvious at first, and a short "common pitfalls" note in the docs would save time.
- The Web Speech API only works reliably in Chrome, so the voice demo is limited to that browser.
- Testing with one-line commands in Windows PowerShell broke because of quote escaping, so I had to move the logic into a helper module and test it with a normal script. Setup notes for Windows would help.
- Antigravity's newer desktop app has no file editor, and the editor is a separate Antigravity IDE download. A hint about this on first launch would help new users.
- Node has no easy cross-platform ping without admin rights, so I used TCP connection tests instead. A small built-in helper for this would help.
- The direct public-DNS test times out on my network, so one check shows red even when the connection is healthy overall. I kept it and show the reason on the card.

---

## 5. Onboarding Experience

It felt good. Everything started working quickly. One command started the server and the web app together, and the voice chat worked smoothly right away. Running the app was quick and easy.

---

## 6. Would I Build Again?

Yes. MCP is a small, clear idea, and I would like to build something bigger with it. If something goes wrong or I want to improve this project, I'd happily build it again to make it better.
