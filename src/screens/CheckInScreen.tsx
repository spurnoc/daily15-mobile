import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, COLORS, SPACING, FONT_SIZES } from '../config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CheckInScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [done, setDone] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const storedToken = await AsyncStorage.getItem('auth_token');
    setToken(storedToken);
    const sid = await AsyncStorage.getItem('survey_session_id');
    setSessionId(sid || '');

    // Check if onboarding is complete
    try {
      const resp = await fetch(`${API_BASE}/api/survey/checkin/status?session_id=${sid}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      const data = await resp.json();
      if (data.has_onboarded) {
        setHasOnboarded(true);
        setMessages([{ role: 'assistant', content: "Welcome back. What's on your plate today?" }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Complete the survey first to start check-ins.' }]);
    }
  }

  async function sendAnswer() {
    if (!input.trim() || loading) return;
    const answer = input.trim();
    setInput('');
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

      // Read SSE stream
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
                    if (last?.role === 'assistant' && (last as any)._streaming) {
                      return [...prev.slice(0, -1), { role: 'assistant', content: aiText, _streaming: true } as any];
                    }
                    return [...prev, { role: 'assistant', content: aiText, _streaming: true } as any];
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

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.complete}>
          <Text style={styles.completeIcon}>✓</Text>
          <Text style={styles.completeTitle}>Check-in done</Text>
          <Text style={styles.completeText}>Your dashboard has been updated with today's priorities.</Text>
        </View>
      </View>
    );
  }

  if (!hasOnboarded) {
    return (
      <View style={styles.container}>
        <View style={styles.complete}>
          <Text style={styles.completeTitle}>Not yet</Text>
          <Text style={styles.completeText}>Complete the survey first to start daily check-ins.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[styles.message, item.role === 'user' ? styles.userMsg : styles.aiMsg]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.bubbleText, item.role === 'user' ? styles.userBubbleText : styles.aiBubbleText]}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.messageList}
      />

      {loading && (
        <View style={styles.thinkingContainer}>
          <ActivityIndicator size="small" color={COLORS.textMuted} />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your answer..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxHeight={100}
          editable={!loading}
          onSubmitEditing={sendAnswer}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={sendAnswer}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  messageList: { padding: SPACING.md, paddingBottom: SPACING.xl },
  message: { marginBottom: SPACING.sm, flexDirection: 'row' },
  userMsg: { justifyContent: 'flex-end' },
  aiMsg: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: SPACING.md },
  userBubble: { backgroundColor: COLORS.text },
  aiBubble: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  bubbleText: { fontSize: FONT_SIZES.md, lineHeight: 22 },
  userBubbleText: { color: COLORS.bg },
  aiBubbleText: { color: COLORS.text },
  thinkingContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm,
  },
  thinkingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  inputContainer: {
    flexDirection: 'row', padding: SPACING.md, gap: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  input: {
    flex: 1, backgroundColor: COLORS.inputBg, borderRadius: 20,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    color: COLORS.text, fontSize: FONT_SIZES.md, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: { color: COLORS.bg, fontSize: 22, fontWeight: '700' },
  complete: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  completeIcon: { fontSize: 64, color: COLORS.success, marginBottom: SPACING.md },
  completeTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  completeText: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, textAlign: 'center' },
});
