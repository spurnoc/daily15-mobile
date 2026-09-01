import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    const styleMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    Haptics.impactAsync(styleMap[type]);
  } catch (e) {
    // Haptics not available or failed — non-critical, log in debug
    if (__DEV__) console.warn('Haptics failed:', e);
  }
}
