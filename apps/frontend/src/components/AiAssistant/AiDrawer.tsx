// ============================================================
// AI Terminal Copilot Drawer Component
// ============================================================
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Trash2, Cpu } from 'lucide-react';
import { queryAi, ChatMessage } from '../../services/aiService';
import { getAiConfig } from '../../config/ai';

interface AiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiDrawer({ isOpen, onClose }: AiDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'AI Quantitative Copilot initialized (OrcaRouter Gateway).\nAsk for setup breakdowns, market regimes, or risk-sizing strategies.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const config = getAiConfig();

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: prompt };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const systemPrompt: ChatMessage = {
        role: 'system',
        content:
          'You are an expert quantitative trading terminal AI assistant. Answer concisely, analytically, with exact numeric logic, and without any emojis. Maintain a serious institutional trader tone.',
      };

      const response = await queryAi([systemPrompt, ...updated]);
      setMessages([...updated, { role: 'assistant', content: response }]);
    } catch (err: any) {
      setError(err.message || 'Error communicating with AI service');
    } finally {
      setLoading(false);
    }
  };

  const keyDisplay = config.apiKey
    ? `${config.apiKey.slice(0, 7)}...${config.apiKey.slice(-6)}`
    : 'Not Set';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={15} style={{ color: 'var(--text-accent)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em' }}>
            AI COPILOT TERMINAL
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setMessages([])}
            title="Clear Chat"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div
        style={{
          padding: '6px 16px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>ROUTER: OrcaRouter</span>
        <span>KEY: {keyDisplay}</span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              backgroundColor:
                m.role === 'user' ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderLeft:
                m.role === 'assistant'
                  ? '2px solid var(--text-accent)'
                  : '1px solid var(--border-subtle)',
              padding: '10px 12px',
              fontSize: '11px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}
            >
              {m.role === 'user' ? 'TRADER' : 'ORCA AI'}
            </div>
            {m.content}
          </div>
        ))}
        {loading && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              padding: '8px 12px',
            }}
          >
            Processing query...
          </div>
        )}
        {error && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--short)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '8px 12px',
              border: '1px solid var(--short)',
            }}
          >
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        <button
          onClick={() => handleSend('Summarize current market regime across major assets.')}
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Market Regime
        </button>
        <button
          onClick={() => handleSend('Explain risk management sizing for gold lots vs crypto.')}
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Risk Sizing
        </button>
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSend();
          }}
          placeholder="Ask AI Copilot..."
          disabled={loading}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '8px 10px',
            fontSize: '11px',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            padding: '0 12px',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
