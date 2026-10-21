import os from 'node:os';
import net from 'node:net';
import { lookup, Resolver } from 'node:dns/promises';

// Fixed targets only. Nothing here comes from user input.
const TCP_TARGETS = [
  { name: 'Cloudflare 1.1.1.1:443', host: '1.1.1.1', port: 443 },
  { name: 'Google 8.8.8.8:53', host: '8.8.8.8', port: 53 },
];
const TEST_DOMAIN = 'example.com';
const TEST_URL = 'https://example.com';
const TIMEOUT_MS = 3000;

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = net.connect({ host, port });
    let done = false;
    const finish = (ok, error) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ok, ms: Math.round(performance.now() - start), error });
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (e) => finish(false, e.code || 'error'));
  });
}

async function timed(fn, limitMs = 4000) {
  const start = performance.now();
  let timer;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), limitMs);
      }),
    ]);
    return { ok: true, ms: Math.round(performance.now() - start) };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - start), error: e.code || e.message };
  } finally {
    clearTimeout(timer);
  }
}

function checkAdapters() {
  const addrs = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      const isV4 = a.family === 'IPv4' || a.family === 4;
      if (isV4 && !a.internal) addrs.push(a.address);
    }
  }
  const apipa = addrs.filter((a) => a.startsWith('169.254.'));
  const usable = addrs.filter((a) => !a.startsWith('169.254.'));
  // Counts only. IP addresses are deliberately not returned.
  return { usable: usable.length, apipa: apipa.length };
}

export async function runNetworkCheck() {
  const adapters = checkAdapters();

  const publicResolver = new Resolver({ timeout: 2000, tries: 1 });
  publicResolver.setServers(['1.1.1.1']);

  const [tcp, systemDns, publicDns, https] = await Promise.all([
    Promise.all(TCP_TARGETS.map(async (t) => ({ ...t, ...(await tcpProbe(t.host, t.port)) }))),
    timed(() => lookup(TEST_DOMAIN)),
    timed(() => publicResolver.resolve4(TEST_DOMAIN)),
    timed(() => fetch(TEST_URL, { method: 'HEAD', signal: AbortSignal.timeout(4000) })),
  ]);

  const reachable = tcp.filter((t) => t.ok);
  const avgMs = reachable.length
    ? Math.round(reachable.reduce((s, t) => s + t.ms, 0) / reachable.length)
    : null;

  let overall = 'healthy';
  let problem = 'none';
  let symptom = null; // fed to diagnose_issue so the existing engine can explain it
  let spoken = `Your connection looks healthy. Internet reachable in about ${avgMs} milliseconds, and name lookup works.`;

  if (adapters.usable === 0 && adapters.apipa === 0) {
    overall = 'down';
    problem = 'no_connection';
    symptom = 'no network connection, no ip address, cable unplugged or wifi disconnected';
    spoken = 'This computer has no active network connection. Check the cable or Wi-Fi.';
  } else if (adapters.usable === 0 && adapters.apipa > 0) {
    overall = 'down';
    problem = 'no_dhcp_address';
    symptom = 'ip address 169.254 self assigned, dhcp not giving an address';
    spoken = 'This computer gave itself a fallback address, so it is not getting an address from your router.';
  } else if (reachable.length === 0) {
    overall = 'down';
    problem = 'no_internet';
    symptom = 'cannot reach internet, ping 8.8.8.8 fails';
    spoken = 'You are connected to a network, but the internet is not reachable.';
  } else if (!systemDns.ok) {
    overall = 'degraded';
    problem = 'dns_failure';
    symptom = 'cannot open websites by domain name, ping IP works';
    spoken = publicDns.ok
      ? 'The internet works by address, but your computer name lookup is failing. A public name server works, so your configured DNS is the likely problem.'
      : 'The internet works by address, but name lookup is failing.';
  } else if (!https.ok) {
    overall = 'degraded';
    problem = 'web_blocked';
    symptom = 'website will not load but dns works, firewall may be blocking';
    spoken = 'Name lookup works, but the test website did not load. A firewall or proxy may be blocking web traffic.';
  } else if (reachable.length < tcp.length || avgMs > 250) {
    overall = 'degraded';
    problem = 'slow_or_unstable';
    symptom = 'slow internet, high latency, packet loss';
    spoken = `Connected, but the connection looks slow or unstable. Average response was ${avgMs} milliseconds.`;
  }

  const checks = [
    { name: 'Network adapter', ok: adapters.usable > 0, detail: `${adapters.usable} usable adapter(s)${adapters.apipa ? `, ${adapters.apipa} with fallback address` : ''}` },
    ...tcp.map((t) => ({ name: `Reach ${t.name}`, ok: t.ok, ms: t.ms, detail: t.ok ? 'connected' : t.error })),
    { name: 'System DNS lookup', ok: systemDns.ok, ms: systemDns.ms, detail: systemDns.ok ? 'resolved' : systemDns.error },
    { name: 'Public DNS (1.1.1.1)', ok: publicDns.ok, ms: publicDns.ms, detail: publicDns.ok ? 'resolved' : publicDns.error },
    { name: 'HTTPS request', ok: https.ok, ms: https.ms, detail: https.ok ? 'responded' : https.error },
  ];

  return {
    overall,
    problem,
    average_latency_ms: avgMs,
    checks,
    symptom_summary: symptom,
    spoken_summary: spoken,
    scope_note: 'This checks the computer that is running the FixMyNet server.',
  };
}