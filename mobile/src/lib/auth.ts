import * as LocalAuthentication from 'expo-local-authentication';
/** Face ID (ou Touch ID), com a senha do aparelho como alternativa. */
export async function faceIdAvailable(): Promise<boolean> {
  try { return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()); } catch { return false; }
}
export async function authenticate(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancelar', fallbackLabel: 'Usar senha', disableDeviceFallback: false });
    return r.success;
  } catch { return false; }
}
