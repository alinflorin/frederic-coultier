# Casting workflow with castable resins, plus assorted design figures (web research notes)

Compiled 2026-10-13 from web sources. Secondary/vendor guidance, not tested standards: verify against your own resin, investment and caster.
Keywords: sprue, tree, investment, burnout, vacuum casting, venting, hollow, shrinkage, wall thickness, ring size, carat, stone diameter.

## Formlabs: Introduction to casting with Formlabs resins
Source: https://formlabs.com/support/Introduction-to-casting-with-Formlabs-resins/
- Design: hollow thick parts and add vent holes for burnout airflow. Close vent holes with wax before sprueing so investment doesn't enter the model.
- Wash and fully dry printed parts before sprueing (uncured resin interferes with investment cure and causes pitting).
- Sprues: wax sprues for main sprues/large feeds; print small feed sprues into fine details as part of the model. Make sprues as thick as possible, on the thickest part of the model, where they don't interfere with the design. Match a printed sprue's diameter to the adjacent cross-section. Keep the metal's exit path and airflow paths short.
- Tree: thicker parts at the bottom, thinner at the top. Space printed pieces farther apart than wax (investment between them resists thermal expansion and cracking). Smaller trees burn out more easily.
- Investment: for large/thick parts use a stronger investment, adjust the water ratio, and dissolve boric acid at 1% of the water weight before mixing. Pour slowly down the flask side, vacuum degas at maximum vacuum, then set 2-6 h vibration-free.
- Burnout: follow the investment maker's schedule; maximise airflow (vents, ventilation, oxygen generator for a full oven). Direct-casting resins need a burnout hold of at least 732 C. Missing pieces in the cast usually mean ash left from incomplete burnout.
- Casting: centrifugal or vacuum casting fills the mold fast.

## Cooksongold design guidelines (summary pages)
Sources: https://help.cooksongold.com/kb/guide/en/what-are-the-3d-printing-design-guidelines-X1FhHyZB90/Steps/2749862 and https://help.cooksongold.com/kb/guide/en/what-are-the-precious-metal-casting-design-guidelines-X1FhHyZB90/Steps/2749862 (figures as relayed by search summaries)
- Structural and external walls: minimum 0.8 mm. Small elements (claws, small bezels): minimum 0.5 mm.
- Holes: minimum 0.5 mm.
- Sharp edges print poorly: thicken a sharp external edge to 0.30 mm or use a 0.30 mm fillet; same for sharp internal edges.
- Raised text: stroke at least 0.30 mm, height at most 0.60 mm, letter spacing 0.30 mm. Recessed text: stroke at least 0.30 mm, depth at most 0.50 mm, spacing 0.30 mm.
- Earring posts are too thin/long to print: solder on after.
- Models must be watertight; hollow or interlocking (captive) pieces cannot be processed by that service.

## Other figures seen (blogs and vendors; treat as rough)
- Wearability wall thickness: roughly 1.2 mm for pendants and earrings, 1.5-2 mm for rings (Womp blog); Materialise (gold printing) cites 0.8 mm minimum wall and at least 1 mm for a ring band; Stuller shank minimum 1.2-1.7 mm.
- Castable resin plus metal shrinkage: about 1-3% total (Hitem3D blog), so fit-critical seats and ring sizes need allowance and verification with the caster.
- Support contact points about 0.3-0.4 mm to limit pitting; for stone-setting work one resin maker suggests many fine supports of 0.25-0.35 mm for prongs and channels. Sand off support marks before casting.
- Elegoo Mars 5 castable-resin exposure settings: no authoritative profile found. Use the resin maker's profile and run an exposure test; Siraya Tech Cast on a Mars 2 Pro (different printer) used 50 um layers, 15 s exposure, 5 base layers at 65 s, 20-25 C room temperature.

## Stone size reference (round brilliant diamond, girdle diameter vs weight; sources differ by a few tenths of a mm and cut quality)
Sources: https://www.brilliantearth.com/diamond/buying-guide/mm-to-carat/ , https://www.diamonds.pro/truth-about/diamond-carat-weight/ , https://whiteflash.com/diamond-education/mm-to-carat-weight-conversion-diamonds-guide
- 0.25 ct about 4.0-4.1 mm; 0.50 ct about 5.1-5.2 mm; 1.00 ct about 6.3-6.5 mm; 2.00 ct about 8.0-8.1 mm; 4.00 ct about 10.1-10.2 mm.
- Typical total depth for a well-cut round: about 59-62.5% of the diameter. Always measure the actual stone (diameter, depth, girdle thickness) before modelling a seat.

## Ring size conversions
Sources: https://www.valigara.com/jewelry-ecommerce-articles/ring-size-conversion-mm-the-definitive-guide-for-global-jewelers-in-2026/ , https://guldviva.com/en/pages/size-guide (sources conflict on EU and UK equivalents; the formula below is the reliable part)
- Inner circumference = pi x inner diameter. EU size (ISO 8653) is the inner circumference in mm, so EU size / pi = inner diameter in mm (EU 54 -> 17.2 mm).
- US sizes: each half size is about 0.4 mm of inner diameter. Recurring values: US 4 about 14.9 mm, US 5 about 15.7 mm, US 6 about 16.5 mm, US 7 about 17.3 mm, US 8 about 18.1 mm, US 9 about 18.9 mm.
- Wide bands feel tighter: typically go up about half a size. Fingers swell with heat and in the evening: measure late in the day.
- Add casting/finishing allowance (see shrinkage) and confirm with the caster.
