import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import ChatComponent from '../components/ChatComponent';
import { useSSEChat } from '../hooks/useSSEChat';
import { API_BASE } from '../config';

export default function CheckInScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const { messages, setMessages, loading, done, send } = useSSEChat({
    endpoint: '/api/survey/checkin',
    token,
    sessionId,
  });

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
    } finally {
      setInitDone(true);
    }
  }

  if (initDone && !hasOnboarded) {
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
      onSend={send}
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
