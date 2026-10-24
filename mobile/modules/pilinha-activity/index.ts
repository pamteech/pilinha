import { requireOptionalNativeModule } from 'expo-modules-core';
interface Native {
  isSupported(): boolean; isRunning(): boolean;
  start(mood: string, dayChangePct: number | null, totalText: string | null): Promise<void>;
  update(mood: string, dayChangePct: number | null, totalText: string | null): Promise<void>;
  stop(): Promise<void>;
}
// Opcional: no Expo Go / web o módulo não existe e tudo vira no-op.
const N = requireOptionalNativeModule<Native>('PilinhaActivity');
export const LiveActivity = {
  available: () => !!N && N.isSupported(),
  running: () => !!N && N.isRunning(),
  start: (m: string, d: number | null, t: string | null) => N?.start(m, d, t) ?? Promise.resolve(),
  update: (m: string, d: number | null, t: string | null) => (N && N.isRunning() ? N.update(m, d, t) : Promise.resolve()),
  stop: () => N?.stop() ?? Promise.resolve(),
};
