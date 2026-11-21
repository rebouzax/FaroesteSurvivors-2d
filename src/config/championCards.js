import { abilityStats } from './abilityConfig.js';

const closeRange = { nearRange: 6, nearDamage: 1.25 };
const planted = { plantedDamage: 1.2 };
const critical = { useCritical: true };

export const CHAMPION_CARD_STYLES = {
  joao: {
    description: 'Controle a horda com o chicote. Ferraduras e Réquiem cobrem uma área maior.',
    echoInterval: .11, echoColor: 0x9dece1,
    cards: {
      horseshoe: { scale: { radius: 1.18 }, note: 'João aumenta o alcance das ferraduras em 18%.' },
      requiem: { scale: { radius: 1.18, push: 1.25 }, note: 'João aumenta a área em 18% e o empurrão em 25%.' },
    },
  },
  maria: {
    description: 'A precisão do revólver também dá chance de crítico aos disparos das cartas.',
    echoInterval: .10, echoColor: 0xf4bd70,
    cards: {
      pistol: critical, ghostShot: critical, silverRain: critical, boneStorm: critical,
    },
  },
  indigo: {
    description: 'Abra caminho pela horda. A Bala Fantasma perfura mais um alvo e as lâminas retornantes alcançam mais longe.',
    echoInterval: .105, echoColor: 0xa3dd85,
    cards: {
      ghostShot: { add: { pierce: 1 }, note: 'Indigo perfura mais um inimigo.' },
      returningBlade: { scale: { range: 1.2 }, note: 'Indigo arremessa a lâmina 20% mais longe.' },
      lunarReturn: { scale: { range: 1.2 }, note: 'Indigo arremessa a lâmina 20% mais longe.' },
    },
  },
  labuta: {
    description: 'Aguente o combate próximo. Coração de Vaqueiro concede mais vida e as cartas defensivas concedem mais armadura.',
    echoInterval: .13, echoColor: 0xf0a970,
    cards: {
      heart: { add: { health: 5 }, note: 'Labuta recebe mais 5 de vida máxima e cura por nível.' },
      ironWill: { perLevel: { armor: 1 }, note: 'Labuta recebe mais 1 de armadura por nível.' },
      bulwark: { perLevel: { armor: 1 }, note: 'Labuta recebe mais 1 de armadura por nível.' },
    },
  },
  rosa: {
    description: 'Mantenha a pressão em movimento. A Pistola, a Chuva de Prata e os Estilhaços recarregam mais rápido.',
    echoInterval: .07, echoColor: 0xff9498,
    cards: {
      pistol: { scale: { cooldown: .8 }, note: 'Rosa reduz o intervalo da pistola em 20%.' },
      silverRain: { scale: { cooldown: .83 }, note: 'Rosa reduz o intervalo da rajada em 17%.' },
      boneStorm: { scale: { cooldown: .83 }, note: 'Rosa reduz o intervalo dos estilhaços em 17%.' },
    },
  },
  elias: {
    description: 'Ataque de longe com o rifle. A Pistola e a Bala Fantasma miram e atingem inimigos mais distantes.',
    echoInterval: .14, echoColor: 0xe2cb9b,
    cards: {
      pistol: { scale: { range: 1.3 }, flightScale: 1.3, note: 'Elias mira e dispara 30% mais longe.' },
      ghostShot: { scale: { range: 1.3 }, flightScale: 1.3, note: 'Elias mira e dispara 30% mais longe.' },
    },
  },
  ada: {
    description: 'Escolha a hora de firmar os pés. A Pistola e a Bala Fantasma causam mais dano quando Ada dispara parada.',
    echoInterval: .12, echoColor: 0x9ecafa,
    cards: { pistol: planted, ghostShot: planted },
  },
  ruth: {
    description: 'Lute de perto com a escopeta serrada. Tiros e estilhaços das cartas acertam mais forte nos primeiros 6 m.',
    echoInterval: .085, echoColor: 0xffa36c,
    cards: {
      pistol: closeRange, ghostShot: closeRange, silverRain: closeRange, boneStorm: closeRange,
    },
  },
  dynamite: {
    description: 'Use os arremessos para bloquear rotas. O Molotov e a Bomba de Dinamite de Neco cobrem uma área maior.',
    echoInterval: .155, echoColor: 0xc7ed75,
    cards: {
      molotov: { scale: { radius: 1.25 }, note: 'O fogo do Molotov tem 25% mais alcance com Neco.' },
      inferno: { scale: { radius: 1.25 }, note: 'Neco amplia em 25% a área das chamas no chão.' },
      pirateBomb: { blastScale: 1.25, note: 'A explosão da carta tem 25% mais alcance com Neco.' },
    },
  },
};

export function championAbilityStats(characterId, id, level) {
  const stats = abilityStats(id, level);
  const modifiers = CHAMPION_CARD_STYLES[characterId]?.cards[id];
  if (!modifiers) return stats;
  const { scale, add, perLevel, note, ...combat } = modifiers;
  for (const key in scale) stats[key] *= scale[key];
  for (const key in add) stats[key] += add[key];
  for (const key in perLevel) stats[key] += perLevel[key] * level;
  return Object.assign(stats, combat);
}

export function championCardNote(characterId, id) {
  const style = CHAMPION_CARD_STYLES[characterId];
  const card = style?.cards[id === 'silverStorm' ? 'silverRain' : id];
  if (id === 'doubleShot' && style) {
    const gap = style.echoInterval.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    return `Intervalo entre ataques extras deste campeão: ${gap} s.`;
  }
  if (card === critical) return 'Maria pode acertar críticos com esta carta.';
  if (card === planted) return 'Ada causa 20% a mais de dano ao disparar parada.';
  if (card === closeRange) return 'Ruth causa 25% a mais de dano nos primeiros 6 m.';
  return card?.note ?? '';
}
