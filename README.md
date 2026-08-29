# Omicron: Willow Vale Defense

A painterly low-poly 3D tower defense in one HTML file. Sage and cream diorama
world with a drooping willow, thatched hearth hut, winding dirt road, drifting
mist, and a 3-wave campaign against a stone boss.

## Play

Double-click `play.html`. That's it. Everything (three.js, audio synthesis,
textures) is fused into the single file. No server, no internet needed.

For development: `node server.mjs` (http://127.0.0.1:8231), or `start.bat`.

## The campaign

3 waves. 6 enemy types plus the Stonehorn Sentinel boss.

- **Flitter Wisp** (fly): only Willow Warden and Lumen Hearth can hit air.
- **Crowned Beetle** (ground): 35% resist to single-target damage; splash
  damage ignores that armor, so Ember Forge is the counter.
- **Emberling, Briar Stalker, Mossback Grunt**: fast, jittery, tanky mix.
- **Stonehorn Sentinel** (boss): 2600 HP, splash-armored, slow-immune, and
  leaking it costs 10 lives instead of 1. Boss bar appears in wave 3.

5 towers, 3 upgrade levels each:

| Tower | Identity |
|---|---|
| Willow Warden | single target, anti-air (100g) |
| Ember Forge | direct hit full damage + 40% splash (180g) |
| Frostbloom Totem | 65% slow field, ground only (110g) |
| Storm Drum | chain lightning up to 3 targets (160g) |
| Lumen Hearth | radial burst, hits air too (190g) |

## Verification

- `node tests/sim.test.mjs` — determinism + winnability (green)
- `node tests/balance.test.mjs` — regression: forge-pair autowin exploit dead,
  boss leak cost / armor / slow-immune enforced, full roster winnable (green)
- Live browser runs: zero console errors across full campaign; victory with
  the real 300g opening and mid-combat upgrades (verified via CDP)
- `docs/shots/` — captured frames from every pass

## Structure

- `src/02_sim.mjs` — pure logic (no DOM/THREE): path, waves, combat, economy
- `src/00_util.mjs` — palette, procedural canvas textures (grass/thatch/
  planks/stone/sky/mist/paint-tooth)
- `src/03_world.mjs` — terrain, road, sky dome, hills, mist layers
- `src/04_props.mjs` — willow (merged strands), hut, rocks, trees, reeds,
  tufts (merged), fences
- `src/05_units.mjs` — articulated enemies + towers, procedural animation
- `src/06_fx.mjs` — particle pool, projectiles, bolts, rings, soul bursts
- `src/07_audio.mjs` — fully synthesized WebAudio (no assets), compressor on
  the master bus, adaptive music
- `src/08_main.mjs` — renderer (ACES, bloom), input, placement, entity sync,
  event pipeline, HUD, test API (`window.__game`)
- `build.mjs` — fuses ESM modules + vendored three.js into `play.html`
  (invariants: BUNDLE PARSE: OK, no `type="module"`, no import map)
