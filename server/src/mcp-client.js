import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * Execute an MCP tool call over Streamable HTTP transport and measure latency.
 */
export async function executeMcpCall(serverUrlStr, toolName, toolArgs) {
  const startTime = Date.now();
  const transport = new StreamableHTTPClientTransport(new URL(serverUrlStr));

  const client = new Client({
    name: 'fixmynet-client-bridge',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    const mcpResponse = await client.callTool({
      name: toolName,
      arguments: toolArgs || {}
    });

    const durationMs = Date.now() - startTime;
    let parsedResult = null;
    let rawText = '';

    if (mcpResponse?.content && mcpResponse.content.length > 0) {
      rawText = mcpResponse.content[0].text || '';
      try {
        parsedResult = JSON.parse(rawText);
      } catch {
        parsedResult = { text: rawText };
      }
    }

    return {
      success: true,
      tool: toolName,
      arguments: toolArgs,
      result: parsedResult,
      raw_text: rawText,
      duration_ms: durationMs,
      timestamp: new Date().toISOString()
    };
  } finally {
    try {
      await client.close();
    } catch {}
  }
}
