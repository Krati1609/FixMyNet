import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Activity,
  Server,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

const DEMO_COMMANDS = [
  { label: '1. Diagnose Symptom', text: 'I can ping 8.8.8.8 but website names are not resolving' },
  { label: '2. "How do I fix it?" (after symptom)', text: 'How do I fix it?' },
  { label: '3. Diagnostic Steps (uses session)', text: 'What are the diagnostic steps to test it?' },
  { label: '4. No Internet Checklist', text: 'Run the no internet checklist' },
  { label: '5. List Categories', text: 'What categories of network faults do you know?' },
  { label: '6. Fix without Diagnosis Test', text: 'Can you fix my issue?' },
  { label: '7. Low Confidence Test', text: 'Something is behaving strangely on my computer' }
];

export default function App() {
  const [sessionId, setSessionId] = useState(() => 'sess-' + Math.random().toString(36).substring(2, 9));
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hi, I'm FixMyNet, your network troubleshooting assistant. Tell me what network problems you are experiencing, or ask for a troubleshooting checklist.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [mcpLogs, setMcpLogs] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const chatScrollRef = useRef(null);
  const mcpScrollRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
      };
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(transcript);
          handleSendMessage(transcript);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-scroll chat and MCP panel to latest
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (mcpScrollRef.current) {
      mcpScrollRef.current.scrollTop = mcpScrollRef.current.scrollHeight;
    }
  }, [mcpLogs]);

  // Voice output using SpeechSynthesis
  const speakText = (text) => {
    if (!speechEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira')));
    if (naturalVoice) utterance.voice = naturalVoice;

    window.speechSynthesis.speak(utterance);
  };

  // Toggle voice recognition
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or text input fallback.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  // Reset chat session
  const resetSession = () => {
    const newSessionId = 'sess-' + Math.random().toString(36).substring(2, 9);
    setSessionId(newSessionId);
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        sender: 'assistant',
        text: "Session reset. How can I help troubleshoot your network today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Send message to server bridge (/api/chat)
  const handleSendMessage = async (customText) => {
    const textToSend = (customText !== undefined ? customText : inputValue).trim();
    if (!textToSend || isLoading) return;

    const userMessageId = 'msg-' + Date.now();
    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];

    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      // Record MCP Activity if tool was invoked
      if (data.mcp_activity) {
        setMcpLogs(prev => [...prev, {
          id: 'mcp-' + Date.now(),
          ...data.mcp_activity
        }]);
      }

      // Add Assistant Response
      const assistantMessage = {
        id: 'msg-assistant-' + Date.now(),
        sender: 'assistant',
        text: data.spoken_response,
        mcpData: data.mcp_activity?.result,
        tool: data.mcp_activity?.tool,
        intent: data.intent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Speak answer aloud
      speakText(data.spoken_response);
    } catch (error) {
      console.error('Failed to communicate with bridge:', error);
      const errorMessage = {
        id: 'msg-err-' + Date.now(),
        sender: 'assistant',
        text: "Sorry, I had trouble connecting to the MCP network server. Please verify the server is running on port 3001.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
      speakText("Sorry, I had trouble connecting to the network server.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyJson = (id, obj) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">FN</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">FixMyNet</span>
              <span className="brand-badge">MCP Assistant</span>
            </div>
          </div>
        </div>

        <div className="header-controls">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>MCP Server: Streamable HTTP (Stateless)</span>
          </div>

          <button
            className="toggle-btn"
            onClick={resetSession}
            title="Reset current session context"
          >
            <RotateCcw size={14} />
            <span>New Session</span>
          </button>

          <button
            className={`toggle-btn ${speechEnabled ? 'active' : ''}`}
            onClick={() => {
              if (speechEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
              setSpeechEnabled(!speechEnabled);
            }}
            title={speechEnabled ? "Mute Spoken Responses" : "Enable Spoken Responses"}
          >
            {speechEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>Voice Speech: {speechEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </header>

      {/* Main Single-Screen Split Layout */}
      <div className="main-container">
        {/* Left Column: Voice & Chat Interface */}
        <section className="assistant-panel">
          <div className="assistant-panel-header">
            <div className="assistant-status">
              <div className={`assistant-status-ring ${isListening ? 'listening' : ''}`}></div>
              <span>
                {isListening ? 'Listening for voice input...' : isLoading ? 'Consulting MCP server...' : 'Voice Assistant Ready'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Session: <code style={{ background: '#f1f5f9', padding: '2px 5px', borderRadius: '3px' }}>{sessionId}</code>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-history" ref={chatScrollRef}>
            {messages.map((m) => (
              <div key={m.id} className="message-row">
                {m.sender === 'user' ? (
                  <div className="message-bubble user-bubble">
                    {m.text}
                  </div>
                ) : (
                  <div className="message-bubble assistant-bubble">
                    <div className="assistant-bubble-header">
                      <span>Voice Response</span>
                      <button
                        className="speech-btn"
                        onClick={() => speakText(m.text)}
                        title="Replay Voice Speech"
                      >
                        <Volume2 size={13} />
                        <span>Speak</span>
                      </button>
                    </div>

                    <div className="assistant-text">{m.text}</div>

                    {/* Diagnosis Result: Only show fault card if there is a real match with why_matched reasons */}
                    {m.mcpData && m.tool === 'diagnose_issue' && (
                      <>
                        {/* Case 1: Real match with non-empty why_matched reasons */}
                        {m.mcpData.top_matches &&
                         m.mcpData.top_matches.length > 0 &&
                         m.mcpData.top_matches[0].why_matched &&
                         m.mcpData.top_matches[0].why_matched.length > 0 ? (
                          <div className="diagnosis-card">
                            <div className="diagnosis-header">
                              <span className="fault-name">{m.mcpData.top_matches[0].name}</span>
                              <span className={`confidence-badge ${m.mcpData.top_matches[0].confidence >= 0.5 ? 'confidence-high' : 'confidence-low'}`}>
                                {Math.round(m.mcpData.top_matches[0].confidence * 100)}% Confidence
                              </span>
                            </div>

                            {/* Low Confidence Human Review Notice */}
                            {m.mcpData.human_review_required && (
                              <div className="human-review-alert">
                                <AlertTriangle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                                <strong>Manual Review Required:</strong> {m.mcpData.human_review_note}
                              </div>
                            )}

                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>
                              <strong>Category:</strong> {m.mcpData.top_matches[0].category} &bull; <strong>Severity:</strong> {m.mcpData.top_matches[0].severity}
                            </div>

                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                              <strong>Immediate Action:</strong> {m.mcpData.top_matches[0].immediate_fix}
                            </div>

                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                              <strong>Why matched:</strong> {m.mcpData.top_matches[0].why_matched.join(', ')}
                            </div>
                          </div>
                        ) : (
                          /* Case 2: No real match or empty why_matched - Show NO fault card, only human review warning & suggestion */
                          m.mcpData.human_review_required && (
                            <div className="human-review-alert" style={{ marginTop: '10px' }}>
                              <AlertTriangle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                              <strong>Manual Review Required:</strong> {m.mcpData.human_review_note}
                              <div style={{ marginTop: '6px', fontSize: '13px', color: '#92400e' }}>
                                Suggestion: Try asking for the <strong>"no internet" checklist</strong> or describe more symptoms (e.g. error codes, ping results, or cable status).
                              </div>
                            </div>
                          )
                        )}
                      </>
                    )}

                    {/* Rich Checklist Card */}
                    {m.mcpData && m.tool === 'run_checklist' && m.mcpData.steps && (
                      <div className="diagnosis-card">
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#0f172a' }}>
                          {m.mcpData.title}
                        </div>
                        <ol className="steps-list">
                          {m.mcpData.steps.map((step, idx) => (
                            <li key={idx} style={{ padding: '2px 0' }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Rich Fix Steps Card */}
                    {m.mcpData && m.tool === 'get_fix_steps' && m.mcpData.fix_steps && (
                      <div className="diagnosis-card">
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#0f172a' }}>
                          Fix Steps for {m.mcpData.fault_name}
                        </div>
                        <ol className="steps-list">
                          {m.mcpData.fix_steps.map((step, idx) => (
                            <li key={idx} style={{ padding: '2px 0' }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Rich Diagnostic Steps Card */}
                    {m.mcpData && m.tool === 'get_diagnostic_steps' && m.mcpData.diagnostic_steps && (
                      <div className="diagnosis-card">
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#0f172a' }}>
                          Diagnostic Steps for {m.mcpData.fault_name}
                        </div>
                        <ol className="steps-list">
                          {m.mcpData.diagnostic_steps.map((step, idx) => (
                            <li key={idx} style={{ padding: '2px 0' }}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Categories Card */}
                    {m.mcpData && m.tool === 'list_fault_categories' && m.mcpData.categories && (
                      <div className="diagnosis-card">
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#0f172a' }}>
                          Covered Fault Domains ({m.mcpData.total_faults} Faults across {m.mcpData.total_categories} Categories)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {m.mcpData.categories.map((c, idx) => (
                            <span key={idx} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>
                              {c.name} ({c.fault_count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="message-row">
                <div className="message-bubble assistant-bubble" style={{ color: '#64748b', fontStyle: 'italic' }}>
                  Calling MCP tool over Streamable HTTP...
                </div>
              </div>
            )}
          </div>

          {/* Input & Demo Controls */}
          <div className="input-area">
            {/* Quick Demo Voice Chips */}
            <div className="chips-row">
              {DEMO_COMMANDS.map((chip, idx) => (
                <button
                  key={idx}
                  className="demo-chip"
                  onClick={() => handleSendMessage(chip.text)}
                  disabled={isLoading}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <form
              className="input-controls"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              {/* Mic Button for Web Speech API */}
              <button
                type="button"
                className={`action-btn mic-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                title={isListening ? "Listening... click to stop" : "Speak (Web Speech API)"}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Text Input Fallback */}
              <input
                type="text"
                className="text-input"
                placeholder={isListening ? "Listening to your voice..." : "Ask a question (e.g. 'Can ping IP but websites won\'t open' or 'How do I fix it?')"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
              />

              {/* Send Button */}
              <button
                type="submit"
                className="action-btn send-btn"
                disabled={!inputValue.trim() || isLoading}
                title="Send Message"
              >
                <Send size={18} />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: Real-time MCP Activity Inspector Panel */}
        <section className="mcp-panel">
          <div className="mcp-panel-header">
            <div className="mcp-title">
              <Activity size={18} color="#0284c7" />
              <span>Real-Time MCP Activity</span>
              <span className="mcp-badge">POST /mcp</span>
            </div>
            <div className="mcp-call-counter">
              {mcpLogs.length} Tool {mcpLogs.length === 1 ? 'Call' : 'Calls'} Recorded
            </div>
          </div>

          <div className="mcp-content" ref={mcpScrollRef}>
            {mcpLogs.length === 0 ? (
              <div className="mcp-empty-state">
                <Server size={44} className="mcp-empty-icon" />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  No MCP Calls Yet
                </h3>
                <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  Speak or type a question on the left to watch live MCP tool invocations (JSON-RPC requests, arguments, latency, and outputs) streaming over Streamable HTTP transport.
                </p>
              </div>
            ) : (
              mcpLogs.map((log) => (
                <div key={log.id} className="mcp-activity-card">
                  <div className="mcp-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mcp-tool-pill">{log.tool}</span>
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>200 OK</span>
                    </div>

                    <div className="mcp-meta">
                      <span>{log.duration_ms} ms</span>
                      <button
                        className="speech-btn"
                        style={{ padding: '2px 6px' }}
                        onClick={() => copyJson(log.id, log)}
                        title="Copy Raw MCP Payload"
                      >
                        {copiedId === log.id ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedId === log.id ? 'Copied' : 'JSON'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Arguments */}
                  <div className="mcp-section">
                    <div className="mcp-section-title">Arguments (Zod Input)</div>
                    <pre className="json-viewer">
                      {JSON.stringify(log.arguments, null, 2)}
                    </pre>
                  </div>

                  {/* Result */}
                  <div className="mcp-section">
                    <div className="mcp-section-title">Result Payload (JSON-RPC)</div>
                    <pre className="json-viewer">
                      {JSON.stringify(log.result, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
