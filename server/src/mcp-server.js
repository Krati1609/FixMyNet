import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  scoreSymptoms,
  getFixSteps,
  getDiagnosticSteps,
  listCategories,
  getChecklist
} from './engine.js';

/**
 * Creates and configures a fresh McpServer instance with FixMyNet tools.
 */
export function createFixMyNetServer() {
  const server = new McpServer({
    name: 'fixmynet-server',
    version: '1.0.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Tool 1: diagnose_issue
  server.registerTool('diagnose_issue', {
    description: 'Diagnose network issues from observed symptoms using deterministic rule-matching against 20 fault profiles.',
    inputSchema: {
      symptoms: z.string().describe('Free-text description of observed network symptoms, errors, or behavior')
    }
  }, async ({ symptoms }) => {
    const result = scoreSymptoms(symptoms);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // Tool 2: get_fix_steps
  server.registerTool('get_fix_steps', {
    description: 'Retrieve ordered, speakable resolution and fix steps for a specific network fault ID.',
    inputSchema: {
      fault_id: z.string().describe('Unique identifier of the fault (e.g., "dns-failure", "wrong-default-gateway")')
    }
  }, async ({ fault_id }) => {
    const result = getFixSteps(fault_id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // Tool 3: get_diagnostic_steps
  server.registerTool('get_diagnostic_steps', {
    description: 'Retrieve ordered, speakable diagnostic and verification steps for a specific network fault ID.',
    inputSchema: {
      fault_id: z.string().describe('Unique identifier of the fault (e.g., "dns-failure", "cable-fault")')
    }
  }, async ({ fault_id }) => {
    const result = getDiagnosticSteps(fault_id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // Tool 4: list_fault_categories
  server.registerTool('list_fault_categories', {
    description: 'List all supported network fault categories and total fault profile counts in FixMyNet.',
    inputSchema: {}
  }, async () => {
    const result = listCategories();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  // Tool 5: run_checklist
  server.registerTool('run_checklist', {
    description: 'Run an ordered beginner-friendly network troubleshooting checklist for a common failure scenario.',
    inputSchema: {
      scenario: z.enum(['no internet', 'slow network', 'intermittent drops']).describe('Scenario type: "no internet", "slow network", or "intermittent drops"')
    }
  }, async ({ scenario }) => {
    const result = getChecklist(scenario);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  });

  return server;
}
