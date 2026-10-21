# FixMyNet: Network Troubleshooting Assistant

**FixMyNet** is an intelligent network troubleshooting assistant built for conversational voice interfaces. It exposes a self-hosted Model Context Protocol (MCP) server adhering to the official **Streamable HTTP transport** specification (spec version 2025-11-25+ in stateless mode), paired with an interactive web application that provides voice input, spoken answers, session-aware intent routing, and real-time MCP activity inspection.

---

## What It Does

FixMyNet helps users and voice assistants diagnose and resolve home and enterprise network failures in plain English:
* **Fault-First Intent Routing & Session Memory**: Checks for network fault descriptions first, stores the diagnosed fault ID in the session, and only retrieves fix or diagnostic steps when referring to a diagnosed problem. If a user asks for a fix without prior diagnosis, it prompts them to describe the problem first.
* **Deterministic Rule Scoring**: Analyzes free-text symptoms against 20 original network fault profiles (DNS failure, duplex mismatch, VLAN errors, DHCP exhaustion, cable faults, etc.) without relying on cloud LLM uptime.
* **Human-in-the-Loop Safeguards**: Automatically flags low-confidence diagnoses (< 50%) with a manual review notice before suggesting disruptive changes.
* **Voice-Ready Answers**: Every tool outputs concise, speakable text designed for text-to-speech engines (speechSynthesis).
* **Beginner Checklists**: Provides structured, step-by-step troubleshooting workflows for "no internet", "slow network", and "intermittent drops".
* **Interactive Web Interface**: Single-screen dashboard with microphone voice input (Web Speech API), spoken replies, session reset, and a live MCP Activity side panel showing JSON-RPC tool calls, arguments, and latency in real time.

---

## Architecture Diagram

```text
+-----------------------------------------------------------------------------------+
|                           FIXMYNET WEB APPLICATION                                |
|                             (React + Vite on :5173)                               |
|                                                                                   |
|  +-------------------------------------+   +------------------------------------+ |
|  |     Voice & Chat Assistant Panel    |   |       Live MCP Activity Panel      | |
|  | - Mic button (Web Speech API)       |   | - Real-time tool call inspector    | |
|  | - Spoken audio (speechSynthesis)    |   | - JSON-RPC request & arguments     | |
|  | - Session context memory            |   | - Tool latency (ms) & timestamps   | |
|  | - Voice-ready diagnosis cards       |   | - Full MCP output payload viewer   | |
|  | - One-click demo voice chips        |   | - Copy raw JSON-RPC payload button | |
|  +-------------------------------------+   +------------------------------------+ |
+------------------------------------------+----------------------------------------+
                                           | HTTP POST /api/chat { message, sessionId }
                                           v
+-----------------------------------------------------------------------------------+
|                           EXPRESS SERVER & MCP BRIDGE                             |
|                               (Node.js on :3001)                                  |
|                                                                                   |
|  +------------------------------------------------------------------------------+ |
|  | Session Store: tracks last diagnosed fault ID per session                    | |
|  | Intent Router: fault description first -> session fix/diagnostic -> checklist| |
|  +------------------------------------------------------------------------------+ |
|                                          |
|                                          | StreamableHTTPClientTransport
|                                          v
|  +------------------------------------------------------------------------------+ |
|  | MCP CLIENT LAYER: Calls MCP Tools over official SDK Client Transport         | |
|  +------------------------------------------------------------------------------+ |
|                                          |
|                                          | HTTP POST /mcp (JSON-RPC 2.0)
|                                          v
|  +------------------------------------------------------------------------------+ |
|  | MCP SERVER LAYER (StreamableHTTPServerTransport - Stateless Mode, 2025-11-25)| |
|  |                                                                              | |
|  | Tools:                                                                       | |
|  |  1. diagnose_issue(symptoms)                                                 | |
|  |  2. get_fix_steps(fault_id)                                                  | |
|  |  3. get_diagnostic_steps(fault_id)                                           | |
|  |  4. list_fault_categories()                                                  | |
|  |  5. run_checklist(scenario)                                                  | |
|  +------------------------------------------------------------------------------+ |
|                                          |
|                                          v
|  +------------------------------------------------------------------------------+ |
|  | Deterministic Rule Engine & faults.json (20 Original Fault Profiles)         | |
|  +------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## How It Uses MCP

* **Official SDK**: Built using `@modelcontextprotocol/sdk` (v1.32.1).
* **Streamable HTTP Transport**: Operates over a single `/mcp` HTTP endpoint (replacing older legacy HTTP+SSE architectures) using `StreamableHTTPServerTransport` and `StreamableHTTPClientTransport`.
* **Stateless Mode**: Configured with `sessionIdGenerator: undefined` to ensure robust, isolated, and scalable per-request execution without session state drift.
* **Zod Schemas**: Every tool defines strict Zod input validation schemas and descriptive metadata.
* **Real-time Protocol Inspection**: The web application acts as an MCP client observer, rendering the exact JSON-RPC payload, tool arguments, response schema, and round-trip duration for every voice command.

---

## Getting Started

### Prerequisites
* **Node.js** v18+ (tested on Node v20 and v24)
* **npm** v9+

### Installation

From the project root directory, install all dependencies:

```bash
# Option 1: One-step install via root script
npm run install:all

# Option 2: Install manually
cd server && npm install
cd ../web && npm install
cd .. && npm install
```

### Running the Application

Start both the MCP server and the web app concurrently:

```bash
npm run dev
```

* **MCP Server & Bridge**: `http://localhost:3001`
  * MCP Streamable HTTP Endpoint: `http://localhost:3001/mcp`
  * Chat Assistant Bridge Endpoint: `http://localhost:3001/api/chat`
* **Web UI**: `http://localhost:5173`

> **Note**: You can also run the server and web application in separate terminals:
> * Terminal 1: `npm run server` (starts server on port 3001)
> * Terminal 2: `npm run web` (starts Vite dev server on port 5173)

### Running Automated MCP Tests

Execute the automated test suite verifying all 5 tools over Streamable HTTP transport and session intent routing:

```bash
npm test
```

---

## Demo Script

Click the **Mic button** (or use the one-click demo chips in the UI) to test the conversation flow:

| Step | User Query / Voice Utterance | MCP Tool Invoked | Expected Voice & Visual Result |
| :--- | :--- | :--- | :--- |
| **1** | *"I can ping 8.8.8.8 but website names are not resolving"* | `diagnose_issue` | Identifies **DNS Resolution Failure** (~69% confidence), speaks immediate action, and stores `dns-failure` in session memory. |
| **2** | First say the symptom (e.g. *"I can ping 8.8.8.8 but website names are not resolving"*), then say *"How do I fix it?"* | `get_fix_steps` | Calls `get_fix_steps` using the fault remembered in the session (`dns-failure`) and returns speakable resolution steps. |
| **3** | *"What are the diagnostic steps to test it?"* | `get_diagnostic_steps` | Resolves `dns-failure` from session memory and returns speakable testing steps. |
| **4** | *"Run the no internet checklist"* | `run_checklist` | Returns 5 ordered beginner steps starting from physical link verification to DNS resolution. |
| **5** | *"What categories of network faults do you know?"* | `list_fault_categories` | Lists all 7 categories (DNS, Addressing & Routing, Physical & Data Link, Switching & VLANs, Performance, Wireless, Security) covering 20 faults. |

### Session Safeguard Tests:
* **Fix Without Prior Diagnosis**: Click "New Session" and ask *"Can you fix my issue?"*. The assistant will prompt: *"I haven't diagnosed a network problem yet for this session. Could you describe what issue or symptoms you are experiencing first?"*
* **Low-Confidence Safeguard**: Ask *"Something is behaving strangely on my computer"*. When confidence is below 0.5, the assistant adds: *"Notice: Low confidence diagnosis (below 50%). Please verify these suggestions manually or check physical connections."*

---

## Configuration (`.env`)

The project runs 100% locally without requiring any third-party API keys. However, an optional LLM intent router is supported if you provide an OpenAI key:

```bash
# Copy example environment configuration
cp .env.example .env
```

Contents of `.env`:
```ini
PORT=3001
# Optional: OpenAI key for LLM intent routing (fallback to rule router if absent)
# OPENAI_API_KEY=your_key_here
```

---

## License

This project is licensed under the [MIT License](LICENSE).
