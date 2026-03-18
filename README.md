# Petri Net Simulator

An interactive, visual Petri Net simulator built with vanilla JavaScript and SVG. Zero dependencies. No build tools. Just open and run.

## Running Locally

The project uses ES modules, so it needs to be served over HTTP (browsers block `file://` imports). Pick any method:

**Python (built-in):**
```bash
cd petrinet-simulator
python -m http.server 3000
# Open http://localhost:3000
```

**Node.js (npx, no install):**
```bash
cd petrinet-simulator
npx serve .
# Open the URL shown
```

**VS Code:**
Install the "Live Server" extension, right-click `index.html`, select "Open with Live Server".

## Features

### Visual Editor

- **Toolbar-based workflow** -- select a tool (Place, Transition, Arc, Delete), then click on the canvas
- **Drag-and-drop** repositioning of places and transitions
- **Double-click** any element to edit its label directly
- **Properties panel** (right sidebar) to configure labels, token counts, arc weights, arc directions, and transition priorities

### Petri Net Elements

| Element | Visual | Description |
|---------|--------|-------------|
| **Place** | Circle | Holds tokens. Set initial token count in properties. |
| **Transition** | Bar/Rectangle | Fires when all input places have enough tokens. Glows green when enabled. |
| **Arc** | Arrow | Connects a place to a transition or vice versa. Configurable weight (default 1). |
| **Bidirectional Arc** | Double arrow | Read/write arc -- transition reads tokens without consuming them (marked "R/W"). |
| **Token** | Dot inside place | Dots for 1-5 tokens, number for 6+. |

### Arc Weights

Arcs support weights greater than 1. An arc with weight 2 from a place to a transition means the transition requires (and consumes) 2 tokens from that place to fire. Set weights in the properties panel after selecting an arc.

### Transition Priority

Each transition has a **priority** (default: 1, higher = more important). When multiple transitions are enabled:
- **Higher priority fires first**
- **Equal priority** -- chosen randomly (non-deterministic)

Set priority in the properties panel after selecting a transition.

### Simulation

#### Firing Modes

Switch between modes using the dropdown in the toolbar:

- **Interleaving** (default) -- One transition fires per step. If multiple are enabled, the highest-priority one fires. Random among equal priority. This is the standard Petri Net semantics that teaches non-determinism.

- **Maximal Concurrency** -- All independently enabled transitions fire together in a single step. "Independent" means they don't compete for tokens from the same input place. Priority determines which transitions get tokens first when there's competition.

#### Controls

- **Play** -- Fire N steps forward (set count in the input box). Each step animates individually: tokens travel along arcs, the transition flashes, then tokens appear in output places. A pause between steps lets you observe each state.
- **Back** -- Undo N steps, reversing the simulation with animation. Uses a history stack to restore previous markings exactly.
- **Reset** -- Return to the initial marking (the token distribution when the net was created or last edited).

#### Animation

When firing, tokens visually travel from input places to the transition, the transition flashes, then tokens travel to output places. Forward animations are green, backward animations are purple. Tokens pulse in size during travel for visibility.

### Analysis

Click **Analyze** to compute structural properties of the net (uses the initial marking):

| Property | Description |
|----------|-------------|
| **Reachable States** | Number of distinct markings reachable from the initial state (via reachability graph). |
| **Boundedness** | Whether every place has a maximum token count across all reachable markings. Reports the k-bound per place and globally. |
| **Deadlock-Free** | Whether every reachable marking has at least one enabled transition. Reports the number of deadlock states if any exist. |
| **Liveness (L1)** | Whether every transition can fire at least once from some reachable marking. Lists dead transitions if any. |

### Canvas Navigation

- **Scroll wheel** -- Zoom in/out, centered on cursor position
- **Right-click drag** or **middle-click drag** -- Pan the canvas
- **`0` key** -- Reset view to default zoom and position
- Zoom percentage is shown in the bottom bar

### Save / Load

- **Export** -- Download the current net as a `.json` file
- **Import** -- Load a previously saved `.json` file
- **Examples** -- Load pre-built example nets from the dropdown

Share designs with others by sending the JSON file.

### Pre-built Examples

- **German Traffic Light** -- Models the Red → Red+Yellow → Green → Yellow → Red cycle using a control place for determinism. Based on the German traffic signaling system.
- **Producer-Consumer** -- Classic concurrency pattern with producers, consumers, and a shared buffer.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select / Move tool |
| `P` | Add Place tool |
| `T` | Add Transition tool |
| `A` | Draw Arc tool |
| `D` | Delete tool |
| `Space` | Play N steps forward |
| `B` | Play N steps backward |
| `R` | Reset to initial marking |
| `L` | Toggle Log visibility |
| `Del` | Remove selected element |
| `Esc` | Back to Select tool |
| `0` | Reset view (zoom/pan) |
| `Scroll` | Zoom in/out |
| `Left-drag` | Move element |
| `Right-drag` | Pan canvas |
| `Dbl-click` | Edit label |

## Project Structure

```
petrinet-simulator/
├── index.html          App shell and toolbar layout
├── css/
│   └── style.css       All styling (no preprocessor)
├── js/
│   ├── app.js          Main application wiring, animation, UI events
│   ├── model.js        Data model: PetriNet, Place, Transition, Arc classes
│   ├── renderer.js     SVG rendering engine with pan/zoom
│   ├── editor.js       Editor tools: select, place, transition, arc, delete
│   ├── simulator.js    Firing rules, priority, concurrency, history stack
│   ├── analyzer.js     Reachability graph, boundedness, liveness, deadlock
│   └── examples.js     Pre-built example nets (German Traffic Light, Producer-Consumer)
```

## Petri Net Theory (Quick Reference)

A **Petri Net** is a tuple (P, T, F, W, M₀) where:
- **P** = set of places (circles)
- **T** = set of transitions (bars)
- **F** = set of arcs connecting places to transitions and vice versa
- **W** = weight function on arcs (default 1)
- **M₀** = initial marking (token distribution)

**Firing rule:** A transition is *enabled* if every input place has at least as many tokens as the weight of the connecting arc. When an enabled transition fires, it consumes tokens from input places and produces tokens in output places according to arc weights.

**Key properties:**
- **Boundedness** -- no place ever exceeds k tokens across all reachable markings
- **Liveness** -- every transition can eventually fire from any reachable state
- **Deadlock-freedom** -- the system never reaches a state where no transition is enabled

**Firing semantics:**
- **Interleaving** -- one transition fires per step; non-deterministic choice among enabled transitions
- **Maximal concurrency** -- all independently enabled transitions fire simultaneously in one step

## License

MIT
