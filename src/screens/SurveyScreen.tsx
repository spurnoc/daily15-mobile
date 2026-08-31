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

export default function SurveyScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [totalQ, setTotalQ] = useState(13);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [done, setDone] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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

    // Fetch state
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
          setDone(true);
        }
      } else {
        setMessages([{ role: 'assistant', content: 'Hey — quick survey about how you run your business. What kind of business do you run?' }]);
      }
    } catch (e) {
      setMessages([{ role: 'assistant', content: 'Hey — quick survey about how you run your business. What kind of business do you run?' }]);
    }
  }

  async function sendAnswer() {
    if (!input.trim() || loading) return;
    const answer = input.trim();
    setInput('');
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
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
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
                    if (last?.role === 'assistant' && last._streaming) {
                      return [...prev.slice(0, -1), { role: 'assistant', content: aiText, _streaming: true } as any];
                    }
                    return [...prev, { role: 'assistant', content: aiText, _streaming: true } as any];
                  });
                }
                if (data.done) {
                  setDone(true);
                }
                if (data.state) {
                  setQIndex(data.state.q_index || 0);
                  setTotalQ(data.state.total_questions || 13);
                }
              } catch (e) {}
            }
          }
        }
      }

      // Finalize — remove streaming flag
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'assistant', content: aiText || '...' } : m
      ));
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.complete}>
          <Text style={styles.completeIcon}>✓</Text>
          <Text style={styles.completeTitle}>You're all set</Text>
          <Text style={styles.completeText}>Your dashboard is ready. Check the Dashboard tab.</Text>
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
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(qIndex / totalQ) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>Question {qIndex + 1} of {totalQ}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.message,
            item.role === 'user' ? styles.userMsg : styles.aiMsg,
          ]}>
            <View style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.aiBubble,
            ]}>
              <Text style={[
                styles.bubbleText,
                item.role === 'user' ? styles.userBubbleText : styles.aiBubbleText,
              ]}>{item.content}</Text>
            </View>
          </View>
        )}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={styles.messageList}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.thinkingContainer}>
          <ActivityIndicator size="small" color={COLORS.textMuted} />
          <Text style={styles.thinkingText}>Thinking...</Text>
        </View>
      )}

      {/* Input */}
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
  progressContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: 2,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  messageList: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  message: {
    marginBottom: SPACING.sm,
    flexDirection: 'row',
  },
  userMsg: { justifyContent: 'flex-end' },
  aiMsg: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: SPACING.md,
  },
  userBubble: { backgroundColor: COLORS.text },
  aiBubble: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  bubbleText: { fontSize: FONT_SIZES.md, lineHeight: 22 },
  userBubbleText: { color: COLORS.bg },
  aiBubbleText: { color: COLORS.text },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  thinkingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.3 },
  sendBtnText: {
    color: COLORS.bg,
    fontSize: 22,
    fontWeight: '700',
  },
  complete: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  completeIcon: {
    fontSize: 64,
    color: COLORS.success,
    marginBottom: SPACING.md,
  },
  completeTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  completeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
