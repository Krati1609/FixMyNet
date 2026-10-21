import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const faultsPath = path.resolve(__dirname, '../data/faults.json');

export const faults = JSON.parse(fs.readFileSync(faultsPath, 'utf8'));

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'and', 'or', 'my', 'i', 'me', 'we', 'it', 'this',
  'that', 'not', 'but', 'be', 'so', 'can', 'cant', 'cannot', 'having',
  'please', 'help', 'tell', 'about', 'some', 'why', 'what'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Deterministic rule-checker that scores input symptoms against network faults.
 * Returns top 3 matches with confidence scores (0.0 to 1.0) and matched reasoning.
 */
export function scoreSymptoms(symptomsText) {
  if (!symptomsText || typeof symptomsText !== 'string' || !symptomsText.trim()) {
    return {
      top_matches: [],
      human_review_required: true,
      human_review_note: 'Notice: No symptoms provided. Please describe what network behavior you are observing.',
      speakable_summary: 'I did not catch any network symptoms. Could you describe what is happening?'
    };
  }

  const normInput = symptomsText.toLowerCase();
  const inputWords = new Set(tokenize(symptomsText));

  const scoredFaults = faults.map(fault => {
    let score = 0;
    const reasons = [];

    // 1. Direct fault name match
    const nameWords = tokenize(fault.name);
    let matchedNameWords = 0;
    for (const nw of nameWords) {
      if (inputWords.has(nw)) {
        matchedNameWords++;
      }
    }
    if (matchedNameWords > 0) {
      score += matchedNameWords * 3.5;
      reasons.push(`Title keyword match (${matchedNameWords} words)`);
    }

    // 2. Exact phrase and symptom keyword matching
    for (const symptom of fault.symptoms) {
      const normSymptom = symptom.toLowerCase();
      if (normInput.includes(normSymptom)) {
        score += 6.0;
        reasons.push(`Exact symptom match: "${symptom}"`);
      } else {
        const sWords = tokenize(symptom);
        let matchingWords = 0;
        for (const sw of sWords) {
          if (inputWords.has(sw)) {
            matchingWords++;
          }
        }
        if (matchingWords > 0) {
          score += matchingWords * 1.5;
          reasons.push(`Symptom keywords matched from "${symptom}"`);
        }
      }
    }

    // 3. Category match
    const catWords = tokenize(fault.category);
    for (const cw of catWords) {
      if (inputWords.has(cw)) {
        score += 2.0;
        reasons.push(`Category match: ${fault.category}`);
      }
    }

    // Normalize confidence into 0.0 - 0.98 range
    const confidence = score > 0
      ? Math.min(0.98, Math.round((score / (score + 5.5)) * 100) / 100)
      : 0.0;

    return {
      id: fault.id,
      name: fault.name,
      category: fault.category,
      severity: fault.severity,
      confidence,
      score,
      why_matched: Array.from(new Set(reasons)).slice(0, 3),
      immediate_fix: fault.fix_steps[0] || 'Inspect physical and network settings.'
    };
  });

  // Sort descending by confidence and score
  scoredFaults.sort((a, b) => b.score - a.score);
  const top3 = scoredFaults.slice(0, 3);

  const topConfidence = top3[0] ? top3[0].confidence : 0;
  const humanReviewRequired = topConfidence < 0.5;
  const humanReviewNote = humanReviewRequired
    ? 'Notice: Low confidence diagnosis (below 50%). Please verify these suggestions manually or check physical connections.'
    : null;

  // Speakable response generation
  let speakableSummary = '';
  if (top3.length === 0 || topConfidence === 0) {
    speakableSummary = 'I could not find a matching network issue. Please check physical cables or describe additional symptoms.';
  } else if (humanReviewRequired) {
    speakableSummary = `With low confidence, this sounds like ${top3[0].name}. Confidence is under 50 percent, so please verify manually. First step: ${top3[0].immediate_fix}`;
  } else {
    speakableSummary = `Based on your symptoms, the most likely issue is ${top3[0].name} with ${Math.round(topConfidence * 100)} percent confidence. First step: ${top3[0].immediate_fix}`;
  }

  return {
    query: symptomsText,
    top_matches: top3,
    human_review_required: humanReviewRequired,
    human_review_note: humanReviewNote,
    speakable_summary: speakableSummary
  };
}

/**
 * Retrieve speakable fix steps for a specific fault ID.
 */
export function getFixSteps(faultId) {
  const fault = faults.find(f => f.id.toLowerCase() === (faultId || '').toLowerCase().trim());
  if (!fault) {
    const validIds = faults.slice(0, 6).map(f => f.id).join(', ');
    return {
      error: `Fault with ID "${faultId}" not found.`,
      available_examples: validIds,
      speakable_summary: `I could not find a fault named ${faultId}. Available examples include: ${validIds}.`
    };
  }

  const speakableSummary = `Fix steps for ${fault.name}: First, ${fault.fix_steps[0]} Second, ${fault.fix_steps[1] || 'verify connectivity.'} Third, ${fault.fix_steps[2] || 'restart the network adapter.'}`;

  return {
    fault_id: fault.id,
    fault_name: fault.name,
    category: fault.category,
    severity: fault.severity,
    fix_steps: fault.fix_steps,
    speakable_summary: speakableSummary
  };
}

/**
 * Retrieve speakable diagnostic steps for a specific fault ID.
 */
export function getDiagnosticSteps(faultId) {
  const fault = faults.find(f => f.id.toLowerCase() === (faultId || '').toLowerCase().trim());
  if (!fault) {
    const validIds = faults.slice(0, 6).map(f => f.id).join(', ');
    return {
      error: `Fault with ID "${faultId}" not found.`,
      available_examples: validIds,
      speakable_summary: `I could not find a fault named ${faultId}. Available examples include: ${validIds}.`
    };
  }

  const speakableSummary = `Diagnostic steps for ${fault.name}: First, ${fault.diagnostic_steps[0]} Second, ${fault.diagnostic_steps[1] || 'test adjacent hosts.'} Third, ${fault.diagnostic_steps[2] || 'check device logs.'}`;

  return {
    fault_id: fault.id,
    fault_name: fault.name,
    category: fault.category,
    severity: fault.severity,
    diagnostic_steps: fault.diagnostic_steps,
    speakable_summary: speakableSummary
  };
}

/**
 * List all fault categories with fault counts and speakable overview.
 */
export function listCategories() {
  const categoryMap = {};
  for (const f of faults) {
    categoryMap[f.category] = (categoryMap[f.category] || 0) + 1;
  }

  const categories = Object.entries(categoryMap).map(([name, count]) => ({
    name,
    fault_count: count
  }));

  const categoryNames = categories.map(c => c.name).join(', ');
  const speakableSummary = `FixMyNet includes ${faults.length} network fault profiles across ${categories.length} categories: ${categoryNames}.`;

  return {
    total_faults: faults.length,
    total_categories: categories.length,
    categories,
    speakable_summary: speakableSummary
  };
}

/**
 * Ordered beginner troubleshooting checklist for common scenarios.
 */
export function getChecklist(scenario) {
  const checklists = {
    'no internet': {
      title: 'No Internet Connection Beginner Checklist',
      scenario: 'no internet',
      steps: [
        'Check physical link: ensure your Ethernet cable click-latches or Wi-Fi shows connected status.',
        'Verify your IP address: ensure it does not start with 169.254, which indicates DHCP failure.',
        'Ping your local router default gateway IP to verify local network connectivity.',
        'Ping public IP 8.8.8.8 to verify outbound internet routing without name resolution.',
        'Run nslookup google.com in terminal to confirm your DNS server is resolving names.'
      ],
      speakable_summary: 'Starting no-internet checklist. Step 1: verify cable clip or Wi-Fi status. Step 2: verify IP is not 169.254. Step 3: ping router gateway. Step 4: ping 8.8.8.8. Step 5: test DNS with nslookup.'
    },
    'slow network': {
      title: 'Slow Network and Throughput Checklist',
      scenario: 'slow network',
      steps: [
        'Test connection medium: verify if the slowdown happens only over Wi-Fi or also on wired Ethernet.',
        'Check local bandwidth consumption: close cloud backup syncs, torrents, and active streaming downloads.',
        'Ping your default gateway to measure LAN latency versus WAN latency to external servers.',
        'Power cycle modem and router for 30 seconds to flush full buffer queues.',
        'Move Wi-Fi clients to the 5 GHz band or switch router to an uncongested wireless channel.'
      ],
      speakable_summary: 'Starting slow network checklist. Step 1: test wired versus Wi-Fi. Step 2: pause cloud syncs. Step 3: ping gateway to isolate LAN versus WAN lag. Step 4: power cycle router. Step 5: switch to 5 GHz band.'
    },
    'intermittent drops': {
      title: 'Intermittent Connection Drops Checklist',
      scenario: 'intermittent drops',
      steps: [
        'Inspect the Ethernet cable connector retaining clip or check for Wi-Fi signal dead zones.',
        'Run a continuous ping test in terminal using ping 8.8.8.8 -t to track exact drop frequencies.',
        'Check system event viewer for duplicate IP address conflict warnings or frequent DHCP lease renewals.',
        'Relocate access point away from RF interference sources like microwave ovens or thick concrete walls.',
        'Update network adapter drivers and verify switch port auto-negotiation settings.'
      ],
      speakable_summary: 'Starting intermittent drops checklist. Step 1: check cable clips and signal strength. Step 2: run ping 8.8.8.8 -t. Step 3: check for duplicate IP conflict logs. Step 4: eliminate RF interference. Step 5: update adapter driver.'
    }
  };

  const selected = checklists[scenario];
  if (!selected) {
    return {
      error: `Unknown scenario "${scenario}". Valid scenarios are: "no internet", "slow network", "intermittent drops".`,
      speakable_summary: 'Please specify one of three scenarios: no internet, slow network, or intermittent drops.'
    };
  }

  return selected;
}
