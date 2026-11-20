import { stageLayout } from './stageLayout.js';

export const sceneryFor = (stage) => stageLayout(stage) ?? [];
export const sceneryColliders = (stage) => sceneryFor(stage)
  .filter(prop => !prop.flat)
  .map(prop => ({ ...prop, type: 'supplied-collider', size: 1 }));
