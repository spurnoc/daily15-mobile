import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { API_BASE } from '../config';

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
 * Custom hook for SSE-based chat with character-by-character streaming.
 * Uses XMLHttpRequest on React Native (supports onprogress for streaming).
 * Uses fetch + ReadableStream on web.
 */
export function useSSEChat({ endpoint, token, sessionId }: UseSSEChatOptions): UseSSEChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<string[] | null>(null);
  const [done, setDone] = useState(false);
  const [extraData, setExtraData] = useState<Record<string, any>>({});
  const aiTextRef = useRef('');
  const bufferRef = useRef('');

  const updateStreamingMessage = useCallback(() => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last._streaming) {
        return [...prev.slice(0, -1), { role: 'assistant', content: aiTextRef.current, _streaming: true }];
      }
      return [...prev, { role: 'assistant', content: aiTextRef.current, _streaming: true }];
    });
  }, []);

  const parseSSEChunk = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    const lines = bufferRef.current.split('\n');
    bufferRef.current = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const dataStr = line.slice(6);
      if (dataStr === '[DONE]') continue;

      try {
        const data = JSON.parse(dataStr);
        if (data.content) {
          aiTextRef.current += data.content;
          updateStreamingMessage();
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
  }, [updateStreamingMessage]);

  const send = useCallback(async (answer: string) => {
    setChoices(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: answer }]);

    aiTextRef.current = '';
    bufferRef.current = '';

    try {
      if (Platform.OS === 'web') {
        // Web: use fetch + ReadableStream
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

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) break;
            parseSSEChunk(decoder.decode(value, { stream: true }));
          }
        }
      } else {
        // React Native: use XMLHttpRequest with onprogress for streaming
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE}${endpoint}`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          let resolved = false;

          xhr.onreadystatechange = () => {
            if (xhr.readyState === 2) {
              // Headers received — check status
              if (xhr.status !== 200) {
                resolved = true;
                let errorMsg = 'Something went wrong. Try again.';
                try {
                  const errorData = JSON.parse(xhr.responseText || '{}');
                  if (errorData.mode === 'onboarding') {
                    errorMsg = 'Please complete the survey first.';
                  } else if (errorData.detail) {
                    errorMsg = errorData.detail;
                  }
                } catch (e) {}
                setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
                reject(new Error(`HTTP ${xhr.status}`));
              }
            }
          };

          xhr.onprogress = () => {
            // Get the new data since last call
            const newText = xhr.responseText.substring(aiTextRef.current.length + bufferRef.current.length);
            if (newText) {
              parseSSEChunk(newText);
            }
          };

          xhr.onload = () => {
            if (resolved) return;
            resolved = true;
            // Parse any remaining buffered data
            if (bufferRef.current) {
              parseSSEChunk('\n');
            }
            // Finalize: remove streaming flag
            if (aiTextRef.current) {
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1
                  ? { role: 'assistant', content: aiTextRef.current }
                  : m
              ));
            } else {
              // No streaming content — response is plain text
              const text = xhr.responseText;
              const lines = text.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.content) {
                    aiTextRef.current += data.content;
                  }
                } catch (e) {}
              }
              if (aiTextRef.current) {
                setMessages(prev => [...prev, { role: 'assistant', content: aiTextRef.current }]);
              }
            }
            resolve();
          };

          xhr.onerror = () => {
            if (resolved) return;
            resolved = true;
            reject(new Error('Network error'));
          };

          xhr.ontimeout = () => {
            if (resolved) return;
            resolved = true;
            reject(new Error('Request timeout'));
          };

          xhr.timeout = 90000; // 90s timeout for LLM responses
          xhr.send(JSON.stringify({ answer, session_id: sessionId }));
        });
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
  }, [endpoint, token, sessionId, parseSSEChunk]);

  const reset = useCallback(() => {
    setMessages([]);
    setLoading(false);
    setChoices(null);
    setDone(false);
    setExtraData({});
    aiTextRef.current = '';
    bufferRef.current = '';
  }, []);

  return { messages, setMessages, loading, choices, done, extraData, send, reset };
}
