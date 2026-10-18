// Findings: the small functional parts. Each is centred on the origin, lying in the XZ plane
// unless noted. Minimum sizes for casting: wire >= 1.0 mm, post >= 0.8 mm.

// A closed ring of round wire (for chains), axis along Y.
module jump_ring(inner_d = 4, wire = 1.0) {
  rotate([90, 0, 0]) rotate_extrude($fn = 48) translate([(inner_d + wire) / 2, 0]) circle(d = wire, $fn = 16);
}

// Pendant bail: a loop for the chain, with a stem that joins the pendant below (-Z) it.
module bail(inner_d = 4, wire = 1.2, stem = 1.6) {
  r = (inner_d + wire) / 2;
  translate([0, 0, r + stem]) jump_ring(inner_d, wire);
  translate([0, 0, 0]) cylinder(d = wire * 1.4, h = r + stem, $fn = 24);
}

// Earring post with a flat head; the post points along -Z, the head sits on z = 0.
module earring_post(post_d = 0.8, length = 10, head_d = 4, head_h = 0.6) {
  translate([0, 0, -length]) cylinder(d = post_d, h = length, $fn = 24);
  cylinder(d = head_d, h = head_h, $fn = 48);
}

// Hoop earring or simple ring of wire, lying flat (axis Z).
module hoop(d = 20, wire = 1.2) {
  rotate_extrude($fn = 96) translate([(d - wire) / 2, 0]) circle(d = wire, $fn = 16);
}

// Toggle bar for a bracelet or necklace, along X.
module toggle_bar(length = 14, d = 2) {
  hull() {
    translate([-length / 2 + d / 2, 0, 0]) sphere(d = d, $fn = 20);
    translate([length / 2 - d / 2, 0, 0]) sphere(d = d, $fn = 20);
  }
  translate([0, 0, -d * 1.2]) cylinder(d = d * 0.6, h = d * 1.2, $fn = 20);
}

// demo: jump_ring(4, 1);
// demo: bail(4, 1.2);
// demo: earring_post();
// demo: hoop(20, 1.2);
// demo: toggle_bar();
