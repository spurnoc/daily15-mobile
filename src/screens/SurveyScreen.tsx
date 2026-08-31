import React, { useState, useEffect } from 'react';
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

export default function SurveyScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(13);
  const [initialMessages, setInitialMessages] = useState<any[] | null>(null);
  const [initialChoices, setInitialChoices] = useState<string[] | null>(null);

  const { messages, setMessages, loading, choices, done, extraData, send } = useSSEChat({
    endpoint: '/api/survey/chat',
    token,
    sessionId,
  });

  useEffect(() => {
    init();
  }, []);

  // Update progress from SSE data
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

    try {
      const resp = await fetch(`${API_BASE}/api/survey/state?session_id=${sid}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      const data = await resp.json();
      if (data.conversation && data.conversation.length > 0) {
        setMessages(data.conversation);
        setQIndex(data.q_index || 0);
        setTotalQ(data.total_questions || 13);
        if (data.q_index >= (data.total_questions || 13)) {
          // Already done — mark as done
        }
      } else {
        setMessages([{ role: 'assistant', content: 'Hey — quick survey about how you run your business. What kind of business do you run?' }]);
        setInitialChoices(BUSINESS_TYPES);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
  }

  // Merge initial choices with streaming choices
  const activeChoices = choices || initialChoices;

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
