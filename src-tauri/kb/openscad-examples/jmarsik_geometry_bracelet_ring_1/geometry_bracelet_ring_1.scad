// Geometry bracelet
// Author: Jakub Marsik (jmarsik@fullvent.cz)

/* [Bracelet] */
// Inner diameter [mm]
inner_dia = 62;
// Thickness [mm]
thickness = 4;
// Width [mm]
width = 40;
// Arc sector [degrees]
arc_sector = 300;
// Offset of start angle (sometimes it's good to tweak this) [degrees]
offset_angle = 25;

/* [Scaling] */
// Scaling factor [percent]
scaling_factor_percent = 100.0; // [0.1:0.1:250.0]

/* [Geometry styling] */
// Number of segments in full circle
segments = 8;
// Number of twist direction changes while extruding (number of rows)
direction_changes = 3;
// Amount of twist for single row extrusion [degrees]
twist = 20;

/* [Cutting] */
// Rounded edges radius [mm]
round_corner_radius = 5;
// How much degrees of rotation to cut into bracelet shape (0 = no cutting) [degrees]
cut_degrees = 5;

// =========================================

/* [Hidden] */

// outer radius
r1 = (inner_dia + 2 * thickness) / 2;
echo(r1);
row_width = width / direction_changes;

// arc sector to optimal start and end angle to balance starting and ending segment part size
segment_sector = 360 / segments;
full_segments_sector = segment_sector * floor(arc_sector / segment_sector);
echo(full_segments_sector);
part_segments_sector = arc_sector - full_segments_sector;
start_angle = segment_sector - part_segments_sector / 2 + offset_angle;
end_angle = start_angle + arc_sector;
echo(str("Start angle: ", start_angle, "; end angle: ", end_angle));

cutting_tool_extrude = thickness * 3;
cutting_tool_extend_x_by = 15;

// cutting tool top and bottom modification factors for different number of twist direction changes (odd or even number) and different initial twist direction (positive or negative)
start_cutting_tool_top_factor = (direction_changes % 2 == 0 ? (twist > 0 ? -2 : 5) : (twist > 0 ? 5 : -2));
start_cutting_tool_bottom_factor = (twist > 0 ? -2 : 5);
end_cutting_tool_top_factor = (direction_changes % 2 == 0 ? (twist > 0 ? 5 : -2) : (twist > 0 ? -2 : 5));
end_cutting_tool_bottom_factor = (twist > 0 ? 5 : -2);

// =========================================

// validations
assert(inner_dia > 10 && inner_dia < 250, "Inner diameter out of range");
assert(thickness > 0 && thickness < inner_dia / 4, "Thickness out of range");
assert(width > 0 && width < 500, "Width out of range");
assert(arc_sector > 45 && arc_sector <= 360, "Arc sector out of range");
assert(scaling_factor_percent > 0 && scaling_factor_percent < 999, "Scaling factor out of range");
assert(segments > 0 && segments < 128, "Number of segments out of range");
assert(direction_changes >= 0 && direction_changes < 128, "Number of twist direction changes out of range");
assert(twist > -360 && twist < 360, "Twist out of range");
assert(round_corner_radius >= 0 && round_corner_radius < row_width, "Round corner radius out of range");
assert(cut_degrees >= 0 && cut_degrees < 12, "Cut degrees out of range");

// =========================================

// uses library polyround.scad from https://github.com/Irev-Dev/Round-Anything with GPL 3.0 license
// in files for Thingiverse and PrusaPrinters web sites the library source code would be included DIRECTLY here because
//  of the limitations of Customizer engine on the web
use <polyround.scad>;

function len3(v) = len(v) > 1 ? sqrt(addl([for(i = [0 : len(v) - 1]) pow(v[i], 2)])) : len(v) == 1 ? v[0] : v; 
function addl(l, c = 0) = len(l) -1 > c ? l[c] + addl(l, c + 1) : l[c];

function point_on_circle(r, a) = [r * cos(a), r * sin(a), 0];

module regular_polygon(order = 4, r) {
    angles = [ for (i = [0:order - 1]) i * (360 / order) ];
    coords = [ for (th = angles) [r * cos(th), r * sin(th)] ];
    polygon(coords);
}
 
module sector(angle1, angle2, r) {
    points = [
        for(a = [angle1 : 1 : angle2]) [r * cos(a), r * sin(a)]
    ];
    polygon(concat([[0, 0]], points));
}

module raw_bracelet() { 
    for (step = [0 : direction_changes - 1])
        let (dir = step % 2 == 0 ? -1 : 1) {
        translate([0, 0, step * row_width]) {
            rotate(twist / 2 * dir) {
                linear_extrude(width / direction_changes, center = false, twist = twist * dir, slices = 100, convexity = 10) {
                    intersection() {
                        difference() {
                            regular_polygon(segments, r = r1);
                            regular_polygon(segments, r = r1 - thickness);
                        }
                        sector(start_angle, end_angle, r1 + 5);
                    }
                }
            }
        }
    }
}

module cutting_tool(extend_x_by, top_factor, bottom_factor) {
    single_dir_change_len = len3(point_on_circle(r1, 0) - point_on_circle(r1, twist / 2)) * sign(twist);
    // zigzag polyline covering all the rows of the bracelet
    points1 = [ for (step = [0 : direction_changes]) let (dir = step % 2 == 0 ? -1 : 1) [dir * single_dir_change_len, step * row_width, round_corner_radius] ];
    // extension (continuation of the shape) - bottom and top
    points1b = concat([[bottom_factor * points1[0][0], -1 * row_width, round_corner_radius]], points1, [[top_factor * points1[len(points1) - 1][0], (direction_changes + 1) * row_width, round_corner_radius]]);
    // another polyline a little bit shifted from the previous one
    points2 = [ for (i = [len(points1b) - 1 : -1 : 0]) [points1b[i][0] + extend_x_by, points1b[i][1], points1b[i][2]] ];
    points = concat(points1b, points2);
    echo(points);

    // polygon from all the points, with rounded corners
    polygon(polyRound(points, fn = 20));
}

module cutting_tool_rotated(angle, extend_x_by, top_factor, bottom_factor) {
    translate(point_on_circle(r1 - cutting_tool_extrude / 2 - thickness / 2, angle))
    rotate(90 + angle, [0, 0, 1])
    rotate(90, [1, 0, 0])
    linear_extrude(cutting_tool_extrude, convexity = 5)
    cutting_tool(extend_x_by, top_factor, bottom_factor);
}

scale(scaling_factor_percent / 100)
    difference() {
        raw_bracelet();
        
        if (cut_degrees > 0) { color("green") cutting_tool_rotated(start_angle + cut_degrees, -cutting_tool_extend_x_by, start_cutting_tool_top_factor, start_cutting_tool_bottom_factor); } else {}
        
        if (cut_degrees > 0) { color("red") cutting_tool_rotated(end_angle - cut_degrees, +cutting_tool_extend_x_by, end_cutting_tool_top_factor, end_cutting_tool_bottom_factor); } else {}
    }
