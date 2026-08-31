import React, { useState, useEffect } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import ChatComponent from '../components/ChatComponent';
import { API_BASE, COLORS, SPACING, FONT_SIZES } from '../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  _streaming?: boolean;
}

const BUSINESS_TYPES = [
  'Restaurant/Cafe', 'Salon/Spa/Barber', 'Plumber/Electrician/HVAC',
  'Retail/Boutique', 'Gym/Fitness Studio', 'Landscaping/Lawn Care',
  'Auto Repair/Detailing', 'Cleaning Service', 'Photography/Video',
  'Real Estate', 'Other',
];

export default function SurveyScreen() {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(13);
  const [done, setDone] = useState(false);
  const [choices, setChoices] = useState<string[] | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const storedToken = await AsyncStorage.getItem('auth_token');
    setToken(storedToken);
    let sid = await AsyncStorage.getItem('survey_session_id');
    if (!sid) {
      sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      await AsyncStorage.setItem('survey_session_id', sid);
    }
    setSessionId(sid);

    try {
      const resp = await fetch(`${API_BASE}/api/survey/state?session_id=${sid}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      const data = await resp.json();
      if (data.conversation && data.conversation.length > 0) {
        setMessages(data.conversation);
        setQIndex(data.q_index || 0);
        setTotalQ(data.total_questions || 13);
        setHasStarted(true);
        if (data.q_index >= (data.total_questions || 13)) {
          setDone(true);
        }
      } else {
        // New — show business type selection
        setMessages([{ role: 'assistant', content: 'Hey — quick survey about how you run your business. What kind of business do you run?' }]);
        setChoices(BUSINESS_TYPES);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
  }

  async function sendAnswer(answer: string) {
    setChoices(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: answer }]);

    try {
      const resp = await fetch(`${API_BASE}/api/survey/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answer, session_id: sessionId }),
      });

      if (!resp.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
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
                if (data.choices) setChoices(data.choices);
                if (data.done) setDone(true);
                if (data.state) {
                  setQIndex(data.state.q_index || 0);
                  setTotalQ(data.state.total_questions || 13);
                }
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

  return (
    <ChatComponent
      messages={messages}
      setMessages={setMessages}
      onSend={sendAnswer}
      loading={loading}
      title="Onboarding"
      subtitle="Daily 15 Survey"
      progress={{ current: qIndex, total: totalQ }}
      choices={choices}
      onChoiceSelect={(choice) => sendAnswer(choice)}
      done={done}
      doneTitle="You're all set"
      doneText="Your dashboard is ready with personalized cards for your business."
      doneAction={{
        label: 'View Dashboard',
        onPress: () => navigation.navigate('Dashboard'),
      }}
    />
  );
}
