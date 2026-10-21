import { scoreSymptoms } from './engine.js';
import { sessionStore } from './session-store.js';

/**
 * Determine which MCP tool and arguments to execute based on user utterance and session state.
 *
 * Rule priority:
 * 1. Check for beginner checklist request (scenario).
 * 2. Check for categories / capabilities overview.
 * 3. Check for a fault description FIRST.
 * 4. Only use get_fix_steps / get_diagnostic_steps when the user says "fix" or "diagnostic"
 *    AND there is a previously diagnosed fault for this chat session.
 * 5. If they ask for a fix/diagnostic with no prior diagnosis, ask them to describe the problem first.
 */
export async function routeIntent(userMessage, sessionId) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const session = sessionStore.getSession(sessionId);

  // 1. Checklist intent
  if (lower.includes('checklist') || lower.includes('step by step') || lower.includes('beginner guide')) {
    let scenario = 'no internet';
    if (lower.includes('slow') || lower.includes('speed') || lower.includes('lag')) {
      scenario = 'slow network';
    } else if (lower.includes('drop') || lower.includes('intermittent') || lower.includes('disconnect') || lower.includes('unstable')) {
      scenario = 'intermittent drops';
    }
    return {
      tool: 'run_checklist',
      arguments: { scenario },
      routed_by: 'checklist_rule',
      intent: 'checklist'
    };
  }

  // 2. Categories overview intent
  if (
    lower.includes('category') ||
    lower.includes('categories') ||
    lower.includes('what can you do') ||
    lower.includes('what faults') ||
    lower.includes('list faults') ||
    lower.includes('supported issues')
  ) {
    return {
      tool: 'list_fault_categories',
      arguments: {},
      routed_by: 'categories_rule',
      intent: 'categories'
    };
  }

    // 2b. Live network check intent (short, explicit commands only, so
  // "check why my internet is slow" still goes to fault diagnosis)
  const networkCheckPatterns = [
    /\b(run|do|start|perform)\s+(a\s+|an\s+)?(network|connection|internet)\s+(check|test|scan)\b/,
    /\bcheck\s+(my|the|this)\s+(network|connection|internet|wi-?fi)\b/,
    /\btest\s+(my|the|this)\s+(network|connection|internet|wi-?fi)\b/,
    /\b(network|connection|internet)\s+(check|test|scan)\b/,
    /\bis\s+my\s+(internet|network|wi-?fi|connection)\s+(working|ok|okay|healthy)\b/
  ];
  if (lower.split(/\s+/).length <= 8 && networkCheckPatterns.some((p) => p.test(lower))) {
    return {
      tool: 'run_network_check',
      arguments: {},
      routed_by: 'network_check_rule',
      intent: 'network_check'
    };
  }

  // 3. Check for a fault description FIRST
  // Use scoring engine to see if the user provided meaningful symptom or fault keywords
  const symptomAnalysis = scoreSymptoms(text);
  const describesFault = symptomAnalysis.top_matches.length > 0 && symptomAnalysis.top_matches[0].score >= 1.5;

  if (describesFault) {
    return {
      tool: 'diagnose_issue',
      arguments: { symptoms: text },
      routed_by: 'fault_description',
      intent: 'diagnose'
    };
  }

  // 4. Check for fix intent
  const asksForFix = /\b(fix|repair|solve|resolution|how to fix|what's the fix|whats the fix)\b/i.test(lower);
  if (asksForFix) {
    if (session && session.lastDiagnosedFaultId) {
      return {
        tool: 'get_fix_steps',
        arguments: { fault_id: session.lastDiagnosedFaultId },
        fault_name: session.lastDiagnosedFaultName,
        routed_by: 'session_context_fix',
        intent: 'fix_steps'
      };
    } else {
      return {
        direct_response: true,
        spoken_response: "I haven't diagnosed a network problem yet for this session. Could you describe what issue or symptoms you are experiencing first?",
        display_text: "I haven't diagnosed a network problem yet for this session. Could you describe what issue or symptoms you are experiencing first?",
        intent: 'prompt_for_description'
      };
    }
  }

  // 5. Check for diagnostic steps intent
  const asksForDiagnostic = /\b(diagnostic|diagnose|how to test|how to verify|diagnostic steps|testing steps)\b/i.test(lower);
  if (asksForDiagnostic) {
    if (session && session.lastDiagnosedFaultId) {
      return {
        tool: 'get_diagnostic_steps',
        arguments: { fault_id: session.lastDiagnosedFaultId },
        fault_name: session.lastDiagnosedFaultName,
        routed_by: 'session_context_diagnostic',
        intent: 'diagnostic_steps'
      };
    } else {
      return {
        direct_response: true,
        spoken_response: "I haven't diagnosed a network problem yet for this session. Could you describe what issue or symptoms you are experiencing first?",
        display_text: "I haven't diagnosed a network problem yet for this session. Could you describe what issue or symptoms you are experiencing first?",
        intent: 'prompt_for_description'
      };
    }
  }

  // 6. Default fallback: diagnose with whatever input was provided
  return {
    tool: 'diagnose_issue',
    arguments: { symptoms: text },
    routed_by: 'default_diagnosis',
    intent: 'diagnose'
  };
}
