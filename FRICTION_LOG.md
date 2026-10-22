## Friction 1: No clear way to connect a self-hosted MCP server to real Alexa+
- **Task attempted:** Understand how my MCP server would connect to a real Alexa+ device or account, beyond the simulated web app.
- **Steps taken:** Read the Alexa+ track requirements and rules, and looked for connection or registration steps for a custom MCP server.
- **Expected:** A short guide or link explaining how a developer's own MCP server is registered or tested with Alexa+.
- **Actual:** The requirements describe the server spec (Streamable HTTP, 2025-11-25+) and allow a simulated experience, but I found no steps for connecting to a real Alexa+ device. I did not own one.
- **Severity:** Medium
- **Workaround:** Built a simulated Alexa+ web app that acts as a real MCP client against my server.
- **Suggestion:** Add one paragraph and link to the Alexa+ track page on how Preview partners connect, or provide a simulator for developers without a device.

## Friction 2: Browser speech recognition mishears technical phrases
- **Task attempted:** Demo voice input with the phrase "I can ping 8.8.8.8 but website names are not resolving".
- **Steps taken:** Used the browser's Web Speech API (Chrome) and spoke the sentence.
- **Expected:** An accurate transcript.
- **Actual:** "ping" was heard as "paint" and IP addresses were garbled, so the diagnosis didn't match.
- **Severity:** Medium
- **Workaround:** Changed the demo phrases to plain words with no numbers ("I cannot open websites by domain name") and added text chips as a fallback.
- **Suggestion:** Tools that simulate Alexa+ voice input would help developers test with Alexa's own recognizer, which handles technical terms differently from the browser.

## Friction 3: Windows PowerShell breaks one-line test commands
- **Task attempted:** Verify the MCP server by running a one-line Node command in the terminal.
- **Steps taken:** Ran an inline `node -e "..."` command in PowerShell.
- **Expected:** The script runs as written.
- **Actual:** Quote escaping in PowerShell mangled the command and it failed.
- **Severity:** Low
- **Workaround:** Moved the logic into a helper module and ran it as a normal test script.
- **Suggestion:** MCP quick-start examples could use script files, or include a Windows (PowerShell) version of any shell commands.

## Friction 4: Direct public-DNS query times out on some networks
- **Task attempted:** Add a live network check that tests DNS two ways: through the system resolver and with a direct query to a public DNS server (1.1.1.1), using Node's `dns` module.
- **Steps taken:** Used `node:dns/promises` with a custom `Resolver` pointed at 1.1.1.1, with a 2-second timeout, and ran the check on my home network.
- **Expected:** The same result every time on a working connection.
- **Actual:** On my network the direct query sometimes timed out and showed a failed check while the system DNS and the website request worked. Another run passed.
- **Severity:** Low
- **Workaround:** Kept the check, show its reason on the result card, and only mark the overall result "degraded" if the system DNS also fails.
- **Suggestion:** Document that direct DNS queries to public servers can be blocked or slow on some networks, and that the resolver's timeout and retry options need tuning for reliable checks.