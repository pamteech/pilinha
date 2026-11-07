import { ExtensionStorage } from '@bacons/apple-targets';
import { LiveActivity } from '../../modules/pilinha-activity';
import { Mood, Snapshot, baseMood, brl, dayChange, dayChangePct, moodFrom, total, widgetSummary } from '../core';
const GROUP = 'group.com.pamtech.pilinha';
let storage: ExtensionStorage | null = null;
try { storage = new ExtensionStorage(GROUP); } catch { storage = null; }
/** Grava o resumo no App Group e pede para o widget/Live Activity redesenhar. */
export async function syncExtensions(s: Snapshot, hidden: boolean, moodNow?: Mood) {
  const d = dayChangePct(s), mood = baseMood(moodNow ?? moodFrom(d, false, s.errors.length > 0)), t = total(s);
  try {
    storage?.set('pilinha.widget', JSON.stringify(widgetSummary(t, dayChange(s), d, mood, hidden)));
    ExtensionStorage.reloadWidget('PilinhaWidget');
  } catch { /* sem módulo nativo (Expo Go) */ }
  try { await LiveActivity.update(mood, d, hidden ? null : brl(t)); } catch { /* ignora */ }
}
export async function startLiveActivity(s: Snapshot, hidden: boolean) {
  const d = dayChangePct(s); await LiveActivity.start(baseMood(moodFrom(d, false, s.errors.length > 0)), d, hidden ? null : brl(total(s)));
}
export const stopLiveActivity = () => LiveActivity.stop();
export const liveActivityAvailable = () => { try { return LiveActivity.available(); } catch { return false; } };
export const liveActivityRunning = () => { try { return LiveActivity.running(); } catch { return false; } };
