export const CHAMPION_CELLS = Object.freeze(['joao', 'maria', 'labuta', 'indigo', 'rosa', 'ada']);

const styles = {
  joao:   { size: 49, stride: 2.8, follow: .12, shadow: 23, recoil: .8 },
  maria:  { size: 49, stride: 3.1, follow: .09, shadow: 24, recoil: 1.65 },
  labuta: { size: 53, stride: 2.55, follow: .13, shadow: 30, recoil: 2.65 },
  indigo: { size: 49, stride: 2.9, follow: .11, shadow: 25, recoil: 1 },
  rosa:   { size: 49, stride: 3.2, follow: .13, shadow: 25, recoil: 1.45 },
  ada:    { size: 50, stride: 2.7, follow: .105, shadow: 25, recoil: 1.3 },
};
const walk = [1, 2, 3, 2];

export function championPose(id, { moving, travel, attack, attackAge = 0, hurt = false }) {
  const style = styles[id];
  if (!style) return { frame: id, size: 32, shadow: 24, anchorY: 0, recoil: 0 };
  const release = id === 'joao' ? .18 : .16;
  const sinceRelease = Math.max(0, attackAge - release);
  const striking = attack?.hit && sinceRelease < style.follow;
  let frame;
  if (striking) frame = 5;
  else if (hurt) frame = 7;
  else if (attack) frame = attack.hit ? 6 : 4;
  else if (moving) frame = walk[Math.floor(travel * style.stride) % walk.length];
  else frame = 0;
  return {
    frame: `${id}Pose${frame}`, size: style.size, shadow: style.shadow, anchorY: .075,
    recoil: striking ? style.recoil * (1 - sinceRelease / style.follow) : 0,
  };
}
