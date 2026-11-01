/** Abrir com valores escondidos: ao abrir o app ou voltar do segundo plano, os R$ começam ocultos. */
export const hideOnOpenDefault = true;
/** Estado inicial dos valores ao abrir/voltar: com a opção ligada sempre oculto; desligada, o último estado salvo. */
export const hiddenOnOpen = (hideOnOpen: boolean | undefined, saved: boolean) => (hideOnOpen ?? hideOnOpenDefault) ? true : saved;
/** Ao voltar para o app (estado anterior background) esconde de novo. 'inactive' (central de controle, Face ID) não conta. */
export const shouldRehide = (hideOnOpen: boolean | undefined, prev: string, next: string) => (hideOnOpen ?? hideOnOpenDefault) && prev === 'background' && next === 'active';
