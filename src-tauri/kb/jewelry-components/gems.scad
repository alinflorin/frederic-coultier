// Gems. Girdle plane at z = 0, crown up, culet down. All sizes are the girdle diameter / width.

// Round brilliant, standard proportions (table 56%, crown 16.2%, pavilion 43.1%).
// `grow` enlarges the stone for use as a cutter in a setting.
module round_brilliant(d = 5, facets = 16, grow = 0) {
  dd = d + 2 * grow;
  girdle = 0.02 * dd;
  crown = 0.162 * dd;
  pavilion = 0.431 * dd;
  table = 0.56 * dd;
  rotate_extrude($fn = facets)
    polygon([
      [0, -pavilion - girdle / 2],
      [dd / 2, -girdle / 2],
      [dd / 2, girdle / 2],
      [table / 2, girdle / 2 + crown],
      [0, girdle / 2 + crown]
    ]);
}

// Oval / marquise-like: a round brilliant stretched to length x width.
module oval_brilliant(length = 7, width = 5, facets = 24, grow = 0) {
  scale([length / width, 1, 1]) round_brilliant(width, facets, grow);
}

// Princess cut: square table, inverted pyramid pavilion.
module princess(side = 4.5, grow = 0) {
  s = side + 2 * grow;
  crown = 0.15 * s;
  pavilion = 0.7 * s;
  table = 0.68 * s;
  hull() {
    translate([0, 0, -pavilion]) cube(0.02, center = true);
    linear_extrude(0.02) square(s, center = true);
  }
  hull() {
    linear_extrude(0.02) square(s, center = true);
    translate([0, 0, crown]) linear_extrude(0.02) square(table, center = true);
  }
}

// Cabochon: flat bottom at the girdle plane, dome above (height as a share of the diameter).
module cabochon(d = 6, height = 0.45, base = 0.4, facets = 48) {
  h = d * height;
  translate([0, 0, -base]) cylinder(d = d, h = base, $fn = facets);
  scale([1, 1, h / (d / 2)])
    intersection() {
      sphere(d = d, $fn = facets);
      translate([-d, -d, 0]) cube(2 * d);
    }
}

// demo: round_brilliant(5);
// demo: oval_brilliant(7, 5);
// demo: princess(4.5);
// demo: cabochon(6);
