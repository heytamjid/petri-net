// examples.js — Pre-built example Petri Nets

/**
 * German Traffic Light System (from Tamjid's assignment)
 * Cycle: Red -> Red+Yellow -> Green -> Yellow -> Red
 *
 * Places: P_R (Red), P_Y (Yellow), P_G (Green), P_C (Control)
 * Transitions: T1 (Prepare), T2 (Go), T3 (Warn), T4 (Halt)
 */
export const germanTrafficLight = {
  places: [
    { id: 'p_1', x: 350, y: 80,  label: 'P_Red',     tokens: 1 },
    { id: 'p_2', x: 350, y: 300, label: 'P_Yellow',   tokens: 0 },
    { id: 'p_3', x: 350, y: 520, label: 'P_Green',    tokens: 0 },
    { id: 'p_4', x: 650, y: 190, label: 'P_Control',  tokens: 1 },
  ],
  transitions: [
    { id: 't_1', x: 550, y: 80,  label: 'T1 Prepare' },
    { id: 't_2', x: 140, y: 190, label: 'T2 Go' },
    { id: 't_3', x: 560, y: 410, label: 'T3 Warn' },
    { id: 't_4', x: 700, y: 350, label: 'T4 Halt' },
  ],
  arcs: [
    // T1: Red + Control -> Red + Yellow (Red is bidirectional, Control consumed, Yellow produced)
    { id: 'a_1', placeId: 'p_1', transitionId: 't_1', direction: 'bidirectional', weight: 1 },
    { id: 'a_2', placeId: 'p_4', transitionId: 't_1', direction: 'place_to_transition', weight: 1 },
    { id: 'a_3', placeId: 'p_2', transitionId: 't_1', direction: 'transition_to_place', weight: 1 },

    // T2: Red + Yellow -> Green
    { id: 'a_4', placeId: 'p_1', transitionId: 't_2', direction: 'place_to_transition', weight: 1 },
    { id: 'a_5', placeId: 'p_2', transitionId: 't_2', direction: 'place_to_transition', weight: 1 },
    { id: 'a_6', placeId: 'p_3', transitionId: 't_2', direction: 'transition_to_place', weight: 1 },

    // T3: Green -> Yellow + Control
    { id: 'a_7', placeId: 'p_3', transitionId: 't_3', direction: 'place_to_transition', weight: 1 },
    { id: 'a_8', placeId: 'p_2', transitionId: 't_3', direction: 'transition_to_place', weight: 1 },
    { id: 'a_9', placeId: 'p_4', transitionId: 't_3', direction: 'transition_to_place', weight: 1 },

    // T4: Yellow + Control -> Red + Control (Control is bidirectional)
    { id: 'a_10', placeId: 'p_2', transitionId: 't_4', direction: 'place_to_transition', weight: 1 },
    { id: 'a_11', placeId: 'p_4', transitionId: 't_4', direction: 'bidirectional', weight: 1 },
    { id: 'a_12', placeId: 'p_1', transitionId: 't_4', direction: 'transition_to_place', weight: 1 },
  ],
};

/**
 * Producer-Consumer model
 * Classic concurrency pattern with a shared buffer.
 *
 * Producer produces items into a buffer, consumer takes from buffer.
 * Buffer has limited capacity (bounded).
 */
export const producerConsumer = {
  places: [
    { id: 'p_1', x: 150, y: 150, label: 'Ready to Produce', tokens: 3 },
    { id: 'p_2', x: 400, y: 150, label: 'Buffer',            tokens: 0 },
    { id: 'p_3', x: 650, y: 150, label: 'Ready to Consume',  tokens: 2 },
    { id: 'p_4', x: 150, y: 400, label: 'Idle Producer',     tokens: 0 },
    { id: 'p_5', x: 650, y: 400, label: 'Idle Consumer',     tokens: 0 },
  ],
  transitions: [
    { id: 't_1', x: 150, y: 280, label: 'Produce' },
    { id: 't_2', x: 650, y: 280, label: 'Consume' },
    { id: 't_3', x: 150, y: 500, label: 'Refill Producer' },
    { id: 't_4', x: 650, y: 500, label: 'Reset Consumer' },
  ],
  arcs: [
    // Produce: Ready to Produce -> Buffer
    { id: 'a_1', placeId: 'p_1', transitionId: 't_1', direction: 'place_to_transition', weight: 1 },
    { id: 'a_2', placeId: 'p_2', transitionId: 't_1', direction: 'transition_to_place', weight: 1 },
    { id: 'a_3', placeId: 'p_4', transitionId: 't_1', direction: 'transition_to_place', weight: 1 },

    // Consume: Buffer + Ready to Consume -> Idle Consumer
    { id: 'a_4', placeId: 'p_2', transitionId: 't_2', direction: 'place_to_transition', weight: 1 },
    { id: 'a_5', placeId: 'p_3', transitionId: 't_2', direction: 'place_to_transition', weight: 1 },
    { id: 'a_6', placeId: 'p_5', transitionId: 't_2', direction: 'transition_to_place', weight: 1 },

    // Refill: Idle Producer -> Ready to Produce
    { id: 'a_7', placeId: 'p_4', transitionId: 't_3', direction: 'place_to_transition', weight: 1 },
    { id: 'a_8', placeId: 'p_1', transitionId: 't_3', direction: 'transition_to_place', weight: 1 },

    // Reset Consumer: Idle Consumer -> Ready to Consume
    { id: 'a_9', placeId: 'p_5', transitionId: 't_4', direction: 'place_to_transition', weight: 1 },
    { id: 'a_10', placeId: 'p_3', transitionId: 't_4', direction: 'transition_to_place', weight: 1 },
  ],
};

export const examples = {
  'German Traffic Light': germanTrafficLight,
  'Producer-Consumer': producerConsumer,
};
