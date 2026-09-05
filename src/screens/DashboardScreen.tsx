import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE, COLORS, SPACING, FONT_SIZES } from '../config';

interface DashboardCard {
  id: string;
  kicker: string;
  title: string;
  connectLabel: string;
  priority?: boolean;
}

const CARD_META: Record<string, { kicker: string; title: string; connectLabel: string }> = {
  sales: { kicker: 'SALES · POS', title: 'Today at a glance', connectLabel: 'Connect POS' },
  reviews: { kicker: 'REVIEWS · GOOGLE', title: 'Pending replies', connectLabel: 'Connect Google' },
  social: { kicker: 'SOCIAL · INSTAGRAM', title: 'Engagement', connectLabel: 'Connect Instagram' },
  catering: { kicker: 'CATERING · EMAIL', title: 'Open quotes', connectLabel: 'Connect Email' },
  inventory: { kicker: 'INVENTORY', title: 'Supply schedule', connectLabel: 'Set Up' },
  staff: { kicker: 'STAFF · LABOR', title: 'Labor costs', connectLabel: 'Add Staff' },
  staff_schedule: { kicker: 'STAFF · SCHEDULE', title: "Today's shifts", connectLabel: 'Set Up' },
  expenses: { kicker: 'EXPENSES', title: 'Monthly overview', connectLabel: 'Connect' },
  checklist: { kicker: 'TASKS · TODAY', title: 'Daily checklist', connectLabel: 'Create' },
  goals: { kicker: 'GOALS', title: 'Monthly targets', connectLabel: 'Set Goals' },
  stress: { kicker: 'WELLBEING', title: 'How are you feeling?', connectLabel: 'Check In' },
  contacts: { kicker: 'CUSTOMERS', title: 'Contact list', connectLabel: 'Import' },
  decisions: { kicker: 'DECISIONS', title: 'Decision log', connectLabel: 'Get Started' },
  appointments: { kicker: 'APPOINTMENTS', title: "Today's bookings", connectLabel: 'Connect Calendar' },
  pipeline: { kicker: 'JOBS', title: 'Job pipeline', connectLabel: 'Connect' },
  retention: { kicker: 'CLIENTS', title: 'Retention rate', connectLabel: 'Connect' },
  memberships: { kicker: 'MEMBERS', title: 'Active members', connectLabel: 'Connect' },
  routes: { kicker: 'ROUTES', title: "Today's stops", connectLabel: 'Set Up' },
  equipment: { kicker: 'EQUIPMENT', title: 'Maintenance log', connectLabel: 'Add Equipment' },
  invoices: { kicker: 'INVOICES', title: 'Outstanding', connectLabel: 'Connect' },
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [cards, setCards] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Your Business');
  const [checkinSummary, setCheckinSummary] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  function log(msg: string) {
    const ts = new Date().toLocaleTimeString();
    const entry = `[${ts}] ${msg}`;
    console.log(entry);
    setDebugLog(prev => [...prev, entry]);
  }

  const loadDashboard = useCallback(async () => {
    log('Starting dashboard load...');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      log(`Token: ${token ? token.slice(0, 15) + '...' : 'none'}`);

      let sid = await AsyncStorage.getItem('survey_session_id');
      if (!sid) {
        sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem('survey_session_id', sid);
      }
      log(`Session ID: ${sid}`);
      log(`API URL: ${API_BASE}`);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      log('Fetching business profile + checkin status...');

      const [profileResp, checkinResp] = await Promise.all([
        fetch(`${API_BASE}/api/survey/business-profile/${sid}`, { headers }).catch(e => {
          log(`Profile fetch error: ${e.message}`);
          return null;
        }),
        fetch(`${API_BASE}/api/survey/checkin/status?session_id=${sid}`, { headers }).catch(e => {
          log(`Checkin fetch error: ${e.message}`);
          return null;
        }),
      ]);

      log(`Profile response: ${profileResp ? profileResp.status : 'failed'}`);
      log(`Checkin response: ${checkinResp ? checkinResp.status : 'failed'}`);

      if (!profileResp || !profileResp.ok) {
        const status = profileResp?.status || 'no response';
        log(`Profile not OK: ${status}`);
        if (status === 404 || status === 'no response') {
          setError('Complete the survey first to see your dashboard');
        } else {
          setError(`Could not load dashboard (HTTP ${status})`);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const profileData = await profileResp.json();
      log(`Profile data keys: ${Object.keys(profileData)}`);
      log(`Has profile: ${!!profileData.profile}`);

      const checkinData = checkinResp?.ok ? await checkinResp.json() : null;
      if (checkinData) log(`Checkin data: ${JSON.stringify(Object.keys(checkinData))}`);

      if (profileData.profile) {
        const profile = typeof profileData.profile === 'string'
          ? JSON.parse(profileData.profile) : profileData.profile;
        log(`Profile parsed: business_name=${profile.business_name}, cards=${profile.cards?.length || 0}`);

        setBusinessName(profile.business_name || 'Your Business');

        const selectedCards = (profile.cards || []).map((c: any) => {
          const meta = CARD_META[c.id] || { kicker: c.id.toUpperCase(), title: c.id, connectLabel: 'Connect' };
          return { ...c, ...meta, priority: false };
        });

        if (checkinData?.latest_checkin?.priorities) {
          const priorities = checkinData.latest_checkin.priorities;
          selectedCards.forEach((card: DashboardCard) => {
            if (priorities.includes(card.id)) card.priority = true;
          });
          selectedCards.sort((a: DashboardCard, b: DashboardCard) => {
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return 0;
          });
        }

        setCards(selectedCards);
        setCheckinSummary(checkinData?.latest_checkin?.summary || null);
        setError(null);
        log(`Dashboard loaded: ${selectedCards.length} cards`);
      } else {
        log('No profile in response — survey not complete');
        setError('Complete the survey first to see your dashboard');
      }
    } catch (e: any) {
      log(`EXCEPTION: ${e.message}`);
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
      log('Dashboard load complete');
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadDashboard);
    return unsub;
  }, [navigation, loadDashboard]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
        <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={styles.debugToggle}>
          <Text style={styles.debugToggleText}>Show debug log</Text>
        </TouchableOpacity>
        {showDebug ? (
          <ScrollView style={styles.debugContainer}>
            {debugLog.map((line, i) => (
              <Text key={i} style={styles.debugText}>{line}</Text>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); setError(null); setDebugLog([]); loadDashboard(); }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={styles.debugToggle}>
          <Text style={styles.debugToggleText}>Show debug log</Text>
        </TouchableOpacity>
        {showDebug ? (
          <ScrollView style={styles.debugContainer}>
            {debugLog.map((line, i) => (
              <Text key={i} style={styles.debugText}>{line}</Text>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No dashboard yet</Text>
        <Text style={styles.emptyText}>Complete the survey to get your personalized dashboard</Text>
        <TouchableOpacity
          style={styles.surveyBtn}
          onPress={() => navigation.navigate('Survey')}
        >
          <Text style={styles.surveyBtnText}>Start Survey</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={styles.debugToggle}>
          <Text style={styles.debugToggleText}>Show debug log</Text>
        </TouchableOpacity>
        {showDebug ? (
          <ScrollView style={styles.debugContainer}>
            {debugLog.map((line, i) => (
              <Text key={i} style={styles.debugText}>{line}</Text>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
        <Image source={require('../../assets/spur-brandmark-white.png')} style={styles.headerLogo} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{businessName}</Text>
          <Text style={styles.headerSub}>
            {cards.length} cards · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {checkinSummary ? (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryLabel}>LAST CHECK-IN</Text>
          <Text style={styles.summaryText}>{checkinSummary}</Text>
        </View>
      ) : null}

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.cardGrid}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); setDebugLog([]); loadDashboard(); }}
            tintColor={COLORS.text}
            colors={[COLORS.text]}
          />
        }
        renderItem={({ item }) => {
          const meta = CARD_META[item.id] || CARD_META['goals'];
          return (
            <TouchableOpacity
              style={[styles.card, item.priority && styles.cardPriority]}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardKicker}>{meta.kicker}</Text>
                {item.priority ? <View style={styles.priorityBadge}><Text style={styles.priorityBadgeText}>TOP</Text></View> : null}
              </View>
              <Text style={styles.cardTitle}>{meta.title}</Text>
              <View style={styles.cardBody}>
                <View style={styles.connectIcon}>
                  <Text style={styles.connectIconText}>+</Text>
                </View>
                <Text style={styles.connectText}>{meta.connectLabel}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.md,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  summaryBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  cardGrid: { padding: SPACING.sm },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    margin: SPACING.xs,
    minHeight: 150,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPriority: { borderColor: COLORS.warning, borderWidth: 2 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardKicker: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priorityBadge: {
    backgroundColor: COLORS.warning,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.bg,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  connectIconText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  connectText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.md,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  surveyBtn: {
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 2,
  },
  surveyBtnText: {
    color: COLORS.bg,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  debugToggle: {
    marginTop: SPACING.lg,
    padding: SPACING.sm,
  },
  debugToggleText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textDecorationLine: 'underline',
  },
  debugContainer: {
    marginTop: SPACING.sm,
    maxHeight: 300,
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  debugText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
