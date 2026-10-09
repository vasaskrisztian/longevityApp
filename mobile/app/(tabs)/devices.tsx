import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import {
  disconnectOura,
  getConnections,
  getOuraAuthorizationUrl,
  syncOura,
  type ConnectionSummary,
  type OuraSyncResult,
} from '@/src/api/wearables';
import { Alert } from '@/src/components/ui/Alert';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import appleHealthNative from '@/src/health/native';
import { AppleHealthRateLimitedError } from '@/src/api/appleHealth';
import { syncAppleHealth } from '@/src/health/sync';
import { colors, fontFamily, radii } from '@/src/theme/tokens';

/**
 * Real Oura connect/sync/disconnect, phase 19 — replaces the ScreenStub.
 * Mirrors the web app's profile/devices/page.tsx + sync-now-button.tsx, with
 * one structural difference: the mobile app has no server-rendered page to
 * redirect back to and no <form method="POST"> to submit, so connect and
 * disconnect go through the Bearer-JSON branch those two routes grew in
 * phase 19 (see src/api/wearables.ts) and the authorization URL is opened
 * here with expo-web-browser instead of a plain <a href>.
 *
 * Apple Health has no cloud API for us to connect — the phone itself reads
 * HealthKit (src/health/*, iOS native build only) and pushes daily summaries to
 * /api/integrations/apple-health/ingest. The card below connects/syncs it on
 * an iPhone and explains where it works on web/Android.
 */

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  DISCONNECTED: 'Not connected',
  AUTH_REQUIRED: 'Reconnect required',
  ERROR: 'Connection error',
};

const STATUS_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  CONNECTED: { backgroundColor: '#E8F5EE', color: colors.success },
  DISCONNECTED: { backgroundColor: colors.muted.default, color: colors.muted.foreground },
  AUTH_REQUIRED: { backgroundColor: '#FBF2E3', color: colors.warning },
  ERROR: { backgroundColor: '#FBEAE9', color: colors.danger },
};

const SYNC_MESSAGE: Record<OuraSyncResult, string> = {
  queued: 'Sync queued — your latest Oura data will appear here in a few minutes.',
  rate_limited: 'You already triggered a sync in the last 5 minutes. Please wait before retrying.',
  not_connected: 'Your Oura account is not connected, so there is nothing to sync.',
  error: 'Could not trigger a sync. Please try again.',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE_STYLE[status] ?? STATUS_BADGE_STYLE.DISCONNECTED;
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: style.color }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

export default function DevicesScreen() {
  const [connection, setConnection] = useState<ConnectionSummary | null>(null);
  const [appleConnection, setAppleConnection] = useState<ConnectionSummary | null>(null);
  const [appleSupported, setAppleSupported] = useState<boolean | null>(null);
  const [appleSyncing, setAppleSyncing] = useState(false);
  const [appleMessage, setAppleMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<OuraSyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const connections = await getConnections();
      setConnection(connections.find((c) => c.provider === 'OURA') ?? null);
      setAppleConnection(connections.find((c) => c.provider === 'APPLE_HEALTH') ?? null);
    } catch {
      setLoadError('Could not load your devices. Pull down to try again.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'ios') {
      setAppleSupported(false);
      return;
    }
    appleHealthNative.isSupported().then((supported) => {
      if (!cancelled) setAppleSupported(supported);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAppleSync() {
    setAppleSyncing(true);
    setAppleMessage(null);
    try {
      const outcome = await syncAppleHealth(appleConnection?.lastSyncAt);
      if (outcome.status === 'synced') {
        setAppleMessage({ ok: true, text: `Synced ${outcome.days} day${outcome.days === 1 ? '' : 's'} of Apple Health data.` });
      } else if (outcome.status === 'no_data') {
        setAppleMessage({
          ok: false,
          text: 'No Apple Health data was found. Check that Longevity Klub is allowed to read your data in Settings > Health > Data Access & Devices.',
        });
      } else {
        setAppleMessage({ ok: false, text: 'Apple Health is not available on this device.' });
      }
      await load(true);
    } catch (error) {
      setAppleMessage({
        ok: false,
        text:
          error instanceof AppleHealthRateLimitedError
            ? error.message
            : 'Could not sync Apple Health. Please try again.',
      });
    } finally {
      setAppleSyncing(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const { authorizationUrl } = await getOuraAuthorizationUrl();
      await WebBrowser.openBrowserAsync(authorizationUrl);
      // The user authorizes (or declines) in that browser, which redirects
      // to our server callback, not back into this app — there's no result
      // to await here. Refresh once they return to pick up the new status.
      await load(true);
    } catch {
      setConnectError('Could not start the Oura connection. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncOura();
      setSyncStatus(result);
      if (result === 'queued') {
        setTimeout(() => load(true), 5000);
      }
    } catch {
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await disconnectOura();
      await load(true);
    } catch {
      setDisconnectError('Could not disconnect Oura. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary.default} />
      </View>
    );
  }

  const status = connection?.status ?? 'DISCONNECTED';
  const isConnected = status === 'CONNECTED';
  const canReconnect = status === 'AUTH_REQUIRED' || status === 'ERROR';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <Text style={styles.title}>Devices</Text>

      {loadError ? <Alert variant="destructive">{loadError}</Alert> : null}

      <Card style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Oura Ring</Text>
          <StatusBadge status={status} />
        </View>
        <Text style={styles.cardDescription}>
          {isConnected
            ? 'Your Oura account is connected.'
            : canReconnect
              ? 'Your Oura connection needs attention — reconnect to resume syncing.'
              : 'Connect your Oura account to automatically synchronize sleep, recovery and activity data.'}
        </Text>

        {connection?.lastSyncAt ? (
          <Text style={styles.metaText}>
            Last sync attempt: {new Date(connection.lastSyncAt).toLocaleString()}
            {connection.lastSyncStatus ? ` (${connection.lastSyncStatus})` : ''}
          </Text>
        ) : null}

        {connectError ? <Alert variant="destructive">{connectError}</Alert> : null}
        {disconnectError ? <Alert variant="destructive">{disconnectError}</Alert> : null}
        {syncStatus ? (
          <Alert variant={syncStatus === 'queued' ? 'success' : 'destructive'}>{SYNC_MESSAGE[syncStatus]}</Alert>
        ) : null}

        <View style={styles.row}>
          {isConnected ? (
            <>
              <Button
                title={syncing ? 'Syncing…' : 'Sync now'}
                variant="outline"
                size="sm"
                onPress={handleSync}
                loading={syncing}
                style={styles.flex1}
              />
              <Button
                title={disconnecting ? 'Disconnecting…' : 'Disconnect'}
                variant="destructive"
                size="sm"
                onPress={handleDisconnect}
                loading={disconnecting}
                style={styles.flex1}
              />
            </>
          ) : (
            <Button
              title={connecting ? 'Opening Oura…' : canReconnect ? 'Reconnect Oura' : 'Connect Oura'}
              size="sm"
              onPress={handleConnect}
              loading={connecting}
              style={styles.flex1}
            />
          )}
        </View>

        {isConnected ? (
          <Text style={styles.hintText}>
            Daily sync runs automatically in the background; use Sync now to pull the latest data on
            demand (limited to once every 5 minutes).
          </Text>
        ) : null}
      </Card>

      <Card style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Apple Health</Text>
          {appleSupported === false ? (
            <View style={[styles.badge, { backgroundColor: colors.muted.default }]}>
              <Text style={[styles.badgeText, { color: colors.muted.foreground }]}>iPhone only</Text>
            </View>
          ) : (
            <StatusBadge status={appleConnection?.status ?? 'DISCONNECTED'} />
          )}
        </View>

        {appleSupported === false ? (
          <Text style={styles.cardDescription}>
            Apple Health data lives on your iPhone. Open the Longevity Klub app on your iPhone to
            connect it — steps, calories, sleep, resting heart rate and HRV are then synced here
            automatically.
          </Text>
        ) : (
          <>
            <Text style={styles.cardDescription}>
              {appleConnection?.status === 'CONNECTED'
                ? 'Your Apple Health data syncs automatically whenever you open the app.'
                : 'Share steps, calories, sleep, resting heart rate and HRV from Apple Health. Read-only — Longevity Klub never writes to Apple Health.'}
            </Text>
            {appleConnection?.lastSyncAt ? (
              <Text style={styles.metaText}>
                Last sync: {new Date(appleConnection.lastSyncAt).toLocaleString()}
              </Text>
            ) : null}
            {appleMessage ? (
              <Alert variant={appleMessage.ok ? 'success' : 'destructive'}>{appleMessage.text}</Alert>
            ) : null}
            <Button
              title={
                appleSyncing
                  ? 'Syncing…'
                  : appleConnection?.status === 'CONNECTED'
                    ? 'Sync now'
                    : 'Connect Apple Health'
              }
              variant={appleConnection?.status === 'CONNECTED' ? 'outline' : 'primary'}
              size="sm"
              onPress={handleAppleSync}
              loading={appleSyncing}
              disabled={appleSupported !== true}
            />
            {appleConnection?.status === 'CONNECTED' ? (
              <Text style={styles.hintText}>
                To stop sharing, turn off access in Settings &gt; Health &gt; Data Access &amp;
                Devices &gt; Longevity Klub.
              </Text>
            ) : null}
          </>
        )}
      </Card>

      <Text style={styles.disclaimer}>
        This platform provides wellness information and does not provide medical diagnoses or
        medical advice.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.foreground,
  },
  cardGap: {
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: fontFamily.sansSemibold,
    fontSize: 16,
    color: colors.foreground,
  },
  cardDescription: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    color: colors.muted.foreground,
  },
  metaText: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    color: colors.muted.foreground,
  },
  hintText: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
  badge: {
    borderRadius: radii.xl,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  disclaimer: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    color: colors.muted.foreground,
  },
});
