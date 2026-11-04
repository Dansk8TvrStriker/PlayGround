# PlayGround

**The Green Between** — a playable 2D narrative platformer about two childhood friends crossing three reclaimed cities, thirty years after the reactors failed.

Mira and Teo were born after the fire. Now they walk back into the quiet: a sunlit suburb, a flooded city at night, and the reactor ruins where the last seed vault waits. Nature has taken the buildings. The past is still inside them.

## Play

The game is a static site with no build step and no external assets.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly also works in most browsers.

Progress, memories, and settings are saved to `localStorage`; **Continue the journey** resumes the last chapter.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `A` / `D` or arrow keys | ◀ ▶ |
| Jump / double jump (Mira) | `Space` or `W` | Jump |
| Switch character | `Q`, `Shift`, or `Tab` | Switch |
| Interact | `E` or `Enter` | Act |
| Strike | `X` or `K` | Strike |
| Memories journal | `J` | Journal button |
| Pause | `Esc` or `P` | Pause button |
| Mute | `M` | Sound button |

Mira can double-jump and wake old terminals. Teo is immune to radiation and can clear rubble. Some paths only open for one of them, so switch often.

## The journey

1. **Larkspur** — a sunset suburb swallowed by gardens. Climb the radio tower.
2. **Vireo** — a flooded city under a green aurora. Find the capacitor and power the control tower.
3. **Cinder Heights** — reactor ruins and open radiation. Reach the Ashen Spire and the seed vault.

There are 12 memory shards hidden across the three cities. Each one unlocks a short piece of the friends' shared past in the journal.

## Technical notes

- Canvas 2D rendering, procedural art, and procedural WebAudio — no image, font, or audio downloads.
- Fixed 120 Hz simulation with an accumulator, so movement is identical at any frame rate.
- Responsive layout with safe-area insets, portrait and landscape support, and on-screen touch controls.
- Saves use `localStorage` under `gb.save.v1`.
- Source lives in `js/`: `game.js` (loop and systems), `levels.js` (geometry and story), `render.js` (art), `audio.js`, `input.js`, `ui.js`, and `main.js`.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/Dansk8TvrStriker/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/Dansk8TvrStriker/PlayGround)

- 🎮 [Open the project](https://omgithub.com/Dansk8TvrStriker/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=Dansk8TvrStriker%2FPlayGround).
- 💻 [Explore the source](https://github.com/Dansk8TvrStriker/PlayGround).
- 🛠️ [Check build runs](https://github.com/Dansk8TvrStriker/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/Dansk8TvrStriker/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/Dansk8TvrStriker).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
