export const PLAYABLE_STAGES = Object.freeze(['desert', 'mine']);

export const STAGE_PRESENTATION = {
  desert: {
    number: '01',
    description: 'Cruze as trilhas do deserto e sobreviva às criaturas que despertam com a noite.',
  },
  mine: {
    number: '02',
    description: 'Siga os trilhos pelas galerias abandonadas e enfrente o que se esconde entre os veios de carvão.',
  },
};

export const ENEMY_WAVES = {
  desert: [
    { at: 0, population: 28, weights: { bat: 10 } },
    { at: 60, population: 44, weights: { bat: 8, dog: 3 } },
    { at: 120, population: 58, weights: { bat: 7, dog: 4 } },
    { at: 180, population: 72, weights: { bat: 6, dog: 4, skeleton: 3 } },
    { at: 300, population: 90, weights: { bat: 5, dog: 5, skeleton: 4 } },
    { at: 480, population: 112, weights: { bat: 4, dog: 6, skeleton: 5 } },
    { at: 660, population: 136, weights: { bat: 4, dog: 6, skeleton: 7 } },
  ],
  mine: [
    { at: 0, population: 30, weights: { miner: 10 } },
    { at: 45, population: 48, weights: { miner: 7, mineSpider: 7 } },
    { at: 125, population: 62, weights: { miner: 6, mineSpider: 7, blindCrawler: 4 } },
    { at: 200, population: 78, weights: { miner: 6, mineSpider: 7, blindCrawler: 4, mineSkull: 4 } },
    { at: 360, population: 98, weights: { miner: 5, mineSpider: 6, blindCrawler: 5, mineSkull: 5 } },
    { at: 555, population: 118, weights: { miner: 7, mineSpider: 6, blindCrawler: 6, mineSkull: 6 } },
    { at: 720, population: 144, weights: { miner: 7, mineSpider: 6, blindCrawler: 7, mineSkull: 7 } },
  ],
};
