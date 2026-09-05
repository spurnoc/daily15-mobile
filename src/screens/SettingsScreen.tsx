import React, { useState, useContext, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Switch, ActivityIndicator, Linking, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { API_BASE, COLORS, SPACING, FONT_SIZES } from '../config';

export default function SettingsScreen() {
  const { email, logout } = useContext(AuthContext);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [reminderEmail, setReminderEmail] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const resp = await fetch(`${API_BASE}/api/reminder/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (resp.ok) {
        const data = await resp.json();
        setRemindersEnabled(data.enabled ?? false);
        setReminderTime(data.reminder_time || '08:00');
        setReminderEmail(data.email || email || '');
      }
    } catch (e) {}
    setLoadingSettings(false);
  }

  async function saveSettings(enabled: boolean, time?: string, emailAddr?: string) {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      await fetch(`${API_BASE}/api/reminder/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          enabled,
          time: time || reminderTime,
          email: emailAddr || reminderEmail,
        }),
      });
    } catch (e) {}
    setSaving(false);
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  async function exportData(type: 'survey' | 'checkins' | 'all') {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const sid = await AsyncStorage.getItem('survey_session_id');
      const url = `${API_BASE}/api/export/${type}?session_id=${sid}`;
      Linking.openURL(url);
    } catch (e) {
      Alert.alert('Export failed', 'Could not export data. Try again.');
    }
  }

  if (loadingSettings) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={COLORS.text} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue} numberOfLines={1}>{email || 'Not set'}</Text>
        </View>
      </View>

      {/* Reminders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DAILY REMINDERS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable check-in reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={(val) => {
              setRemindersEnabled(val);
              saveSettings(val);
            }}
            trackColor={{ false: COLORS.border, true: COLORS.text }}
          />
        </View>
        {remindersEnabled ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reminder time</Text>
              <Text style={styles.rowValue}>{reminderTime}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Send to</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{reminderEmail || 'Not set'}</Text>
            </View>
            <Text style={styles.hint}>
              You'll get an email at {reminderTime} each day with a link to check in.
            </Text>
          </>
        ) : null}
        {saving ? <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginTop: 8 }} /> : null}
      </View>

      {/* Data Export */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>YOUR DATA</Text>
        <Text style={styles.hint}>Export your data as CSV or JSON.</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportData('survey')}>
            <Text style={styles.exportBtnText}>Survey (CSV)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportData('checkins')}>
            <Text style={styles.exportBtnText}>Check-ins (CSV)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportData('all')}>
            <Text style={styles.exportBtnText}>Everything (JSON)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Built by</Text>
          <Text style={styles.rowValue}>SPUR</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.footerRow}>
        <Image source={require('../../assets/spur-brandmark-transparent.png')} style={styles.footerLogo} />
        <Text style={styles.footer}>Daily 15 · Built by SPUR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  section: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.5, marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: SPACING.sm,
  },
  rowLabel: { fontSize: FONT_SIZES.md, color: COLORS.text },
  rowValue: { fontSize: FONT_SIZES.md, color: COLORS.textMuted, maxWidth: '55%' },
  hint: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  exportRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  exportBtn: {
    backgroundColor: COLORS.accentDark, borderRadius: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  exportBtnText: { color: COLORS.text, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  logoutButton: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: SPACING.md,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger,
    marginBottom: SPACING.lg,
  },
  logoutText: { color: COLORS.danger, fontSize: FONT_SIZES.md, fontWeight: '600' },
  footer: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, textAlign: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  footerLogo: { width: 16, height: 16 },
});
