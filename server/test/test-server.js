import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { serverInstance } from '../index.js';

async function runTests() {
  console.log('\n======================================================');
  console.log(' FixMyNet Server Test Suite (MCP + Session Chat)');
  console.log('======================================================\n');

  const serverUrl = new URL('http://localhost:3001/mcp');
  const transport = new StreamableHTTPClientTransport(serverUrl);

  const client = new Client({
    name: 'fixmynet-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    console.log('1. Connecting to MCP Server via StreamableHTTPClientTransport...');
    await client.connect(transport);
    console.log('Connected successfully!\n');

    // Test 1: listTools
    console.log('2. Testing client.listTools()...');
    const toolsResult = await client.listTools();
    console.log(`Found ${toolsResult.tools.length} registered tools:`);
    toolsResult.tools.forEach(t => console.log(`   - ${t.name}: ${t.description.slice(0, 70)}...`));
    console.log('');

    // Test 2: diagnose_issue (High confidence)
    console.log('3. Testing diagnose_issue with: "cannot open websites by domain name, ping IP works"...');
    const diagHigh = await client.callTool({
      name: 'diagnose_issue',
      arguments: {
        symptoms: 'cannot open websites by domain name, ping IP works'
      }
    });
    const parsedHigh = JSON.parse(diagHigh.content[0].text);
    console.log('Result Top Match:', parsedHigh.top_matches[0]?.name);
    console.log('Confidence:', parsedHigh.top_matches[0]?.confidence);
    console.log('Matched Why:', parsedHigh.top_matches[0]?.why_matched);
    console.log('Speakable:', parsedHigh.speakable_summary);
    console.log('Human review required?', parsedHigh.human_review_required);
    console.log('');

    // Test 3: diagnose_issue (Low confidence)
    console.log('4. Testing diagnose_issue with vague input: "some strange mystery"...');
    const diagLow = await client.callTool({
      name: 'diagnose_issue',
      arguments: {
        symptoms: 'some strange mystery'
      }
    });
    const parsedLow = JSON.parse(diagLow.content[0].text);
    console.log('Confidence:', parsedLow.top_matches[0]?.confidence);
    console.log('Human review required?', parsedLow.human_review_required);
    console.log('Human review note:', parsedLow.human_review_note);
    console.log('Speakable:', parsedLow.speakable_summary);
    console.log('');

    // Test 4: get_fix_steps
    console.log('5. Testing get_fix_steps for "dns-failure"...');
    const fixResult = await client.callTool({
      name: 'get_fix_steps',
      arguments: { fault_id: 'dns-failure' }
    });
    const parsedFix = JSON.parse(fixResult.content[0].text);
    console.log('Fix steps count:', parsedFix.fix_steps?.length);
    console.log('Speakable:', parsedFix.speakable_summary);
    console.log('');

    // Test 5: get_diagnostic_steps
    console.log('6. Testing get_diagnostic_steps for "cable-fault"...');
    const diagStepsResult = await client.callTool({
      name: 'get_diagnostic_steps',
      arguments: { fault_id: 'cable-fault' }
    });
    const parsedDiagSteps = JSON.parse(diagStepsResult.content[0].text);
    console.log('Diagnostic steps count:', parsedDiagSteps.diagnostic_steps?.length);
    console.log('Speakable:', parsedDiagSteps.speakable_summary);
    console.log('');

    // Test 6: list_fault_categories
    console.log('7. Testing list_fault_categories()...');
    const catResult = await client.callTool({
      name: 'list_fault_categories',
      arguments: {}
    });
    const parsedCat = JSON.parse(catResult.content[0].text);
    console.log('Total categories:', parsedCat.total_categories);
    console.log('Categories:', parsedCat.categories.map(c => `${c.name} (${c.fault_count})`).join(', '));
    console.log('Speakable:', parsedCat.speakable_summary);
    console.log('');

    // Test 7: run_checklist
    console.log('8. Testing run_checklist for "no internet"...');
    const checklistResult = await client.callTool({
      name: 'run_checklist',
      arguments: { scenario: 'no internet' }
    });
    const parsedChecklist = JSON.parse(checklistResult.content[0].text);
    console.log('Checklist title:', parsedChecklist.title);
    console.log('Steps count:', parsedChecklist.steps?.length);
    console.log('Speakable:', parsedChecklist.speakable_summary);
    console.log('');

    // Test 8: Session Context & Intent Router Rules via /api/chat
    console.log('9. Testing /api/chat session intent routing rules...');
    const testSessionId = 'test-session-' + Date.now();

    // 8a. Ask for fix with NO prior diagnosis -> Should prompt to describe problem first
    console.log('   a) User asks "How do I fix it?" with no prior diagnosis in session...');
    const chatRes1 = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I fix it?', sessionId: testSessionId })
    });
    const chatData1 = await chatRes1.json();
    console.log('      Intent:', chatData1.intent);
    console.log('      Spoken Response:', chatData1.spoken_response);
    if (!chatData1.spoken_response.includes("haven't diagnosed a network problem yet")) {
      throw new Error('Expected prompt for description on fix without diagnosis!');
    }

    // 8b. User describes a fault -> Should diagnose and save to session
    console.log('   b) User describes symptoms: "I can ping 8.8.8.8 but website names are not resolving"...');
    const chatRes2 = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'I can ping 8.8.8.8 but website names are not resolving',
        sessionId: testSessionId
      })
    });
    const chatData2 = await chatRes2.json();
    console.log('      Routed By:', chatData2.routed_by);
    console.log('      Diagnosed Fault ID saved in session:', chatData2.last_diagnosed_fault_id);
    if (chatData2.last_diagnosed_fault_id !== 'dns-failure') {
      throw new Error(`Expected dns-failure to be saved in session, got ${chatData2.last_diagnosed_fault_id}`);
    }

    // 8c. User now asks for fix -> Should use previously diagnosed fault (dns-failure)
    console.log('   c) User asks "How do I fix it?" with prior diagnosis in session...');
    const chatRes3 = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I fix it?', sessionId: testSessionId })
    });
    const chatData3 = await chatRes3.json();
    console.log('      Tool Invoked:', chatData3.mcp_activity?.tool);
    console.log('      Arguments:', chatData3.mcp_activity?.arguments);
    console.log('      Spoken Fix Steps:', chatData3.spoken_response);
    if (chatData3.mcp_activity?.tool !== 'get_fix_steps' || chatData3.mcp_activity?.arguments?.fault_id !== 'dns-failure') {
      throw new Error('Expected get_fix_steps for dns-failure from session context!');
    }

    // 8d. User now asks for diagnostic steps -> Should use previously diagnosed fault (dns-failure)
    console.log('   d) User asks "What are the diagnostic steps to test it?"...');
    const chatRes4 = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What are the diagnostic steps to test it?', sessionId: testSessionId })
    });
    const chatData4 = await chatRes4.json();
    console.log('      Tool Invoked:', chatData4.mcp_activity?.tool);
    console.log('      Arguments:', chatData4.mcp_activity?.arguments);
    console.log('      Spoken Diagnostic Steps:', chatData4.spoken_response);
    if (chatData4.mcp_activity?.tool !== 'get_diagnostic_steps' || chatData4.mcp_activity?.arguments?.fault_id !== 'dns-failure') {
      throw new Error('Expected get_diagnostic_steps for dns-failure from session context!');
    }

    console.log('\n======================================================');
    console.log(' ALL MCP & SESSION INTENT TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch {}
    if (serverInstance && serverInstance.listening) {
      serverInstance.close(() => {
        process.exit(process.exitCode || 0);
      });
    } else {
      process.exit(process.exitCode || 0);
    }
  }
}

runTests();
