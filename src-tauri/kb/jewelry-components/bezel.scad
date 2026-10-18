// Bezel: a wall of metal around a round stone, closed or open at the back.
// Needs round_brilliant() from gems.scad. The girdle plane is z = 0.
// wall >= 0.5 mm for casting; `rim` is how far the wall stands above the girdle.

module bezel(stone_d = 5, wall = 0.6, rim = 0.6, open_back = true, facets = 16) {
  pavilion = 0.431 * stone_d;
  difference() {
    translate([0, 0, -pavilion * 0.85]) cylinder(d = stone_d + 2 * wall, h = pavilion * 0.85 + rim, $fn = 64);
    // the stone, with a lip folding over its edge
    round_brilliant(stone_d, facets, 0.03);
    cylinder(d1 = stone_d + 0.06, d2 = stone_d - 0.5, h = rim + 0.01, $fn = 64);
    if (open_back) translate([0, 0, -pavilion - 1]) cylinder(d = stone_d * 0.5, h = pavilion * 0.6, $fn = 48);
  }
}

// demo: bezel(5);
// demo: bezel(6, 0.7, 0.8, false);
