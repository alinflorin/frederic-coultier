// Prong head: a basket with 3-8 claw prongs that hold a round stone.
// Needs round_brilliant() from gems.scad. The girdle plane is z = 0 (stone centred on it).
// Rotate by `twist` degrees to put a prong on the finger axis or between prongs.
// Keep prong_d >= 0.8 mm for casting.

module prong_head(stone_d = 5, prongs = 4, prong_d = 0.9, basket_h = 2.4, over = 0.45, twist = 45, facets = 16) {
  r_stone = stone_d / 2;
  crown = 0.162 * stone_d;
  top = crown * 0.75;                       // where the claws bend over the crown
  foot = r_stone * 0.55;                    // prong radius at the bottom of the basket
  difference() {
    union() {
      for (i = [0 : prongs - 1])
        rotate([0, 0, twist + i * 360 / prongs]) {
          // upright part, leaning out to clear the girdle
          hull() {
            translate([foot, 0, -basket_h]) sphere(d = prong_d, $fn = 12);
            translate([r_stone + prong_d * 0.3, 0, 0]) sphere(d = prong_d, $fn = 12);
          }
          // claw bending over the crown
          hull() {
            translate([r_stone + prong_d * 0.3, 0, 0]) sphere(d = prong_d, $fn = 12);
            translate([r_stone - over, 0, top]) sphere(d = prong_d * 0.8, $fn = 12);
          }
        }
      // gallery ring and the cone the pavilion sits in
      translate([0, 0, -basket_h * 0.45]) rotate_extrude($fn = 48) translate([r_stone * 0.8, 0]) circle(d = prong_d * 0.9, $fn = 12);
      translate([0, 0, -basket_h]) cylinder(d1 = stone_d * 0.3, d2 = stone_d * 0.8, h = basket_h * 0.8, $fn = 48);
    }
    round_brilliant(stone_d, facets, 0.03);
  }
}

// demo: prong_head(5);
// demo: prong_head(6, 6, 1.0);
// demo: prong_head(4, 3, 0.8, twist = 90);
