import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity,
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

  const loadDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      let sid = await AsyncStorage.getItem('survey_session_id');
      if (!sid) {
        sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem('survey_session_id', sid);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch business profile + check-in status in parallel
      const [profileResp, checkinResp] = await Promise.all([
        fetch(`${API_BASE}/api/survey/business-profile/${sid}`, { headers }),
        fetch(`${API_BASE}/api/survey/checkin/status?session_id=${sid}`, { headers }),
      ]);

      if (!profileResp.ok) {
        setError('Complete the survey first to see your dashboard');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const profileData = await profileResp.json();
      const checkinData = checkinResp.ok ? await checkinResp.json() : null;

      if (profileData.profile) {
        const profile = typeof profileData.profile === 'string'
          ? JSON.parse(profileData.profile) : profileData.profile;
        setBusinessName(profile.business_name || 'Your Business');

        const selectedCards = (profile.cards || []).map((c: any) => {
          const meta = CARD_META[c.id] || { kicker: c.id.toUpperCase(), title: c.id, connectLabel: 'Connect' };
          return { ...c, ...meta, priority: false };
        });

        // Apply priorities from check-in
        if (checkinData?.latest_checkin?.priorities) {
          const priorities = checkinData.latest_checkin.priorities;
          selectedCards.forEach((card: DashboardCard) => {
            if (priorities.includes(card.id)) card.priority = true;
          });
          // Sort: priority cards first
          selectedCards.sort((a: DashboardCard, b: DashboardCard) => {
            if (a.priority && !b.priority) return -1;
            if (!a.priority && b.priority) return 1;
            return 0;
          });
        }

        setCards(selectedCards);
        setCheckinSummary(checkinData?.latest_checkin?.summary || null);
        setError(null);
      } else {
        setError('Complete the survey first to see your dashboard');
      }
    } catch (e) {
      setError('Connection error. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadDashboard);
    return unsub;
  }, [navigation, loadDashboard]);

  function renderCard({ item }: { item: DashboardCard }) {
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
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLogo}>D15</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{businessName}</Text>
          <Text style={styles.headerSub}>
            {cards.length} cards · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Check-in summary banner */}
      {checkinSummary ? (
        <View style={styles.summaryBanner}>
          <Text style={styles.summaryLabel}>LAST CHECK-IN</Text>
          <Text style={styles.summaryText}>{checkinSummary}</Text>
        </View>
      ) : null}

      {/* Error state */}
      {error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setLoading(true); loadDashboard(); }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No dashboard yet</Text>
          <Text style={styles.emptyText}>Complete the survey to get your personalized dashboard</Text>
          <TouchableOpacity
            style={styles.surveyBtn}
            onPress={() => navigation.navigate('Survey')}
          >
            <Text style={styles.surveyBtnText}>Start Survey</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.cardGrid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadDashboard(); }}
              tintColor={COLORS.text}
              colors={[COLORS.text]}
            />
          }
          renderItem={renderCard}
        />
      )}
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
    padding: SPACING.xl,
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
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.bg,
    backgroundColor: COLORS.text,
    width: 44,
    height: 44,
    lineHeight: 44,
    textAlign: 'center',
    borderRadius: 12,
    overflow: 'hidden',
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
  cardGrid: {
    padding: SPACING.sm,
  },
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
  cardPriority: {
    borderColor: COLORS.warning,
    borderWidth: 2,
  },
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
});
