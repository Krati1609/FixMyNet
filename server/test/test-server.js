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
        if (toolsResult.tools.length !== 6) {
      throw new Error(`Expected 6 tools, got ${toolsResult.tools.length}`);
    }
    if (!toolsResult.tools.some((t) => t.name === 'run_network_check')) {
      throw new Error('Expected run_network_check to be registered!');
    }
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

    // Test 3: diagnose_issue (Low confidence / vague input)
    console.log('4. Testing diagnose_issue with vague input: "some strange mystery"...');
    const diagLow = await client.callTool({
      name: 'diagnose_issue',
      arguments: {
        symptoms: 'some strange mystery'
      }
    });
    const parsedLow = JSON.parse(diagLow.content[0].text);
    console.log('Top matches count:', parsedLow.top_matches.length);
    console.log('Human review required?', parsedLow.human_review_required);
    console.log('Human review note:', parsedLow.human_review_note);
    console.log('Speakable:', parsedLow.speakable_summary);
    if (parsedLow.top_matches.length !== 0) {
      throw new Error(`Expected empty top_matches for vague input, got ${parsedLow.top_matches.length}`);
    }
    if (!parsedLow.human_review_required) {
      throw new Error('Expected human_review_required to be true for vague input!');
    }
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

        // Test 7b: run_network_check (live tests on this machine, so only the shape is asserted)
    console.log('8b. Testing run_network_check (live checks on this computer)...');
    const netResult = await client.callTool({
      name: 'run_network_check',
      arguments: {}
    });
    const parsedNet = JSON.parse(netResult.content[0].text);
    console.log('Overall:', parsedNet.overall);
    console.log('Problem:', parsedNet.problem);
    console.log('Average latency (ms):', parsedNet.average_latency_ms);
    console.log('Checks:', parsedNet.checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name}`).join(' | '));
    console.log('Speakable:', parsedNet.speakable_summary);
    if (!['healthy', 'degraded', 'down'].includes(parsedNet.overall)) {
      throw new Error(`Unexpected overall status: ${parsedNet.overall}`);
    }
    if (!Array.isArray(parsedNet.checks) || parsedNet.checks.length === 0) {
      throw new Error('Expected a non-empty checks array!');
    }
    if (typeof parsedNet.spoken_summary !== 'string' || !parsedNet.spoken_summary) {
      throw new Error('Expected a spoken_summary string!');
    }
    if (JSON.stringify(parsedNet).match(/\b\d{1,3}(\.\d{1,3}){3}\b/g)?.some((ip) => !['1.1.1.1', '8.8.8.8'].includes(ip))) {
      throw new Error('Result must not expose any IP addresses other than the fixed test targets!');
    }
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

    // 8e. Vague input in a new session -> empty top_matches, no fault saved, then "How do I fix it?" -> prompt_for_description
    console.log('   e) User enters vague input in new session, then asks "How do I fix it?"...');
    const vagueSessionId = 'vague-session-' + Date.now();
    const chatResVague = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'some strange mystery', sessionId: vagueSessionId })
    });
    const chatDataVague = await chatResVague.json();
    console.log('      Vague query top_matches count:', chatDataVague.mcp_activity?.result?.top_matches?.length);
    console.log('      Vague query session last_diagnosed_fault_id:', chatDataVague.last_diagnosed_fault_id);
    if (chatDataVague.mcp_activity?.result?.top_matches?.length !== 0) {
      throw new Error('Expected 0 top_matches for vague query!');
    }
    if (chatDataVague.last_diagnosed_fault_id !== null) {
      throw new Error(`Expected null last_diagnosed_fault_id, got ${chatDataVague.last_diagnosed_fault_id}`);
    }

    // Now follow up with "How do I fix it?" in the vague session
    const chatResFixAfterVague = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'How do I fix it?', sessionId: vagueSessionId })
    });
    const chatDataFixAfterVague = await chatResFixAfterVague.json();
    console.log('      Follow-up intent:', chatDataFixAfterVague.intent);
    console.log('      Follow-up response:', chatDataFixAfterVague.spoken_response);
    if (chatDataFixAfterVague.intent !== 'prompt_for_description') {
      throw new Error(`Expected intent prompt_for_description, got ${chatDataFixAfterVague.intent}`);
    }
    if (!chatDataFixAfterVague.spoken_response.includes("haven't diagnosed a network problem yet")) {
      throw new Error('Expected prompt for description on fix after vague query!');
    }

        // 8f. "check my network" routes to run_network_check
    console.log('   f) User says "check my network"...');
    const netSessionId = 'net-session-' + Date.now();
    const chatResNet = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'check my network', sessionId: netSessionId })
    });
    const chatDataNet = await chatResNet.json();
    console.log('      Routed By:', chatDataNet.routed_by);
    console.log('      Intent:', chatDataNet.intent);
    console.log('      Network check overall:', chatDataNet.network_check?.overall);
    console.log('      Spoken Response:', chatDataNet.spoken_response);
    if (chatDataNet.routed_by !== 'network_check_rule') {
      throw new Error(`Expected network_check_rule, got ${chatDataNet.routed_by}`);
    }
    if (!chatDataNet.network_check || !chatDataNet.network_check.overall) {
      throw new Error('Expected network_check result in the chat response!');
    }

    // 8g. A longer description must NOT trigger the live check
    console.log('   g) User says "check why my internet is slow" (should go to normal diagnosis)...');
    const chatResLong = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'check why my internet is slow', sessionId: 'long-session-' + Date.now() })
    });
    const chatDataLong = await chatResLong.json();
    console.log('      Routed By:', chatDataLong.routed_by);
    if (chatDataLong.routed_by === 'network_check_rule') {
      throw new Error('A symptom description should not trigger the live network check!');
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
