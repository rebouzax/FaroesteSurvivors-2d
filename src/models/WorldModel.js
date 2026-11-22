import { FRONTIER_STAGES } from "../config/frontierExpansion.js";
import { sceneryFor,sceneryColliders } from '../config/sceneryPlan.js';
import { createDesertProps } from './DesertLayout.js';
import { createMineProps } from './MineLayout.js';
import { createTownProps } from './TownLayout.js';

const landmarkStages=new Set(Object.keys(FRONTIER_STAGES));
export function createWorld(mapId = "desert") {
  if (mapId === 'desert') return createDesertProps();
  if (mapId === 'mine') return createMineProps();
  if (mapId === 'town') return createTownProps();
  let seed = 1887;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const props = [];
  const sparseLandmarks=landmarkStages.has(mapId);
  const enclosed=['mine','midnightSaloon','crowFortress','emberFoundry','moonMonastery'].includes(mapId);
  for (let i = 0; i < (enclosed ? 0 : sparseLandmarks ? 28 : 110); i++) {
    const x = (random() - 0.5) * 225,
      z = (random() - 0.5) * 225;
    if (Math.hypot(x, z) < (sparseLandmarks ? 27 : 14)) continue;
    const size = sparseLandmarks ? 0.35 + random() * 0.5 : 0.6 + random();
    props.push({
      x,
      z,
      type: 'rock',
      size,
      radius: size * 1.1,
    });
  }
  const landmarks=sceneryFor(mapId);
  return props.filter(prop=>!landmarks.some(p=>Math.hypot(prop.x-p.x,prop.z-p.z)<p.width*.65+prop.radius+1)).concat(sceneryColliders(mapId));
}
