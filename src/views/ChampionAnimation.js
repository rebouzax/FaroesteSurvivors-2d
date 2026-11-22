import { championReleaseAge } from '../models/ActorCues.js';

export const DESERT_CHAMPIONS = Object.freeze(['joao', 'maria', 'labuta', 'indigo', 'rosa', 'ada']);
export const MINE_CHAMPIONS = Object.freeze(['elias', 'ruth', 'dynamite']);
export const TOWN_CHAMPIONS = Object.freeze(['silas', 'teo']);
export const CHAMPION_CELLS = Object.freeze([...DESERT_CHAMPIONS, ...MINE_CHAMPIONS, ...TOWN_CHAMPIONS]);

const styles = {
  joao:   { size: 49, stride: 2.8, follow: .12, shadow: 23, recoil: .8 },
  maria:  { size: 49, stride: 3.1, follow: .09, shadow: 24, recoil: 1.65 },
  labuta: { size: 53, stride: 2.55, follow: .13, shadow: 30, recoil: 2.65 },
  indigo: { size: 49, stride: 2.9, follow: .11, shadow: 25, recoil: 1 },
  rosa:   { size: 49, stride: 3.2, follow: .13, shadow: 25, recoil: 1.45 },
  ada:    { size: 50, stride: 2.7, follow: .105, shadow: 25, recoil: 1.3 },
  elias:  { size: 52, stride: 2.65, follow: .12, shadow: 27, recoil: 2.2 },
  ruth:   { size: 50, stride: 2.95, follow: .11, shadow: 25, recoil: 2.45 },
  dynamite: { size: 51, stride: 2.8, follow: .14, shadow: 26, recoil: .7 },
  silas:  { size: 49, stride: 3.15, follow: .105, shadow: 25, recoil: .55 },
  teo:    { size: 54, stride: 2.7, follow: .095, shadow: 27, recoil: 2.15 },
};
const walk = [1, 2, 3, 2];

export function championPose(id, { moving, travel, attack, attackAge = 0, hurt = false, echoAge }) {
  const style = styles[id];
  if (!style) return { frame: id, size: 32, shadow: 24, anchorY: 0, recoil: 0 };
  const release = championReleaseAge(id);
  const sinceRelease = echoAge ?? Math.max(0, attackAge - release);
  const striking = (echoAge !== undefined || attack?.hit) && sinceRelease < style.follow;
  const step = Math.floor(travel * style.stride * .5);
  let frame, contact;
  if (hurt) frame = 7;
  else if (striking) frame = 5;
  else if (attack) frame = attack.hit ? 6 : 4;
  else if (moving) {
    frame = walk[step % walk.length];
    if (step % 2 === 0) contact = step / 2;
  }
  else frame = 0;
  return {
    frame: `${id}Pose${frame}`, contact, size: style.size, shadow: style.shadow, anchorY: .075,
    recoil: striking && !hurt ? style.recoil * (1 - sinceRelease / style.follow) : 0,
  };
}
