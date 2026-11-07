// Custom entry point. The Android background job (Health Connect sync) runs
// without any screen, so its task must be defined when the JS bundle loads —
// before the router starts. The import is a no-op on web and iPhone
// (see src/health/healthConnectBackground.ts). Everything else is the standard
// expo-router entry.
import './src/health/healthConnectBackground';
import 'expo-router/entry';
