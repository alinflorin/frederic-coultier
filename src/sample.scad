// Solitaire ring, 4 prong
// Parameters
ring_size_mm  = 17.3;   // inner diameter (EU 54) [14:0.1:24]
band_width    = 2.4;    // [1.2:0.1:6]
band_thick    = 1.6;    // [1.2:0.1:3]
stone_d       = 5.0;    // round brilliant [3:0.1:8]
prong_d       = 0.9;    // [0.8:0.05:1.5]
prongs        = 4;      // [3:8]

$fn = 96;

// Anything inside gem() is drawn as glass in the preview and left out of the metal weight.
module gem() { children(); }

module round_brilliant(d) {
  rotate_extrude($fn = 16)
    polygon([[0, -0.431 * d], [d / 2, 0], [d / 2, 0.02 * d], [0.28 * d, 0.182 * d], [0, 0.182 * d]]);
}

// Finger axis along Y, stone on top (+Z)
module band() {
  rotate([90, 0, 0])
    difference() {
      cylinder(d = ring_size_mm + 2 * band_thick, h = band_width, center = true);
      cylinder(d = ring_size_mm, h = band_width + 1, center = true);
    }
}

module head() {
  translate([0, 0, ring_size_mm / 2 + band_thick - 0.3]) {
    // basket
    cylinder(d1 = 3, d2 = stone_d + 0.4, h = 2.2);
    // the stone, girdle 3 mm above the basket's base
    gem() translate([0, 0, 3]) round_brilliant(stone_d);
    // prongs
    for (i = [0 : prongs - 1])
      rotate([0, 0, i * 360 / prongs + 45])
        translate([stone_d / 2 + 0.1, 0, 0])
          cylinder(d = prong_d, h = 3.6);
  }
}

union() {
  band();
  head();
}
