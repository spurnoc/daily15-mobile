import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import ChatComponent from '../components/ChatComponent';
import { API_BASE } from '../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  _streaming?: boolean;
}

export default function CheckInScreen() {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [done, setDone] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const storedToken = await AsyncStorage.getItem('auth_token');
    setToken(storedToken);
    const sid = await AsyncStorage.getItem('survey_session_id');
    setSessionId(sid || '');

    try {
      const resp = await fetch(`${API_BASE}/api/survey/checkin/status?session_id=${sid}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      const data = await resp.json();
      if (data.has_onboarded) {
        setHasOnboarded(true);
        const lastDate = data.latest_checkin
          ? new Date(data.latest_checkin.created_at).toLocaleDateString()
          : null;
        setMessages([{
          role: 'assistant',
          content: lastDate
            ? `Welcome back. You checked in on ${lastDate}. Ready for today's check-in? What's on your plate today?`
            : "Welcome back. Ready for a quick 2-minute check-in? What's on your plate today?",
        }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
  }

  async function sendAnswer(answer: string) {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: answer }]);

    try {
      const resp = await fetch(`${API_BASE}/api/survey/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answer, session_id: sessionId }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        if (data.mode === 'onboarding') {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Please complete the survey first.' }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
        }
        setLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      let buffer = '';

      if (reader) {
        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  aiText += data.content;
                  setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'assistant' && last._streaming) {
                      return [...prev.slice(0, -1), { role: 'assistant', content: aiText, _streaming: true }];
                    }
                    return [...prev, { role: 'assistant', content: aiText, _streaming: true }];
                  });
                }
                if (data.done) setDone(true);
              } catch (e) {}
            }
          }
        }
      }

      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', content: aiText || '...' } : m
      ));
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!hasOnboarded) {
    return (
      <ChatComponent
        messages={[]}
        setMessages={setMessages}
        onSend={() => {}}
        loading={false}
        title="Not yet"
        subtitle="Daily Check-in"
        done
        doneTitle="Complete the survey first"
        doneText="You need to finish the onboarding survey before you can do daily check-ins."
        doneAction={{
          label: 'Go to Survey',
          onPress: () => navigation.navigate('Survey'),
        }}
      />
    );
  }

  return (
    <ChatComponent
      messages={messages}
      setMessages={setMessages}
      onSend={sendAnswer}
      loading={loading}
      title="Daily Check-in"
      subtitle="Take 2 minutes"
      done={done}
      doneTitle="Check-in done"
      doneText="Your dashboard has been updated with today's priorities."
      doneAction={{
        label: 'View Dashboard',
        onPress: () => navigation.navigate('Dashboard'),
      }}
    />
  );
}
