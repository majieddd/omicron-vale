# Change Notes

## 2026-08-29 — Pass 5: adversarial review round, all findings fixed

Reviewers: senior game designer + senior game developer, fresh-context fan-out
(BOTH simulated the actual sim engine; their logs: docs/analysis/*.mjs).

**Design findings (fixed):**

- [CRITICAL] Ember Forge splash was full damage to everything in radius, so 2
  forges erased every wave: splash is now 40% of direct damage, forge cost
  140 -> 180. Regression test: forge-pair now loses (tests/balance.test.mjs).
- [CRITICAL] No enemy HP bars: per-enemy billboard HP bars added (green to red
  tint), boss gets a top-screen named health bar in wave 3.
- [MAJOR] Boss leaked for 1 life = ignorable climax: Stonehorn now costs
  10 lives on leak, is slow-immune and splash-armored; killing it matters.
- [MAJOR] Enemy roster was stat reskins: wisps are now airborne (only Willow
  Warden / Lumen Hearth can hit them), beetles resist single-target 35% but
  die to splash, boss is splash-armored. Every tower now has a real niche.
- [MAJOR] Frost was the worst tower (0.042 dps/g): slow raised to 65-75%,
  cost 120 -> 110, dps 5 -> 7. Willow buffed 8 -> 12 dmg.
- [MAJOR] Economy ran away (2 forges could win un-upgraded): kill rewards cut
  roughly in half, START_GOLD 320 -> 300, wave bonus now peaks at wave 3
  (60/90/150) instead of dipping. Wave 2 softened (grunts 6 -> 5, then HP/speed
  tuning per sim). Badge: full roster + upgrades wins with 300g opening.
- [MINOR] Cards had no numbers: each card now shows DPS, range, mechanic tag.

**Developer findings (fixed):**

- [MAJOR] DynamicsCompressor orphaned: signal path is now sources -> master ->
  comp -> destination (was a no-op; clipping risk in heavy combat).
- [MAJOR] Blast/ice rings scaled to 1.7x their authored radius: expansion now
  caps at exactly 1.0x.
- [MAJOR] sim.shots grew unboundedly: pruned as consumed in processSimEvents.
- [MAJOR] Hit-flash zeroed emissive permanently: flash now blends ON TOP of the
  base emissive and restores it when it ends.
- [MAJOR] GPU resources never disposed: disposeView() on every removal path
  (enemies, towers, projectiles, bolts, rings, souls); shared materials marked
  and skipped.
- [MAJOR] Draw calls: willow strand leaves (54 x ~13) and grass tufts
  (~500 blades) merged into batched geometry -- scene meshes 922 -> 312,
  verified no visual regression. (This landed in Pass 3, before review.)
- [MINOR] Ghost tower y was hard-coded 0: now uses groundHeight (no float/pop).
- [MINOR] Boss feet clipped the road: boss group grounded at groundHeight + 1.45
  with the stomp dip transferred to userData so the animation still shows.
- [MINOR] Stalker sway clobbered facing: sway moved to body/head, group keeps
  eased travel facing.
- [MINOR] Sim events could re-fire on throwing handlers: drained at top of
  processSimEvents (snapshot + clear) instead of at the end.

All fixes verified: node sim + balance tests green, live browser full campaign
victory with 0 console errors (window.__ERRORS stays empty across waves).

## 2026-08-29 — Pass 1..3: build, polish, batching

- Initial painterly world (reference-matched palette), 3 waves, 5 towers,
  6 enemies + boss, procedural sound, fused single-file build.
- Pass 2: enemy facing, placement ghost + range ring, selection/upgrade panel,
  road widening, neutral paint-tooth texture (hue source = vertex colors),
  mist rework (flat haze sheets, not fog walls), wisp scale/contrast.
- Pass 3: willow + tufts batched (922 -> 312 meshes), play.html MOD preamble
  fix (single-file boot).
