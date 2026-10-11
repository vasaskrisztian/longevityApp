import { Redirect } from 'expo-router';

/** Old /devices bookmark → Me > Devices and data. */
export default function LegacyDevices() {
  return <Redirect href="/me/devices" />;
}
