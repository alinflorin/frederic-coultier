//! A bounding-volume hierarchy over a triangle mesh, for ray and box queries.

use crate::mesh::Mesh;

pub type V3 = [f64; 3];

#[derive(Clone, Copy)]
struct Node {
    lo: V3,
    hi: V3,
    /// Inner node: index of the left child (the right child follows the left subtree
    /// in `order`); leaf: first triangle slot.
    a: u32,
    /// Leaf: triangle count. Inner node: 0.
    count: u32,
    right: u32,
}

pub struct Bvh<'a> {
    mesh: &'a Mesh,
    nodes: Vec<Node>,
    order: Vec<u32>,
    boxes: Vec<(V3, V3)>,
}

fn tri_box(m: &Mesh, t: usize) -> (V3, V3) {
    let [a, b, c] = m.tris[t].map(|i| m.verts[i as usize]);
    let mut lo = a;
    let mut hi = a;
    for p in [b, c] {
        for k in 0..3 {
            lo[k] = lo[k].min(p[k]);
            hi[k] = hi[k].max(p[k]);
        }
    }
    (lo, hi)
}

impl<'a> Bvh<'a> {
    pub fn new(mesh: &'a Mesh) -> Self {
        let boxes: Vec<_> = (0..mesh.tris.len()).map(|t| tri_box(mesh, t)).collect();
        let mut order: Vec<u32> = (0..mesh.tris.len() as u32).collect();
        let mut nodes = Vec::new();
        if !order.is_empty() {
            let n = order.len();
            build(&boxes, &mut order, 0, n, &mut nodes);
        }
        Bvh {
            mesh,
            nodes,
            order,
            boxes,
        }
    }

    fn tri(&self, t: usize) -> [V3; 3] {
        self.mesh.tris[t].map(|i| self.mesh.verts[i as usize])
    }

    /// Nearest hit along `p + t d` (unit `d`) with `1e-4 < t <= max`, ignoring triangle
    /// `skip` and, when `share_with_skip`, any triangle sharing a vertex with it.
    /// Returns the distance.
    pub fn ray(
        &self,
        p: V3,
        d: V3,
        skip: Option<usize>,
        share_with_skip: bool,
        max: f64,
    ) -> Option<f64> {
        if self.nodes.is_empty() {
            return None;
        }
        let inv = d.map(|x| if x.abs() < 1e-12 { 1e12 } else { 1.0 / x });
        let mut best = max;
        let mut found = false;
        let mut stack = vec![0u32];
        while let Some(ni) = stack.pop() {
            let n = &self.nodes[ni as usize];
            if !slab(p, inv, n.lo, n.hi, best) {
                continue;
            }
            if n.count > 0 {
                for s in n.a..n.a + n.count {
                    let t = self.order[s as usize] as usize;
                    if Some(t) == skip {
                        continue;
                    }
                    if share_with_skip && skip.is_some_and(|k| shares_vertex(self.mesh, t, k)) {
                        continue;
                    }
                    let [a, b, c] = self.tri(t);
                    if let Some(h) = moller(p, d, a, b, c)
                        && h > 1e-4 && h <= best {
                            best = h;
                            found = true;
                        }
                }
            } else {
                stack.push(n.a);
                stack.push(n.right);
            }
        }
        found.then_some(best)
    }

    /// Triangles whose box overlaps `[lo, hi]`.
    pub fn overlapping(&self, lo: V3, hi: V3, out: &mut Vec<usize>) {
        out.clear();
        if self.nodes.is_empty() {
            return;
        }
        let mut stack = vec![0u32];
        while let Some(ni) = stack.pop() {
            let n = &self.nodes[ni as usize];
            if (0..3).any(|k| n.hi[k] < lo[k] || n.lo[k] > hi[k]) {
                continue;
            }
            if n.count > 0 {
                for s in n.a..n.a + n.count {
                    let t = self.order[s as usize] as usize;
                    let (blo, bhi) = self.boxes[t];
                    if (0..3).all(|k| bhi[k] >= lo[k] && blo[k] <= hi[k]) {
                        out.push(t);
                    }
                }
            } else {
                stack.push(n.a);
                stack.push(n.right);
            }
        }
    }
}

pub fn shares_vertex(m: &Mesh, a: usize, b: usize) -> bool {
    m.tris[a].iter().any(|v| m.tris[b].contains(v))
}

fn build(
    boxes: &[(V3, V3)],
    order: &mut [u32],
    start: usize,
    end: usize,
    nodes: &mut Vec<Node>,
) -> u32 {
    let mut lo = [f64::MAX; 3];
    let mut hi = [f64::MIN; 3];
    for &t in &order[start..end] {
        let (l, h) = boxes[t as usize];
        for k in 0..3 {
            lo[k] = lo[k].min(l[k]);
            hi[k] = hi[k].max(h[k]);
        }
    }
    let me = nodes.len() as u32;
    nodes.push(Node {
        lo,
        hi,
        a: start as u32,
        count: (end - start) as u32,
        right: 0,
    });
    if end - start <= 4 {
        return me;
    }
    let axis = (0..3)
        .max_by(|&i, &j| (hi[i] - lo[i]).total_cmp(&(hi[j] - lo[j])))
        .unwrap();
    let mid = (start + end) / 2;
    let centre = |t: &u32| {
        let (l, h) = boxes[*t as usize];
        l[axis] + h[axis]
    };
    order[start..end].select_nth_unstable_by(mid - start, |x, y| centre(x).total_cmp(&centre(y)));
    let left = build(boxes, order, start, mid, nodes);
    let right = build(boxes, order, mid, end, nodes);
    let n = &mut nodes[me as usize];
    n.count = 0;
    n.a = left;
    n.right = right;
    me
}

fn slab(p: V3, inv: V3, lo: V3, hi: V3, max: f64) -> bool {
    let (mut t0, mut t1) = (0.0f64, max);
    for k in 0..3 {
        let (a, b) = ((lo[k] - p[k]) * inv[k], (hi[k] - p[k]) * inv[k]);
        t0 = t0.max(a.min(b));
        t1 = t1.min(a.max(b));
        if t0 > t1 {
            return false;
        }
    }
    true
}

pub fn moller(p: V3, d: V3, a: V3, b: V3, c: V3) -> Option<f64> {
    let sub = |x: V3, y: V3| [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
    let cross = |x: V3, y: V3| {
        [
            x[1] * y[2] - x[2] * y[1],
            x[2] * y[0] - x[0] * y[2],
            x[0] * y[1] - x[1] * y[0],
        ]
    };
    let dot = |x: V3, y: V3| x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    let (e1, e2) = (sub(b, a), sub(c, a));
    let pv = cross(d, e2);
    let det = dot(e1, pv);
    if det.abs() < 1e-12 {
        return None;
    }
    let inv = 1.0 / det;
    let tv = sub(p, a);
    let u = dot(tv, pv) * inv;
    if !(0.0..=1.0).contains(&u) {
        return None;
    }
    let q = cross(tv, e1);
    let v = dot(d, q) * inv;
    if v < 0.0 || u + v > 1.0 {
        return None;
    }
    Some(dot(e2, q) * inv)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cube() -> Mesh {
        let v = vec![
            [0., 0., 0.],
            [1., 0., 0.],
            [1., 1., 0.],
            [0., 1., 0.],
            [0., 0., 1.],
            [1., 0., 1.],
            [1., 1., 1.],
            [0., 1., 1.],
        ];
        let t = vec![
            [0, 2, 1],
            [0, 3, 2],
            [4, 5, 6],
            [4, 6, 7],
            [0, 1, 5],
            [0, 5, 4],
            [1, 2, 6],
            [1, 6, 5],
            [2, 3, 7],
            [2, 7, 6],
            [3, 0, 4],
            [3, 4, 7],
        ];
        Mesh { verts: v, tris: t }
    }

    #[test]
    fn ray_finds_the_near_wall() {
        let m = cube();
        let b = Bvh::new(&m);
        let d = b
            .ray([0.5, 0.5, -2.0], [0.0, 0.0, 1.0], None, false, 10.0)
            .unwrap();
        assert!((d - 2.0).abs() < 1e-9);
        assert!(
            b.ray([0.5, 0.5, -2.0], [0.0, 0.0, 1.0], None, false, 1.0)
                .is_none()
        );
        assert!(
            b.ray([5.0, 5.0, -2.0], [0.0, 0.0, 1.0], None, false, 10.0)
                .is_none()
        );
    }

    #[test]
    fn box_query_finds_overlaps() {
        let m = cube();
        let b = Bvh::new(&m);
        let mut out = Vec::new();
        b.overlapping([0.9, 0.9, 0.9], [2.0, 2.0, 2.0], &mut out);
        assert!(!out.is_empty());
        b.overlapping([5.0, 5.0, 5.0], [6.0, 6.0, 6.0], &mut out);
        assert!(out.is_empty());
    }
}
