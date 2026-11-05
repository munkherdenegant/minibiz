import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { colors, radius, spacing, touchTarget } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, { background: string; text: string; border?: string }> = {
  primary: { background: colors.primary, text: colors.white },
  secondary: { background: colors.primarySoft, text: colors.primary },
  danger: { background: colors.background, text: colors.error, border: colors.border },
  ghost: { background: 'transparent', text: colors.primary },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = variants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.background, borderColor: v.border ?? v.background },
        (pressed || inactive) && styles.dimmed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={20} color={v.text} />}
          <AppText
            variant="subheading"
            numberOfLines={2}
            style={[styles.title, { color: v.text }]}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  // Large system font sizes wrap long labels instead of clipping them.
  title: { flexShrink: 1, textAlign: 'center' },
  dimmed: { opacity: 0.6 },
});
