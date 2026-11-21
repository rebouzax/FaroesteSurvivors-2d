import { RunModel } from "../models/RunModel.js";
import { RunSystem } from "../systems/RunSystem.js";
import { STARTER_DECK } from "../config/deckConfig.js";

export class GameViewModel {
  constructor(profile, audio, options = {}) {
    this.model = new RunModel(
      Math.random,
      profile.data.healthRank * 20,
      profile.data,
      { ...options, deck: profile.data.completedRuns ? profile.data.deck : STARTER_DECK },
    );
    this.system = new RunSystem();
    this.profile = profile;
    this.audio = audio;
    this.paused = false;
    this.settled = false;
  }
  update(dt, input) {
    if (this.paused) return;
    this.system.update(this.model, dt, input);
    this.audio.updateRun(this.model);
    if (["victory", "defeat"].includes(this.model.phase)) this.settle();
  }
  settle() {
    if (this.settled) return;
    this.settled = true;
    this.profile.recordRun(this.model);
  }
  togglePause() {
    if (["intro", "playing", "upgrade"].includes(this.model.phase))
      this.paused = !this.paused;
  }
}
