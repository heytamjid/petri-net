// simulator.js — Simulation engine (firing rules, step execution)

export class Simulator {
  constructor(petriNet) {
    this.net = petriNet;
    this.history = []; // array of { transitionId, label, markingBefore, markingAfter }
    this.stepCount = 0;
  }

  /** Check if a transition is enabled at the current marking */
  isEnabled(transitionId) {
    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      const place = this.net.places.get(arc.placeId);
      if (!place || place.tokens < arc.weight) {
        return false;
      }
    }
    // A transition with no input arcs is always enabled (source transition)
    return true;
  }

  /** Get all currently enabled transitions */
  getEnabledTransitions() {
    const enabled = [];
    for (const [id] of this.net.transitions) {
      if (this.isEnabled(id)) {
        enabled.push(id);
      }
    }
    return enabled;
  }

  /** Fire a specific transition. Returns true if successful. */
  fire(transitionId) {
    if (!this.isEnabled(transitionId)) return false;

    const markingBefore = this.net.getMarking();

    // Consume tokens from input places
    const inputArcs = this.net.getInputArcs(transitionId);
    for (const arc of inputArcs) {
      const place = this.net.places.get(arc.placeId);
      place.tokens -= arc.weight;
    }

    // Produce tokens in output places
    const outputArcs = this.net.getOutputArcs(transitionId);
    for (const arc of outputArcs) {
      const place = this.net.places.get(arc.placeId);
      place.tokens += arc.weight;
    }

    const markingAfter = this.net.getMarking();
    const t = this.net.transitions.get(transitionId);
    this.stepCount++;
    this.history.push({
      step: this.stepCount,
      transitionId,
      label: t ? t.label : transitionId,
      markingBefore: Object.fromEntries(markingBefore),
      markingAfter: Object.fromEntries(markingAfter),
    });

    return true;
  }

  /** Fire a random enabled transition. Returns the fired transition id, or null if deadlocked. */
  fireRandom() {
    const enabled = this.getEnabledTransitions();
    if (enabled.length === 0) return null;
    const idx = Math.floor(Math.random() * enabled.length);
    this.fire(enabled[idx]);
    return enabled[idx];
  }

  /**
   * Play N steps, firing random enabled transitions.
   * Returns an array of fired transition ids.
   * Stops early if deadlocked.
   */
  playSteps(n) {
    const fired = [];
    for (let i = 0; i < n; i++) {
      const tid = this.fireRandom();
      if (tid === null) break; // deadlock
      fired.push(tid);
    }
    return fired;
  }

  /** Check if current state is a deadlock (no enabled transitions) */
  isDeadlocked() {
    return this.getEnabledTransitions().length === 0;
  }

  /** Reset simulation state */
  reset() {
    this.net.resetMarking();
    this.history = [];
    this.stepCount = 0;
  }
}
