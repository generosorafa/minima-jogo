export const TUTORIAL_STORAGE_KEY = "minima.tutorial.v1";

export const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({
    title: "Memorize as pontas",
    text: "Voce vera as duas cartas das pontas por 2 segundos. A carta do meio continua desconhecida.",
  }),
  Object.freeze({
    title: "Escolha a compra",
    text: "Toque no baralho para uma carta secreta ou pegue a carta visivel do morto. Do morto, a carta precisa entrar na sua mao.",
  }),
  Object.freeze({
    title: "Troque ou pare",
    text: "Toque diretamente em uma carta sua para trocar. Para encerrar a rodada, peca para parar e confirme. Empate tambem faz o pedido falhar.",
  }),
]);

export function hasSeenTutorial(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(TUTORIAL_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function markTutorialSeen(storage = globalThis.localStorage) {
  try {
    storage?.setItem(TUTORIAL_STORAGE_KEY, "seen");
    return true;
  } catch {
    return false;
  }
}
