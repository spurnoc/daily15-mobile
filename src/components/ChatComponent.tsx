import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, LayoutAnimation, Platform as RNPlatform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../config';
import { haptic } from '../App';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  _streaming?: boolean;
}

interface ChatComponentProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onSend: (answer: string) => Promise<void>;
  loading: boolean;
  placeholder?: string;
  title?: string;
  subtitle?: string;
  progress?: { current: number; total: number } | null;
  choices?: string[] | null;
  onChoiceSelect?: (choice: string) => void;
  done?: boolean;
  doneTitle?: string;
  doneText?: string;
  doneAction?: { label: string; onPress: () => void } | null;
}

export default function ChatComponent({
  messages,
  setMessages,
  onSend,
  loading,
  placeholder = 'Type your answer...',
  title,
  subtitle,
  progress = null,
  choices = null,
  onChoiceSelect,
  done = false,
  doneTitle = 'Done',
  doneText = '',
  doneAction = null,
}: ChatComponentProps) {
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const answer = input.trim();
    setInput('');
    Keyboard.dismiss();
    haptic('light');
    onSend(answer);
  };

  if (done) {
    return (
      <View style={styles.doneContainer}>
        <View style={styles.doneIcon}>
          <Text style={styles.doneIconText}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>{doneTitle}</Text>
        {doneText ? <Text style={styles.doneText}>{doneText}</Text> : null}
        {doneAction ? (
          <TouchableOpacity style={styles.doneButton} onPress={doneAction.onPress}>
            <Text style={styles.doneButtonText}>{doneAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      {title ? (
        <View style={styles.header}>
          {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      ) : null}

      {/* Progress bar */}
      {progress ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${Math.min((progress.current / progress.total) * 100, 100)}%`
            }]} />
          </View>
          <Text style={styles.progressText}>
            Question {progress.current + 1} of {progress.total}
          </Text>
        </View>
      ) : null}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.messageRow,
            item.role === 'user' ? styles.userRow : styles.aiRow,
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
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: keyboardHeight + SPACING.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* Typing indicator */}
      {loading ? (
        <View style={styles.typingRow}>
          <View style={styles.typingBubble}>
            <View style={styles.typingDot} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      ) : null}

      {/* Choice buttons */}
      {choices && choices.length > 0 && !loading ? (
        <View style={styles.choicesContainer}>
          {choices.map((choice, i) => (
            <TouchableOpacity
              key={i}
              style={styles.choiceBtn}
              onPress={() => { haptic('light'); onChoiceSelect?.(choice); }}
            >
              <View style={styles.choiceDot} />
              <Text style={styles.choiceText}>{choice}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Input bar */}
      {!loading && !choices ? (
        <KeyboardAvoidingView
          behavior={RNPlatform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={placeholder}
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxHeight={100}
              autoCorrect
              autoCapitalize="sentences"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim()}
            >
              <Text style={styles.sendBtnIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  progressContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  progressTrack: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: 1.5,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
    textAlign: 'center',
  },
  messageList: {
    padding: SPACING.md,
  },
  messageRow: {
    marginBottom: SPACING.sm,
    flexDirection: 'row',
  },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    padding: SPACING.md,
    paddingHorizontal: SPACING.md + 2,
  },
  userBubble: {
    backgroundColor: COLORS.text,
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  userBubbleText: { color: COLORS.bg },
  aiBubbleText: { color: COLORS.text },
  typingRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
  typingDot2: { opacity: 0.4 },
  typingDot3: { opacity: 0.2 },
  choicesContainer: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  choiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
  },
  choiceText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    flex: 1,
  },
  inputBar: {
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
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.sm + 2,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    maxHeight: 100,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.25 },
  sendBtnIcon: {
    color: COLORS.bg,
    fontSize: 24,
    fontWeight: '700',
  },
  doneContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  doneIconText: {
    color: COLORS.bg,
    fontSize: 36,
    fontWeight: '900',
  },
  doneTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  doneText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  doneButton: {
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  doneButtonText: {
    color: COLORS.bg,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
});
