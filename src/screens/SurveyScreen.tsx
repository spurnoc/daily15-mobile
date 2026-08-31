import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import ChatComponent from '../components/ChatComponent';
import { useSSEChat } from '../hooks/useSSEChat';
import { API_BASE } from '../config';

const BUSINESS_TYPES = [
  'Restaurant/Cafe', 'Salon/Spa/Barber', 'Plumber/Electrician/HVAC',
  'Retail/Boutique', 'Gym/Fitness Studio', 'Landscaping/Lawn Care',
  'Auto Repair/Detailing', 'Cleaning Service', 'Photography/Video',
  'Real Estate', 'Other',
];

const OPENING_MESSAGE = 'Hey — quick survey about how you run your business. What kind of business do you run?';

export default function SurveyScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(13);
  const [initialChoices, setInitialChoices] = useState<string[] | null>(BUSINESS_TYPES);
  const [ready, setReady] = useState(false);
  const initRef = useRef(false);

  const { messages, setMessages, loading, choices, done, extraData, send } = useSSEChat({
    endpoint: '/api/survey/chat',
    token,
    sessionId,
  });

  // Show opening message immediately
  useEffect(() => {
    setMessages([{ role: 'assistant', content: OPENING_MESSAGE }]);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    init();
  }, []);

  useEffect(() => {
    if (extraData.state) {
      setQIndex(extraData.state.q_index || 0);
      setTotalQ(extraData.state.total_questions || 13);
    }
  }, [extraData]);

  async function init() {
    const storedToken = await AsyncStorage.getItem('auth_token');
    setToken(storedToken);
    let sid = await AsyncStorage.getItem('survey_session_id');
    if (!sid) {
      sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      await AsyncStorage.setItem('survey_session_id', sid);
    }
    setSessionId(sid);
    setReady(true);

    // Check if session already has progress
    try {
      const resp = await fetch(`${API_BASE}/api/survey/state?session_id=${sid}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      const data = await resp.json().catch(() => ({}));
      if (data.conversation && data.conversation.length > 0) {
        setMessages(data.conversation);
        setQIndex(data.q_index || 0);
        setTotalQ(data.total_questions || 13);
        setInitialChoices(null);
      }
    } catch (e) {
      // Keep the opening message + choices
    }
  }

  const activeChoices = choices || initialChoices;

  // Don't render until sessionId is set (prevents sending with empty session)
  if (!ready) {
    return null;
  }

  return (
    <ChatComponent
      messages={messages}
      setMessages={setMessages}
      onSend={send}
      loading={loading}
      title="Onboarding"
      subtitle="Daily 15 Survey"
      progress={{ current: qIndex, total: totalQ }}
      choices={activeChoices}
      onChoiceSelect={(choice) => {
        setInitialChoices(null);
        send(choice);
      }}
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
