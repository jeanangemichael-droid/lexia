// LEXIA — Détection de l'environnement d'exécution
// ARTIFACT : LEXIA est ouvert dans Claude (claude.ai ou application Claude) et utilise l'abonnement de l'utilisateur.
// PWA      : LEXIA est installé depuis son site (GitHub Pages, serveur du cabinet) et utilise une clé API ou un serveur.

export const ARTIFACT = typeof window !== 'undefined' && !!(window.claude && typeof window.claude.use === 'function');

const caps = {};
export function cap(name){
  if (!ARTIFACT) return Promise.resolve(null);
  return caps[name] ||= Promise.race([window.claude.use(name).catch(() => null), new Promise(r => setTimeout(() => r(null), 12000))]);
}
