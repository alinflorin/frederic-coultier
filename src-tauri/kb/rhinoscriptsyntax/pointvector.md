# rhinoscriptsyntax: pointvector

## IsVectorParallelTo

```python
rs.IsVectorParallelTo(vector1, vector2)
```

Compares two vectors to see if they are parallel

Arguments:

    vector1, vector2 (vector): the vectors to compare

Returns: number: the value represents
        -1 = the vectors are anti-parallel
         0 = the vectors are not parallel
         1 = the vectors are parallel

Example:

```python
import rhinoscriptsyntax as rs
vector1 = (1,0,0)
vector2 = (0,1,0)
print(rs.IsVectorParallelTo( vector1, vector2 ))
```

See also: IsVectorPerpendicularTo, IsVectorTiny, IsVectorZero

## IsVectorPerpendicularTo

```python
rs.IsVectorPerpendicularTo(vector1, vector2)
```

Compares two vectors to see if they are perpendicular

Arguments:

    vector1, vector2 (vector): the vectors to compare

Returns: bool: True if vectors are perpendicular, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
vector1 = (1,0,0)
vector2 = (0,1,0)
print(rs.IsVectorPerpendicularTo( vector1, vector2 ))
```

See also: IsVectorParallelTo, IsVectorTiny, IsVectorZero

## IsVectorTiny

```python
rs.IsVectorTiny(vector)
```

Verifies that a vector is very short. The X,Y,Z elements are <= 1.0e-12

Arguments:

    vector (vector): the vector to check

Returns: bool: True if the vector is tiny, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
pt1 = rs.GetPoint("First point")
pt2 = rs.GetPoint("Next point")
vector = pt2 - pt1
if rs.IsVectorTiny(vector):
    print("The vector is tiny.")
else:
    print("The vector is not tiny.")
```

See also: IsVectorZero, VectorCreate

## IsVectorZero

```python
rs.IsVectorZero(vector)
```

Verifies that a vector is zero, or tiny. The X,Y,Z elements are equal to 0.0

Arguments:

    vector (vector): the vector to check

Returns: bool: True if the vector is zero, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
pt1 = rs.GetPoint("First point")
pt2 = rs.GetPoint("Next point")
vector = pt2 - pt1
if rs.IsVectorZero(vector):
    print("The vector is zero.")
else:
    print("The vector is not zero.")
```

See also: IsVectorTiny, VectorCreate

## PointAdd

```python
rs.PointAdd(point1, point2)
```

Adds a 3D point or a 3D vector to a 3D point

Arguments:

    point1, point2 (point): the points to add

Returns: point: the resulting 3D point if successful

Example:

```python
import rhinoscriptsyntax as rs
point1 = (1,1,1)
point2 = (2,2,2)
point = rs.PointAdd(point1, point2)
print(point)
```

See also: PointCompare, PointDivide, PointScale, PointSubtract, PointTransform

## PointArrayBoundingBox

```python
rs.PointArrayBoundingBox(points, view_or_plane=None, in_world_coords=True)
```

Returns either a world axis-aligned or a construction plane axis-aligned 
    bounding box of an array of 3-D point locations.

Arguments:

    points ([point, ...]): A list of 3-D points
    view_or_plane (str|plane, optional): Title or id of the view that contains the
        construction plane to which the bounding box should be aligned -or-
        user defined plane. If omitted, a world axis-aligned bounding box
        will be calculated
    in_world_coords (bool, optional): return the bounding box as world coordinates or
        construction plane coordinates. Note, this option does not apply to
        world axis-aligned bounding boxes.

Returns: list(point, ....): Eight points that define the bounding box. Points returned in counter-
clockwise order starting with the bottom rectangle of the box.
None: on error

See also: BoundingBox

## PointArrayClosestPoint

```python
rs.PointArrayClosestPoint(points, test_point)
```

Finds the point in a list of 3D points that is closest to a test point

Arguments:

    points ([point, ...]): list of points
    test_point (point): the point to compare against

Returns: number: index of the element in the point list that is closest to the test point

Example:

```python
import rhinoscriptsyntax as rs
cloud = rs.GetObject("Select point cloud")
if cloud:
    point = rs.GetPoint("Point to test")
    if point:
        cloud = rs.PointCloudPoints(cloud)
        index = rs.PointArrayClosestPoint(cloud, point)
        if index is not None:
            point_id = rs.AddPoint(cloud[index])
            rs.SelectObject( point_id )
```

See also: CurveClosestPoint, SurfaceClosestPoint

## PointArrayTransform

```python
rs.PointArrayTransform(points, xform)
```

Transforms a list of 3D points

Arguments:

    points ([point, ...]): list of 3D points
    xform (transform): transformation to apply

Returns: list(point, ...): transformed points on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
points = rs.BoundingBox(obj)
xform = rs.XformRotation2(45.0, (0,0,1), (0,0,0))
points = rs.PointArrayTransform(points, xform)
rs.AddPoints(points)
```

See also: PointArrayClosestPoint

## PointClosestObject

```python
rs.PointClosestObject(point, object_ids)
```

Finds the object that is closest to a test point

Arguments:

    point (point): point to test
    object_id ([guid, ...]): identifiers of one or more objects

Returns: list(guid, point): closest [0] object_id and [1] point on object on success
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select target objects for closest point", 63)
if objs:
    point = rs.GetPoint("Test point")
    if point:
        results = rs.PointClosestObject(point, objs)
        if results:
            print("Object id:{}".format(results[0]))
            rs.AddPoint( results[1] )
```

See also: CurveClosestObject

## PointCompare

```python
rs.PointCompare(point1, point2, tolerance=None)
```

Compares two 3D points

Arguments:

    point1, point2 (point): the points to compare
    tolerance (number, optional): tolerance to use for comparison. If omitted,
                                  Rhino's internal zero tolerance is used

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
point1 = (1,1,1)
point2 = (2,2,2)
print(rs.PointCompare(point1, point2))
```

See also: PointAdd, PointDivide, PointScale, PointSubtract, PointTransform

## PointDivide

```python
rs.PointDivide(point, divide)
```

Divides a 3D point by a value

Arguments:

    point (point): the point to divide
    divide (number): a non-zero value to divide

Returns: point: resulting point

Example:

```python
import rhinoscriptsyntax as rs
point = rs.PointDivide([5,5,0], 5)
print(point)
```

See also: PointAdd, PointCompare, PointScale, PointSubtract, PointTransform

## PointScale

```python
rs.PointScale(point, scale)
```

Scales a 3D point by a value

Arguments:

    point (point): the point to divide
    scale (number): scale factor to apply

Returns: point: resulting point on success

Example:

```python
import rhinoscriptsyntax as rs
point = rs.PointScale([1,0,0], 5)
print(point)
```

See also: PointAdd, PointCompare, PointDivide, PointSubtract, PointTransform

## PointSubtract

```python
rs.PointSubtract(point1, point2)
```

Subtracts a 3D point or a 3D vector from a 3D point

Arguments:

    point1, point2 (point): the points to subtract

Returns: point: the resulting 3D point if successful

Example:

```python
import rhinoscriptsyntax as rs
point1 = (1,1,1)
point2 = (2,2,2)
point = rs.PointSubtract(point1, point2)
print(point)
```

See also: PointAdd, PointCompare, PointDivide, PointScale, PointTransform

## PointTransform

```python
rs.PointTransform(point, xform)
```

Transforms a 3D point

Arguments:

    point (point): the point to transform
    xform (transform): a valid 4x4 transformation matrix

Returns: vector: transformed vector on success

Example:

```python
# Translate (move) objects by (10,10,0)
import rhinoscriptsyntax as rs
point = 5,5,0
matrix = rs.XformTranslation((10,10,0))
result = rs.PointTransform(point, matrix)
print(result)
```

See also: PointAdd, PointCompare, PointDivide, PointScale, PointSubtract

## PointsAreCoplanar

```python
rs.PointsAreCoplanar(points, tolerance=1.0e-12)
```

Verifies that a list of 3D points are coplanar

Arguments:

    points ([point, ...]): 3D points to test
    tolerance (number, optional): tolerance to use when verifying

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
def SurfacesAreCoplanar(srf1, srf2):
    if( not rs.IsSurface(srf1) or not rs.IsSurface(srf2) ): return False
    if( not rs.IsSurfacePlanar(srf1) or not rs.IsSurfacePlanar(srf2) ): return False
    pts1 = rs.SurfacePoints(srf1)
    pts2 = rs.SurfacePoints(srf2)
    if( pts1==None or pts2==None ): return False
    pts1.extend(pts2)
    return rs.PointsAreCoplanar(pts1)
       
x = rs.GetObject( "First surface to test", rs.filter.surface)
y = rs.GetObject( "Second surface to test", rs.filter.surface)
print(SurfacesAreCoplanar(x, y))
```

See also: IsPoint, IsPointCloud, PointCoordinates

## ProjectPointToMesh

```python
rs.ProjectPointToMesh(points, mesh_ids, direction)
```

Projects one or more points onto one or more meshes

Arguments:

    points ([point, ...]): one or more 3D points
    mesh_ids ([guid, ...]): identifiers of one or more meshes
    direction (vector): direction vector to project the points

Returns: list(point, ...): projected points on success

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh to project onto", rs.filter.mesh)
objects = rs.GetObjects("Select points to project", rs.filter.point)
points = [rs.PointCoordinates(obj) for obj in objects]
# project down...
results = rs.ProjectPointToMesh(points, mesh, (0,0,-1))
rs.AddPoints( results )
```

See also: ProjectCurveToMesh, ProjectCurveToSurface, ProjectPointToSurface

## ProjectPointToSurface

```python
rs.ProjectPointToSurface(points, surface_ids, direction)
```

Projects one or more points onto one or more surfaces or polysurfaces

Arguments:

    points ([point, ...]): one or more 3D points
    surface_ids ([guid, ...]): identifiers of one or more surfaces/polysurfaces
    direction (vector): direction vector to project the points

Returns: list(point, ...): projected points on success

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface to project onto", rs.filter.surface)
objects = rs.GetObjects("Select points to project", rs.filter.point)
points = [rs.PointCoordinates(obj) for obj in objects]
# Project down...
results = rs.ProjectPointToSurface(points, surface, (0,0,-1))
rs.AddPoints(results)
```

See also: ProjectCurveToMesh, ProjectCurveToSurface, ProjectPointToMesh

## PullPoints

```python
rs.PullPoints(object_id, points)
```

Pulls an array of points to a surface or mesh object. For more
    information, see the Rhino help file Pull command

Arguments:

    object_id (guid): the identifier of the surface or mesh object that pulls
    points ([point, ...]): list of 3D points

Returns: list(point, ...): 3D points pulled onto surface or mesh

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface that pulls", rs.filter.surface)
objects = rs.GetObjects("Select points to pull", rs.filter.point)
points = [rs.PointCoordinates(obj) for obj in objects]
results = rs.PullPoints( surface, points )
rs.AddPoints( results )
```

See also: PullCurve

## VectorAdd

```python
rs.VectorAdd(vector1, vector2)
```

Adds two 3D vectors

Arguments:

    vector1, vector2 (vector): the vectors to add

Returns: vector: the resulting 3D vector if successful

Example:

```python
import rhinoscriptsyntax as rs
vector1 = (1,0,0)
vector2 = (0,1,0)
vector = rs.VectorAdd(vector1, vector2)
print(vector)
```

See also: VectorCreate, VectorScale, VectorSubtract

## VectorAngle

```python
rs.VectorAngle(vector1, vector2)
```

Returns the angle, in degrees, between two 3-D vectors

Arguments:

    vector1 (vector): The first 3-D vector.
    vector2 (vector): The second 3-D vector.

Returns: number: The angle in degrees if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
s0 = rs.GetObject("Surface 0", rs.filter.surface)
s1 = rs.GetObject("Surface 1", rs.filter.surface)
du0 = rs.SurfaceDomain(s0, 0)
dv0 = rs.SurfaceDomain(s0, 1)
du1 = rs.SurfaceDomain(s1, 0)
dv1 = rs.SurfaceDomain(s1, 1)
n0 = rs.SurfaceNormal(s0, (du0[0], dv0[0]))
n1 = rs.SurfaceNormal(s1, (du1[0], dv1[0]))
print(rs.VectorAngle(n0, n1))
print(rs.VectorAngle(n0, rs.VectorReverse(n1)))
```

See also: Angle, Angle2

## VectorCompare

```python
rs.VectorCompare(vector1, vector2)
```

Compares two 3D vectors

Arguments:

    vector1, vector2 (vector): the two vectors to compare

Returns: number: result of comparing the vectors.
        -1 if vector1 is less than vector2
        0 if vector1 is equal to vector2
        1 if vector1 is greater than vector2

Example:

```python
import rhinoscriptsyntax as rs
vector1 = (1,0,0)
vector2 = (0,1,0)
rc = rs.VectorCompare(vector1 , vector2)
print(rc)
```

See also: IsVectorTiny, IsVectorZero, VectorCreate

## VectorCreate

```python
rs.VectorCreate(to_point, from_point)
```

Creates a vector from two 3D points

Arguments:

    to_point, from_point (point): the points defining the vector

Returns: vector: the resulting vector if successful

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("First point")
point2 = rs.GetPoint("Next point")
vector = rs.VectorCreate(point2, point1)
print(vector)
```

See also: IsVectorTiny, IsVectorZero, VectorCompare, VectorUnitize

## VectorCrossProduct

```python
rs.VectorCrossProduct(vector1, vector2)
```

Calculates the cross product of two 3D vectors

Arguments:

    vector1, vector2 (vector): the vectors to perform cross product on

Returns: vector: the resulting cross product direction if successful

Example:

```python
import rhinoscriptsyntax as rs
vector1 = (1,0,0)
vector2 = (0,1,0)
vector = rs.VectorCrossProduct(vector1, vector2)
print(vector)
```

See also: VectorDotProduct, VectorUnitize

## VectorDivide

```python
rs.VectorDivide(vector, divide)
```

Divides a 3D vector by a value

Arguments:

    vector (vector): the vector to divide
    divide (number): a non-zero value to divide

Returns: vector: resulting vector on success

Example:

```python
import rhinoscriptsyntax as rs
vector = rs.VectorDivide((5,5,0), 5)
print(vector)
```

See also: VectorAdd, VectorCreate, VectorSubtract

## VectorDotProduct

```python
rs.VectorDotProduct(vector1, vector2)
```

Calculates the dot product of two 3D vectors

Arguments:

    vector1, vector2 (vector): the vectors to perform the dot product on

Returns: vector: the resulting dot product if successful

Example:

```python
import rhinoscriptsyntax as rs
vector1 = [1,0,0]
vector2 = [0,1,0]
dblDotProduct = rs.VectorDotProduct(vector1, vector2)
print(dblDotProduct)
```

See also: VectorCrossProduct, VectorUnitize

## VectorLength

```python
rs.VectorLength(vector)
```

Returns the length of a 3D vector

Arguments:

    vector (vector):  The 3-D vector.

Returns: number: The length of the vector if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("First point")
point2 = rs.GetPoint("Next point")
vector = rs.VectorCreate(point1, point2)
print(rs.VectorLength(vector))
```

See also: VectorAdd, VectorCreate, VectorSubtract, VectorUnitize

## VectorMultiply

```python
rs.VectorMultiply(vector1, vector2)
```

Multiplies two 3D vectors

Arguments:

    vector1, vector2 (vector): the vectors to multiply

Returns: vector: the resulting inner (dot) product if successful

Example:

```python
import rhinoscriptsyntax as rs
product = rs.VectorMultiply( [2,2,2], [3,3,3] )
print(product)
```

See also: VectorAdd, VectorCreate, VectorSubtract

## VectorReverse

```python
rs.VectorReverse(vector)
```

Reverses the direction of a 3D vector

Arguments:

    vector (vector): the vector to reverse

Returns: vector: reversed vector on success

Example:

```python
import rhinoscriptsyntax as rs
vector = rs.VectorReverse([1,0,0])
print(vector)
```

See also: VectorCreate, VectorUnitize

## VectorRotate

```python
rs.VectorRotate(vector, angle_degrees, axis)
```

Rotates a 3D vector

Arguments:

    vector (vector): the vector to rotate
    angle_degrees (number): rotation angle
    axis (vector): axis of rotation

Returns: vector: rotated vector on success

Example:

```python
import rhinoscriptsyntax as rs
vector = rs.VectorRotate([1,0,0], 90.0, [0,0,1])
print(vector)
```

See also: VectorCreate, VectorScale

## VectorScale

```python
rs.VectorScale(vector, scale)
```

Scales a 3-D vector

Arguments:

    vector (vector): the vector to scale
    scale (number): scale factor to apply

Returns: vector: resulting vector on success

Example:

```python
import rhinoscriptsyntax as rs
vector = rs.VectorScale([1,0,0], 5)
print(vector)
```

See also: VectorAdd, VectorCreate, VectorSubtract

## VectorSubtract

```python
rs.VectorSubtract(vector1, vector2)
```

Subtracts two 3D vectors

Arguments:

    vector1 (vector): the vector to subtract from
    vector2 (vector): the vector to subtract

Returns: vector: the resulting 3D vector

Example:

```python
import rhinoscriptsyntax as rs
vector1 = [1,0,0]
vector2 = [0,1,0]
vector = rs.VectorSubtract(vector1, vector2)
print(vector)
```

See also: VectorAdd, VectorCreate, VectorScale

## VectorTransform

```python
rs.VectorTransform(vector, xform)
```

Transforms a 3D vector

Arguments:

    vector (vector): the vector to transform
    xform (transform): a valid 4x4 transformation matrix

Returns: vector: transformed vector on success

Example:

```python
import rhinoscriptsyntax as rs
vector = (1,0,0) #world x-axis
xform = rs.XformRotation2(90.0, (0,0,1), (0,0,0))
vector = rs.VectorTransform(vector, xform)
print(vector)
```

See also: IsVectorZero, VectorCreate, VectorUnitize

## VectorUnitize

```python
rs.VectorUnitize(vector)
```

Unitizes, or normalizes a 3D vector. Note, zero vectors cannot be unitized

Arguments:

    vector (vector): the vector to unitize

Returns: vector: unitized vector on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
vector = rs.VectorUnitize( [1.5,-4.1,3.6] )
print(vector)
```

See also: IsVectorZero, VectorCreate
