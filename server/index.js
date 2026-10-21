import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createFixMyNetServer } from './src/mcp-server.js';
import { routeIntent } from './src/intent-router.js';
import { executeMcpCall } from './src/mcp-client.js';
import { sessionStore } from './src/session-store.js';
import { faults } from './src/engine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;

// Enable CORS for cross-origin web client
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Mcp-Session-Id', 'Last-Event-ID']
}));

app.use(express.json());

// Root health & metadata
app.get('/', (req, res) => {
  res.json({
    name: 'FixMyNet MCP Server',
    version: '1.0.0',
    description: 'Network troubleshooting assistant exposed over Streamable HTTP transport',
    mcp_endpoint: '/mcp',
    transport: 'Streamable HTTP (Stateless)',
    tools: [
      'diagnose_issue',
      'get_fix_steps',
      'get_diagnostic_steps',
      'list_fault_categories',
      'run_checklist'
    ],
    chat_endpoint: '/api/chat'
  });
});

/**
 * MCP POST Endpoint - Spec version: 2025-11-25+, Streamable HTTP Transport, Stateless mode.
 */
app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    const server = createFixMyNetServer();
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  } catch (error) {
    console.error('Error handling MCP POST request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error.message || 'Internal server error'
        },
        id: null
      });
    }
  }
});

/**
 * MCP GET Endpoint - Supports SSE streaming if requested, or returns status
 */
app.get('/mcp', async (req, res) => {
  const acceptHeader = req.headers['accept'] || '';

  if (acceptHeader.includes('text/event-stream')) {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      const server = createFixMyNetServer();
      await server.connect(transport);
      await transport.handleRequest(req, res);
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    } catch (error) {
      console.error('Error handling MCP GET SSE request:', error);
      if (!res.headersSent) {
        res.status(500).end();
      }
    }
    return;
  }

  res.json({
    status: 'online',
    endpoint: '/mcp',
    transport: 'Streamable HTTP (Stateless Mode)',
    spec: 'MCP 2025-11-25+',
    methods: ['POST (JSON-RPC)', 'GET (text/event-stream)']
  });
});

app.delete('/mcp', (req, res) => {
  res.status(200).json({
    jsonrpc: '2.0',
    result: { message: 'Stateless session termination acknowledged' }
  });
});

/**
 * Chat Assistant Bridge Endpoint (/api/chat)
 * Acts as an MCP CLIENT using StreamableHTTPClientTransport.
 * Checks for fault descriptions first, manages session context for fix/diagnostic steps,
 * calls the MCP Server, and returns spoken response + real-time MCP activity payload.
 */
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body?.message || '';
  const sessionId = req.body?.sessionId || 'default-session';

  if (!userMessage.trim()) {
    return res.status(400).json({
      error: 'Message is required',
      spoken_response: 'I did not hear anything. How can I help with your network?'
    });
  }

  try {
    // 1. Intent routing with session diagnosis memory
    const route = await routeIntent(userMessage, sessionId);

    // If intent requires user to describe the problem first
    if (route.direct_response) {
      return res.json({
        user_message: userMessage,
        intent: route.intent,
        routed_by: 'direct_response',
        spoken_response: route.spoken_response,
        display_text: route.display_text,
        mcp_activity: null,
        session_id: sessionId,
        last_diagnosed_fault_id: sessionStore.getSession(sessionId).lastDiagnosedFaultId
      });
    }

    // 2. Call MCP Server using StreamableHTTPClientTransport
    const mcpActivity = await executeMcpCall(MCP_ENDPOINT, route.tool, route.arguments);

    // 3. Update session's last diagnosed fault ONLY if diagnose_issue returned a valid match with reasons
    if (
      route.tool === 'diagnose_issue' &&
      mcpActivity.result?.top_matches?.[0]?.id &&
      mcpActivity.result.top_matches[0].why_matched?.length > 0
    ) {
      const topMatch = mcpActivity.result.top_matches[0];
      sessionStore.setLastDiagnosedFault(sessionId, topMatch.id, topMatch.name);
    }

    // 4. Extract speakable response
    const speakable = mcpActivity.result?.speakable_summary ||
      (typeof mcpActivity.result === 'string' ? mcpActivity.result : 'I have analyzed your request.');

    res.json({
      user_message: userMessage,
      intent: route.intent,
      routed_by: route.routed_by,
      spoken_response: speakable,
      display_text: speakable,
      mcp_activity: mcpActivity,
      session_id: sessionId,
      last_diagnosed_fault_id: sessionStore.getSession(sessionId).lastDiagnosedFaultId
    });
  } catch (error) {
    console.error('Error in /api/chat bridge:', error);
    res.status(500).json({
      error: error.message,
      spoken_response: 'Sorry, I encountered an internal error while consulting the network server.',
      mcp_activity: null
    });
  }
});

// Endpoint to list all fault profiles for inspection
app.get('/api/faults', (req, res) => {
  res.json(faults);
});

let serverInstance = null;

serverInstance = app.listen(PORT, () => {
  console.log(`FixMyNet MCP Server listening on http://localhost:${PORT}`);
  console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Chat Endpoint: http://localhost:${PORT}/api/chat`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Server is already running on port ${PORT}. Continuing with existing instance.`);
  } else {
    throw err;
  }
});

export { app, serverInstance };
