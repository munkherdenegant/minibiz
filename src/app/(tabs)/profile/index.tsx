import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Divider, ListItem, Message, Screen } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { useActiveBusiness } from '@/features/business/hooks';
import { isVipActive } from '@/features/vip/hooks';
import { useProfile } from '@/features/profile/hooks';
import { formatDate } from '@/i18n/format';
import { mn } from '@/i18n/mn';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';

export default function ProfileScreen() {
  const { session } = useAuth();
  const user = session?.user;
  const business = useActiveBusiness();
  const profile = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setLoading(true);
    setError(null);
    try {
      await signOut();
      // The root layout's guards switch to the login screen.
    } catch (e) {
      setError(getErrorMessage(e));
      setLoading(false);
    }
  }

  return (
    <Screen>
      {business ? (
        <>
          <AppText variant="label" tone="muted">
            {mn.profile.businessSection}
          </AppText>
          <Card style={styles.list}>
            <ListItem
              icon="store"
              title={business.name}
              subtitle={mn.business.types[business.business_type]}
              onPress={() => router.push('/profile/business')}
            />
            <Divider />
            <ListItem
              icon="star"
              title={mn.vip.menu}
              value={
                isVipActive(business) && business.vip_until
                  ? mn.vip.until(formatDate(business.vip_until))
                  : undefined
              }
              onPress={() => router.push('/profile/vip')}
            />
          </Card>
        </>
      ) : null}

      <AppText variant="label" tone="muted">
        {mn.profile.accountSection}
      </AppText>
      <Card style={styles.list}>
        <ListItem
          icon="profile"
          title={profile.data?.full_name || mn.profile.account}
          subtitle={user?.email}
          onPress={() => router.push('/profile/account')}
        />
        <Divider />
        <ListItem
          icon="calendar"
          title={mn.profile.memberSince}
          value={user?.created_at ? formatDate(user.created_at) : undefined}
        />
      </Card>

      <Message tone="error" text={error} />
      <Button
        title={mn.profile.logout}
        icon="logout"
        variant="danger"
        loading={loading}
        onPress={handleLogout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
});
