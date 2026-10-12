import { Redirect } from 'expo-router';

/** Goals now live under their protocol (Plan > Protocols); old links land there. */
export default function GoalsRedirect() {
  return <Redirect href="/plan/protocols" />;
}
