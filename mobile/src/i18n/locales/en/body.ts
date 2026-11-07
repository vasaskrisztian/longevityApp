/** Body (InBody), Me > Devices and data, and Apple Health sync texts. */
export const body = {
  // InBody — measurement fields
  'body.field.weightKg': 'Weight',
  'body.field.bodyFatPercentage': 'Body Fat',
  'body.field.skeletalMuscleMassKg': 'Skeletal Muscle Mass',
  'body.field.fatFreeMassKg': 'Fat-Free Mass',
  'body.field.bmi': 'BMI',
  'body.field.inBodyScore': 'InBody Score',
  'body.field.visceralFatLevel': 'Visceral Fat Level',
  'body.field.basalMetabolicRateKcal': 'BMR',
  'body.field.totalBodyWaterL': 'Total Body Water',
  'body.field.ecwRatio': 'ECW Ratio',

  // InBody — screen
  'body.loadFailed': 'Could not load your InBody scans.',
  'body.currentValues': 'Current values',
  'body.fromScan': 'From the scan on {date}.',
  'body.noScansUploaded': 'No scans uploaded yet.',
  'body.notRecorded': 'Not recorded',
  'body.trends': 'Trends',
  'body.trend.weight': 'Weight',
  'body.trend.bodyFat': 'Body Fat %',
  'body.trend.skeletalMuscle': 'Skeletal Muscle Mass',
  'body.trend.score': 'InBody Score',
  'body.notEnoughData': 'Not enough data yet.',
  'body.history': 'History',
  'body.noScans': 'No scans yet.',

  'body.upload.title': 'Upload a scan',
  'body.upload.description':
    'A photo of a printed InBody report. Text and values are read automatically and saved right away — anything that couldn’t be read reliably is left blank for you to fill in.',
  'body.upload.takePhoto': 'Take photo',
  'body.upload.chooseLibrary': 'Choose from library',
  'body.upload.reading': 'Reading the report… this usually takes 15-20 seconds, but can take up to a minute.',
  'body.upload.successAll': 'Scan uploaded — all fields were read successfully.',
  'body.upload.successPartial':
    'Scan uploaded. Could not reliably read: {fields}. Use Edit on the new entry to fill those in.',
  'body.upload.timeout':
    'This is taking far longer than expected and was stopped. Please try again — if it keeps happening, try a smaller or clearer photo.',
  'body.upload.failed': 'Could not process that image. Please try a clearer photo of the report.',
  'body.upload.cameraNeeded': 'Camera access is needed to take a photo of the report.',
  'body.upload.libraryNeeded': 'Photo library access is needed to choose a photo of the report.',

  'body.row.notRecorded': 'Not recorded: {fields}',
  'body.row.showRawText': 'Show raw scanned text (to fill in the missing fields by hand)',
  'body.row.hideRawText': 'Hide raw scanned text',
  'body.row.photoLoadFailed': 'Could not load the photo.',
  'body.row.photoAlt': 'InBody scan photo',
  'body.row.viewPhoto': 'View photo',
  'body.row.hidePhoto': 'Hide photo',
  'body.row.deleting': 'Deleting…',

  'body.edit.measuredAt': 'Measured at (yyyy-mm-ddThh:mm)',
  'body.edit.saveFailed': 'Could not save. Please check the values and try again.',

  'body.delete.title': 'Delete this InBody measurement?',
  'body.delete.message': 'The measurement and its photo will be permanently deleted. This cannot be undone.',

  // Me > Devices and data
  'devices.loadFailed': 'Could not load your devices. Pull down to try again.',
  'devices.status.connected': 'Connected',
  'devices.status.disconnected': 'Not connected',
  'devices.status.authRequired': 'Reconnect required',
  'devices.status.error': 'Connection error',
  'devices.syncNow': 'Sync now',
  'devices.syncing': 'Syncing…',
  'devices.disclaimer':
    'This platform provides wellness information and does not provide medical diagnoses or medical advice.',

  'devices.oura.connected': 'Your Oura account is connected.',
  'devices.oura.needsAttention': 'Your Oura connection needs attention — reconnect to resume syncing.',
  'devices.oura.connectPrompt':
    'Connect your Oura account to automatically synchronize sleep, recovery and activity data.',
  'devices.oura.lastSyncAttempt': 'Last sync attempt: {date}',
  'devices.oura.lastSyncAttemptWithStatus': 'Last sync attempt: {date} ({status})',
  'devices.oura.disconnect': 'Disconnect',
  'devices.oura.disconnecting': 'Disconnecting…',
  'devices.oura.opening': 'Opening Oura…',
  'devices.oura.reconnect': 'Reconnect Oura',
  'devices.oura.connect': 'Connect Oura',
  'devices.oura.dailySyncHint':
    'Daily sync runs automatically in the background; use Sync now to pull the latest data on demand (limited to once every 5 minutes).',
  'devices.oura.connectFailed': 'Could not start the Oura connection. Please try again.',
  'devices.oura.disconnectFailed': 'Could not disconnect Oura. Please try again.',
  'devices.oura.sync.queued': 'Sync queued — your latest Oura data will appear here in a few minutes.',
  'devices.oura.sync.rateLimited': 'You already triggered a sync in the last 5 minutes. Please wait before retrying.',
  'devices.oura.sync.notConnected': 'Your Oura account is not connected, so there is nothing to sync.',
  'devices.oura.sync.error': 'Could not trigger a sync. Please try again.',

  'devices.apple.iphoneOnly': 'iPhone only',
  'devices.apple.notOnThisDevice':
    'Apple Health data lives on your iPhone. Open the Longevity Klub app on your iPhone to connect it — steps, calories, sleep, resting heart rate and HRV are then synced here automatically.',
  'devices.apple.connectedDescription': 'Your Apple Health data syncs automatically whenever you open the app.',
  'devices.apple.connectDescription':
    'Share steps, calories, sleep, resting heart rate and HRV from Apple Health. Read-only — Longevity Klub never writes to Apple Health.',
  'devices.apple.lastSync': 'Last sync: {date}',
  'devices.apple.connect': 'Connect Apple Health',
  'devices.apple.stopHint':
    'To stop sharing, turn off access in Settings > Health > Data Access & Devices > Longevity Klub.',

  // Apple Health sync outcomes
  'health.apple.synced_one': 'Synced {count} day of Apple Health data.',
  'health.apple.synced_other': 'Synced {count} days of Apple Health data.',
  'health.apple.noData':
    'No Apple Health data was found. Check that Longevity Klub is allowed to read your data in Settings > Health > Data Access & Devices.',
  'health.apple.unavailable': 'Apple Health is not available on this device.',
  'health.apple.syncFailed': 'Could not sync Apple Health. Please try again.',
  'health.apple.rateLimited': 'Too many Apple Health sync requests. Please try again in a minute.',

  // Health Connect (Android)
  'devices.hc.androidOnly': 'Android only',
  'devices.hc.notOnThisDevice':
    'Health Connect data lives on your Android phone. Open the Longevity Klub app on your Android phone to connect it — steps, calories, sleep, resting heart rate and HRV (for example from a Samsung watch via Samsung Health) are then synced here automatically.',
  'devices.hc.connectedElsewhere':
    'Connected from your Android phone. Your data syncs from there, and the latest days show up on the dashboard.',
  'devices.hc.connectedDescription':
    'Your Health Connect data syncs automatically whenever you open the app, and in the background if you allowed it.',
  'devices.hc.connectDescription':
    'Share steps, calories, sleep, resting heart rate and HRV from Health Connect. Read-only — Longevity Klub never writes to Health Connect. Using a Samsung watch? Let the Samsung Health app share its data with Health Connect.',
  'devices.hc.connectedAt': 'Connected: {date}',
  'devices.hc.lastSync': 'Last sync: {date}',
  'devices.hc.neverSynced': 'No data synced yet.',
  'devices.hc.connect': 'Connect Health Connect',
  'devices.hc.manage': 'Manage access in Health Connect',
  'devices.hc.unavailable':
    'Health Connect is not available on this phone. On Android 13 or older, install the "Health Connect" app from Google Play first.',
  'devices.hc.updateRequired':
    'Health Connect needs an update. Update the "Health Connect" app in Google Play, then try again.',
  'devices.hc.backgroundOn': 'Background sync is on: your data is also uploaded from time to time while the app is closed.',
  'devices.hc.backgroundOff':
    'Background sync is off, so data syncs when you open the app. To turn it on, allow Longevity Klub to read in the background in Health Connect.',
  'devices.hc.stopHint': 'To stop sharing, remove Longevity Klub\'s access in Health Connect (button above).',

  // Health Connect sync outcomes
  'health.hc.synced_one': 'Synced {count} day of Health Connect data.',
  'health.hc.synced_other': 'Synced {count} days of Health Connect data.',
  'health.hc.noData':
    'No Health Connect data was found. Make sure your watch or app (for example Samsung Health) writes to Health Connect and that Longevity Klub is allowed to read it.',
  'health.hc.noPermission': 'Longevity Klub is not allowed to read Health Connect yet. Tap Connect and allow access.',
  'health.hc.unavailable': 'Health Connect is not available on this device.',
  'health.hc.syncFailed': 'Could not sync Health Connect. Please try again.',
  'health.hc.rateLimited': 'Too many Health Connect sync requests. Please try again in a minute.',
} as const;
