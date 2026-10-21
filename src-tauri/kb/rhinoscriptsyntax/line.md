# rhinoscriptsyntax: line

## LineClosestPoint

```python
rs.LineClosestPoint(line, testpoint)
```

Finds the point on an infinite line that is closest to a test point

Arguments:

    line ([point, point]): List of 6 numbers or 2 Point3d.  Two 3-D points identifying the starting and ending points of the line.
    testpoint (point): List of 3 numbers or Point3d.  The test point.

Returns: point: the point on the line that is closest to the test point if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
line = (0,0,0), (5,5,0)
point = (15, 10, 0)
result = rs.LineClosestPoint( line, point)
if result: rs.AddPoint(result)
```

See also: LineIsFartherThan, LineMaxDistanceTo, LineMinDistanceTo, LinePlane, LineTransform

## LineCylinderIntersection

```python
rs.LineCylinderIntersection(line, cylinder_plane, cylinder_height, cylinder_radius)
```

Calculates the intersection of a line and a cylinder

Arguments:

    line (guid|line): the line to intersect
    cylinder_plane (plane): base plane of the cylinder
    cylinder_height (number): height of the cylinder
    cylinder_radius (number): radius of the cylinder

Returns: list(point, ...): list of intersection points (0, 1, or 2 points)

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.WorldXYPlane()
line = (-10,0,0), (10,0,10)
points = rs.LineCylinderIntersection(line, plane, cylinder_height=10, cylinder_radius=5)
if points:
    for point in points: rs.AddPoint(point)
```

See also: LineLineIntersection, LinePlaneIntersection, LineSphereIntersection

## LineIsFartherThan

```python
rs.LineIsFartherThan(line, distance, point_or_line)
```

Determines if the shortest distance from a line to a point or another
    line is greater than a specified distance

Arguments:

    line (line | [point, point]): List of 6 numbers, 2 Point3d, or Line.
    distance (number): the distance
    point_or_line (point|line) the test point or the test line

Returns: bool: True if the shortest distance from the line to the other project is
      greater than distance, False otherwise
None: on error

Example:

```python
import rhinoscriptsyntax as rs
line = (0,0,0), (10,10,0)
testPoint = (10,5,0)
print(rs.LineIsFartherThan(line, 3, testPoint))
```

See also: LineClosestPoint, LineMaxDistanceTo, LineMinDistanceTo, LinePlane, LineTransform

## LineLineIntersection

```python
rs.LineLineIntersection(lineA, lineB)
```

Calculates the intersection of two non-parallel lines. Note, the two
    lines do not have to intersect for an intersection to be found. (see help)

Arguments:

    lineA, lineB (line): lines to intersect

Returns: tuple(point, point): containing a point on the first line and a point on the second line if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
lineA = (1,1,0), (5,0,0)
lineB = (1,3,0), (5,5,0)
point = rs.LineLineIntersection(lineA, lineB)
if point:
    rs.AddPoint(point[0])
    rs.AddPoint(point[1])
```

See also: IntersectPlanes, LinePlaneIntersection, PlanePlaneIntersection

## LineMaxDistanceTo

```python
rs.LineMaxDistanceTo(line, point_or_line)
```

Finds the longest distance between a line as a finite chord, and a point
    or another line

Arguments:

    line (line | [point, point]): List of 6 numbers, two Point3d, or Line.
    point_or_line (point|line): the test point or test line.

Returns: number: A distance (D) such that if Q is any point on the line and P is any point on the other object, then D >= Rhino.Distance(Q, P).
None: on error

Example:

```python
import rhinoscriptsyntax as rs
line = (0,0,0), (10,10,0)
print(rs.LineMaxDistanceTo( line, (10,5,0) ))
```

See also: LineClosestPoint, LineIsFartherThan, LineMinDistanceTo, LinePlane, LineTransform

## LineMinDistanceTo

```python
rs.LineMinDistanceTo(line, point_or_line)
```

Finds the shortest distance between a line as a finite chord, and a point
    or another line

Arguments:

    line (line | [point, point]): List of 6 numbers, two Point3d, or Line.
    point_or_line (point|line): the test point or test line.

Returns: number: A distance (D) such that if Q is any point on the line and P is any point on the other object, then D <= Rhino.Distance(Q, P).
None: on error

Example:

```python
import rhinoscriptsyntax as rs
line = (0,0,0), (10,10,0)
print(rs.LineMinDistanceTo(line, (10,5,0)))
```

See also: LineClosestPoint, LineIsFartherThan, LineMaxDistanceTo, LinePlane, LineTransform

## LinePlane

```python
rs.LinePlane(line)
```

Returns a plane that contains the line. The origin of the plane is at the start of
    the line. If possible, a plane parallel to the world XY, YZ, or ZX plane is returned

Arguments:

    line (line | [point, point]):  List of 6 numbers, two Point3d, or Line.

Returns: plane: the plane if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
lineFrom = (0,0,0)
lineTo = (10,10,0)
distance = rs.Distance(lineFrom, lineTo)
plane = rs.LinePlane([lineFrom, lineTo])
rs.AddPlaneSurface( plane, distance, distance )
```

See also: LineClosestPoint, LineIsFartherThan, LineMaxDistanceTo, LineMinDistanceTo, LineTransform

## LinePlaneIntersection

```python
rs.LinePlaneIntersection(line, plane)
```

Calculates the intersection of a line and a plane.

Arguments:

    line ([point, point]): Two 3D points identifying the starting and ending points of the line to intersect.
    plane (plane): The plane to intersect.

Returns: point: The 3D point of intersection is successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.WorldXYPlane()
line = (2, 11, 13), (20, 4, -10)
point = rs.LinePlaneIntersection(line, plane)
if( point!=None ): rs.AddPoint(point)
```

See also: LineLineIntersection, PlanePlaneIntersection

## LineSphereIntersection

```python
rs.LineSphereIntersection(line, sphere_center, sphere_radius)
```

Calculates the intersection of a line and a sphere

Arguments:

    line (line | [point, point]): the line
    sphere_center (point): the center point of the sphere
    sphere_radius (number): the radius of the sphere

Returns: list(point, ...): list of intersection points if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
radius = 10
line = (-10,0,0), (10,0,10)
points = rs.LineSphereIntersection(line, (0,0,0), radius)
if points:
    for point in points: rs.AddPoint(point)
```

See also: LineCylinderIntersection, LineLineIntersection, LinePlaneIntersection

## LineTransform

```python
rs.LineTransform(line, xform)
```

Transforms a line

Arguments:

    line (guid): the line to transform
    xform (transform): the transformation to apply

Returns: guid: transformed line

Example:

```python
import rhinoscriptsyntax as rs
line = (0,0,0), (10,10,0)
rs.AddLine( line[0], line[1] )
plane = rs.WorldXYPlane()
xform = rs.XformRotation(30, plane.Zaxis, plane.Origin)
line = rs.LineTransform(line, xform)
rs.AddLine( line.From, line.To )
```

See also: LineClosestPoint, LineIsFartherThan, LineMaxDistanceTo, LineMinDistanceTo, LinePlane
