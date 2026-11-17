/** Abrir com valores escondidos: depois de um tempo fora do app, os R$ voltam ocultos. */
export const hideOnOpenDefault = true;
/** Tempo fora do app até esconder de novo. Saída rápida (trocar de app, atender ligação) mantém o último estado. */
export const HIDE_AFTER_MS = 5 * 60_000;
/** Ficou fora tempo suficiente para esconder? Sem registro (undefined), relógio voltado (negativo) ou NaN: esconde por segurança. */
const awayLongEnough = (awayMs: number | undefined) => !(typeof awayMs === 'number' && awayMs >= 0 && awayMs <= HIDE_AFTER_MS);
/** Estado inicial dos valores ao abrir: com a opção ligada, oculto se ficou fora mais que HIDE_AFTER_MS (ou sem registro); senão, o último estado salvo. */
export const hiddenOnOpen = (hideOnOpen: boolean | undefined, saved: boolean, awayMs?: number) => (hideOnOpen ?? hideOnOpenDefault) && awayLongEnough(awayMs) ? true : saved;
/** Ao voltar para o app (estado anterior background) esconde de novo só se ficou fora mais que HIDE_AFTER_MS. 'inactive' (central de controle, Face ID) não conta. */
export const shouldRehide = (hideOnOpen: boolean | undefined, prev: string, next: string, awayMs?: number) => (hideOnOpen ?? hideOnOpenDefault) && prev === 'background' && next === 'active' && awayLongEnough(awayMs);
