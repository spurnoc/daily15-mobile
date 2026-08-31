import { useState, useRef, useCallback } from 'react';
import { API_BASE } from '../config';
import { Platform } from 'react-native';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  _streaming?: boolean;
}

interface UseSSEChatOptions {
  endpoint: string;
  token: string | null;
  sessionId: string;
}

interface UseSSEChatReturn {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  choices: string[] | null;
  done: boolean;
  extraData: Record<string, any>;
  send: (answer: string) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for SSE-based chat communication.
 * Works on both web (ReadableStream) and React Native (text response).
 */
export function useSSEChat({ endpoint, token, sessionId }: UseSSEChatOptions): UseSSEChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<string[] | null>(null);
  const [done, setDone] = useState(false);
  const [extraData, setExtraData] = useState<Record<string, any>>({});
  const aiTextRef = useRef('');

  const send = useCallback(async (answer: string) => {
    setChoices(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: answer }]);

    try {
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answer, session_id: sessionId }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const errorMsg = errorData.mode === 'onboarding'
          ? 'Please complete the survey first.'
          : 'Something went wrong. Try again.';
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        setLoading(false);
        return;
      }

      aiTextRef.current = '';

      // React Native doesn't support ReadableStream/body.getReader()
      // Fall back to reading the full response as text and parsing SSE lines
      const text = await resp.text();
      const lines = text.split('\n');
      let foundContent = false;

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.content) {
            aiTextRef.current += data.content;
            foundContent = true;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last._streaming) {
                return [...prev.slice(0, -1), { role: 'assistant', content: aiTextRef.current, _streaming: true }];
              }
              return [...prev, { role: 'assistant', content: aiTextRef.current, _streaming: true }];
            });
          }
          if (data.choices) setChoices(data.choices);
          if (data.done) setDone(true);
          if (data.state || data.step || data.total_steps) {
            setExtraData(prev => ({ ...prev, ...data }));
          }
        } catch (e) {
          // Malformed JSON — skip
        }
      }

      // If no streaming content was found, the full text IS the response
      if (!foundContent && text.trim()) {
        aiTextRef.current = text.trim();
        setMessages(prev => [...prev, { role: 'assistant', content: aiTextRef.current }]);
      }

      // Finalize: remove streaming flag
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { role: 'assistant', content: aiTextRef.current || '...' }
          : m
      ));
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, token, sessionId]);

  const reset = useCallback(() => {
    setMessages([]);
    setLoading(false);
    setChoices(null);
    setDone(false);
    setExtraData({});
    aiTextRef.current = '';
  }, []);

  return { messages, setMessages, loading, choices, done, extraData, send, reset };
}
