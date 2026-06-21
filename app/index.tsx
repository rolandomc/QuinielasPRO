import { Redirect } from 'expo-router';

export default function Index() {
  // TODO: cuando haya auth, redirigir según sesión activa:
  // - Si hay sesión activa → '/(tabs)/quiniela'
  // - Si no hay sesión → '/registro'
  return <Redirect href="/registro" />;
}
