import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, COLORS, SPACING, FONT_SIZES } from '../config';

interface Card {
  id: string;
  kicker: string;
  title: string;
  priority?: boolean;
}

export default function DashboardScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('Your Business');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      let sid = await AsyncStorage.getItem('survey_session_id');
      if (!sid) {
        sid = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        await AsyncStorage.setItem('survey_session_id', sid);
      }

      const resp = await fetch(`${API_BASE}/api/survey/business-profile/${sid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!resp.ok) {
        setError('Could not load dashboard');
        setLoading(false);
        return;
      }

      const data = await resp.json();
      if (data.profile) {
        const profile = typeof data.profile === 'string' ? JSON.parse(data.profile) : data.profile;
        setBusinessName(profile.business_name || 'Your Business');
        const selectedCards = (profile.cards || []).map((c: any) => ({
          id: c.id,
          kicker: getCardKicker(c.id),
          title: getCardTitle(c.id),
          priority: false,
        }));
        setCards(selectedCards);
      } else {
        setError('Complete the survey first to see your dashboard');
      }
    } catch (e) {
      setError('Connection error. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getCardKicker(id: string): string {
    const kickers: Record<string, string> = {
      sales: 'Sales · POS',
      reviews: 'Reviews · Google',
      social: 'Social · Instagram',
      catering: 'Catering · Email',
      inventory: 'Inventory · Supplies',
      staff: 'Staff · Labor',
      staff_schedule: 'Staff · Schedule',
      expenses: 'Expenses · Monthly',
      checklist: 'Tasks · Today',
      goals: 'Goals · Monthly',
      stress: 'Wellbeing',
      contacts: 'Customers · CRM',
      decisions: 'Decisions · Log',
      appointments: 'Appointments · Calendar',
      pipeline: 'Jobs · Pipeline',
      retention: 'Clients · Retention',
      memberships: 'Members · MRR',
      routes: 'Routes · Today',
      equipment: 'Equipment · Status',
      invoices: 'Invoices · Outstanding',
    };
    return kickers[id] || id;
  }

  function getCardTitle(id: string): string {
    const titles: Record<string, string> = {
      sales: 'Connect your POS',
      reviews: 'Connect Google Reviews',
      social: 'Connect Instagram',
      catering: 'Connect your email',
      inventory: 'Set up delivery schedule',
      staff: 'Add your staff',
      staff_schedule: 'Set up scheduling',
      expenses: 'Connect your expenses',
      checklist: 'Create your checklist',
      goals: 'Set your goals',
      stress: 'How are you feeling?',
      contacts: 'Import contacts',
      decisions: 'Log your first decision',
      appointments: 'Connect your calendar',
      pipeline: 'Connect your job tracker',
      retention: 'Connect customer data',
      memberships: 'Connect membership system',
      routes: 'Set up your routes',
      equipment: 'Log your equipment',
      invoices: 'Connect your invoicing',
    };
    return titles[id] || 'Connect data source';
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.text} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No dashboard yet</Text>
        <Text style={styles.emptyText}>Complete the survey to get your personalized dashboard</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Daily 15</Text>
        <Text style={styles.headerSub}>{businessName}</Text>
      </View>

      {/* Cards */}
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
          />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.priority && styles.cardPriority]}>
            <Text style={styles.cardKicker}>{item.kicker}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <View style={styles.cardEmpty}>
              <View style={styles.cardEmptyIcon}>
                <Text style={styles.cardEmptyIconText}>+</Text>
              </View>
              <Text style={styles.cardEmptyText}>Connect</Text>
            </View>
          </View>
        )}
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
    padding: SPACING.xl,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cardGrid: {
    padding: SPACING.sm,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    margin: SPACING.xs,
    minHeight: 140,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPriority: {
    borderColor: COLORS.warning,
    borderWidth: 2,
  },
  cardKicker: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cardEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardEmptyIconText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  cardEmptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
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
  },
});
