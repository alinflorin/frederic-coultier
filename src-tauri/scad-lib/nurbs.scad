// NURBS curves and surfaces.
//
//   use <nurbs.scad>
//
// Control points may be 2D or 3D. Weights default to 1 (a plain B-spline). Knots default to a
// uniform clamped vector (the curve starts and ends on the first and last control point); with
// closed=true the control polygon wraps around and the curve is a smooth loop.
//
// Curves:
//   nurbs_point(ctrl, u, degree=3, weights, knots, closed=false)       one point, u in [0,1]
//   nurbs_curve(ctrl, degree=3, weights, knots, closed=false, steps=32) list of points
// Surfaces (ctrl is a grid: rows along u, columns along v):
//   nurbs_surface(grid, degree=3, weights, closed=[false,false], steps=[16,16]) grid of points
//   module grid_polyhedron(pts, closed=[false,false], flip=false)
//
// degree, closed and steps take one value for both directions or [u, v].

// ---- knots ---------------------------------------------------------------------------------

// n control points, degree p: n+p+1 knots, 0 repeated p+1 times, 1 repeated p+1 times.
function nurbs_clamped_knots(n, p) =
    [for (i = [0 : n + p]) i <= p ? 0 : i >= n ? 1 : (i - p) / (n - p)];

// n control points, degree p: n+p+1 evenly spaced knots, the curve lives on [p, n].
function nurbs_uniform_knots(n, p) = [for (i = [0 : n + p]) i];

// ---- evaluation ----------------------------------------------------------------------------

// Index k of the knot span holding u (U[k] <= u < U[k+1]), clamped to [p, n-1].
function _nurbs_span(U, p, n, u, k) =
    let(k = is_undef(k) ? p : k)
    k >= n - 1 || u < U[k + 1] ? k : _nurbs_span(U, p, n, u, k + 1);

// de Boor's algorithm. d holds the p+1 homogeneous points of span k; pass r = 1.
function _nurbs_deboor(d, r, p, k, u, U) =
    r > p ? d[p]
    : _nurbs_deboor(
        [for (j = [0 : p])
            j < r ? d[j]
            : let(a = (u - U[j + k - p]) / (U[j + 1 + k - r] - U[j + k - p]))
              (1 - a) * d[j - 1] + a * d[j]],
        r + 1, p, k, u, U);

// Point on the curve with homogeneous control points Pw (each [x*w, y*w, (z*w,) w]), knots U,
// at parameter t in [0, 1] mapped onto the curve's domain [U[p], U[n]].
function _nurbs_eval_h(Pw, p, U, t) =
    let(n = len(Pw),
        u = U[p] + t * (U[n] - U[p]),
        k = _nurbs_span(U, p, n, u))
    _nurbs_deboor([for (j = [0 : p]) Pw[j + k - p]], 1, p, k, u, U);

function _nurbs_unh(h) = let(d = len(h) - 1) [for (i = [0 : d - 1]) h[i] / h[d]];

// Homogeneous control points and knots for one direction. A closed curve repeats its first p
// points (and weights) at the end over uniform knots, which makes the loop C(p-1) smooth.
function _nurbs_setup(ctrl, p, weights, knots, closed) =
    let(w = is_undef(weights) ? [for (c = ctrl) 1] : weights,
        pts = closed ? concat(ctrl, [for (i = [0 : p - 1]) ctrl[i]]) : ctrl,
        ws = closed ? concat(w, [for (i = [0 : p - 1]) w[i]]) : w,
        n = len(pts),
        U = !is_undef(knots) ? knots
            : closed ? nurbs_uniform_knots(n, p)
            : nurbs_clamped_knots(n, p))
    assert(len(ctrl) > p, "nurbs: need more control points than the degree")
    assert(len(U) == n + p + 1, str("nurbs: expected ", n + p + 1, " knots, got ", len(U)))
    [[for (i = [0 : n - 1]) concat(pts[i] * ws[i], [ws[i]])], U];

function nurbs_point(ctrl, u, degree = 3, weights, knots, closed = false) =
    let(s = _nurbs_setup(ctrl, degree, weights, knots, closed))
    _nurbs_unh(_nurbs_eval_h(s[0], degree, s[1], u));

// steps+1 points from u=0 to u=1, or steps points for a closed curve (the loop isn't repeated).
function nurbs_curve(ctrl, degree = 3, weights, knots, closed = false, steps = 32) =
    let(s = _nurbs_setup(ctrl, degree, weights, knots, closed))
    [for (i = [0 : closed ? steps - 1 : steps])
        _nurbs_unh(_nurbs_eval_h(s[0], degree, s[1], i / steps))];

// ---- surfaces ------------------------------------------------------------------------------

function _nurbs_pair(v) = is_list(v) ? v : [v, v];

// Tensor-product surface. Evaluates every column at u (in homogeneous space, so weights stay
// exact), then the resulting row at v. Returns a grid of points: rows along u, columns along v.
function nurbs_surface(grid, degree = 3, weights, closed = false, steps = 16) =
    let(p = _nurbs_pair(degree), c = _nurbs_pair(closed), st = _nurbs_pair(steps),
        rows = len(grid), cols = len(grid[0]),
        w = is_undef(weights) ? [for (r = grid) [for (q = r) 1]] : weights,
        // one homogeneous curve per column, along u
        colsetup = [for (j = [0 : cols - 1])
            _nurbs_setup([for (i = [0 : rows - 1]) grid[i][j]], p[0], [for (i = [0 : rows - 1]) w[i][j]],
                         undef, c[0])],
        // knots along v, from the first row's setup
        vU = _nurbs_setup(grid[0], p[1], w[0], undef, c[1])[1],
        nu = c[0] ? st[0] - 1 : st[0],
        nv = c[1] ? st[1] - 1 : st[1])
    [for (a = [0 : nu])
        let(row = [for (cs = colsetup) _nurbs_eval_h(cs[0], p[0], cs[1], a / st[0])],
            // wrap the homogeneous row for a closed v direction
            rw = c[1] ? concat(row, [for (i = [0 : p[1] - 1]) row[i]]) : row)
        [for (b = [0 : nv]) _nurbs_unh(_nurbs_eval_h(rw, p[1], vU, b / st[1]))]];

function _grid_id(i, j, R, C) = (i % R) * C + (j % C);

// A polyhedron through a grid of points (rows along u, columns along v). Directions that are
// not closed leave an open edge; when exactly one is closed the two open ends are capped, which
// gives a solid tube. Set flip=true if the result renders inside out.
module grid_polyhedron(pts, closed = false, flip = false) {
    c = _nurbs_pair(closed);
    R = len(pts);
    C = len(pts[0]);
    quads = [for (i = [0 : (c[0] ? R : R - 1) - 1], j = [0 : (c[1] ? C : C - 1) - 1])
        [_grid_id(i, j, R, C), _grid_id(i + 1, j, R, C), _grid_id(i + 1, j + 1, R, C), _grid_id(i, j + 1, R, C)]];
    // each cap runs along the shared edge opposite to the quads, so the shell stays consistent
    caps = c[1] && !c[0] ? [[for (j = [0 : C - 1]) _grid_id(0, j, R, C)], [for (j = [C - 1 : -1 : 0]) _grid_id(R - 1, j, R, C)]]
         : c[0] && !c[1] ? [[for (i = [R - 1 : -1 : 0]) _grid_id(i, 0, R, C)], [for (i = [0 : R - 1]) _grid_id(i, C - 1, R, C)]]
         : [];
    faces = concat(quads, caps);
    polyhedron([for (r = pts) each r], flip ? [for (f = faces) [for (k = [len(f) - 1 : -1 : 0]) f[k]]] : faces);
}
