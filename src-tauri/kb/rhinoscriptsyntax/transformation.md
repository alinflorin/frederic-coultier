# rhinoscriptsyntax: transformation

## IsXformIdentity

```python
rs.IsXformIdentity(xform)
```

Verifies a matrix is the identity matrix

Arguments:

    xform (transform): List or Rhino.Geometry.Transform.  A 4x4 transformation matrix.

Returns: bool: True or False indicating success or failure.

Example:

```python
import rhinoscriptsyntax as rs
xform = rs.XformIdentity()
print(rs.IsXformIdentity(xform))
```

See also: IsXformSimilarity, IsXformZero, XformIdentity

## IsXformSimilarity

```python
rs.IsXformSimilarity(xform)
```

Verifies a matrix is a similarity transformation. A similarity
    transformation can be broken into a sequence of dialations, translations,
    rotations, and reflections

Arguments:

    xform (transform): List or Rhino.Geometry.Transform.  A 4x4 transformation matrix.

Returns: bool: True if this transformation is an orientation preserving similarity, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
xform = rs.BlockInstanceXform(block)
print(rs.IsXformSimilarity(xform))
```

See also: IsXformIdentity, IsXformZero

## IsXformZero

```python
rs.IsXformZero(xform)
```

verifies that a matrix is a zero transformation matrix

Arguments:

    xform (transform): List or Rhino.Geometry.Transform.  A 4x4 transformation matrix.

Returns: bool: True or False indicating success or failure.

Example:

```python
import rhinoscriptsyntax as rs
xform = rs.XformZero()
print(rs.IsXformZero(xform))
```

See also: IsXformIdentity, IsXformSimilarity, XformZero

## XformCPlaneToWorld

```python
rs.XformCPlaneToWorld(point, plane)
```

Transform point from construction plane coordinates to world coordinates

Arguments:

    point (point): A 3D point in construction plane coordinates.
    plane (plane): The construction plane

Returns: point: A 3D point in world coordinates

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.ViewCPlane()
point = rs.XFormCPlaneToWorld([0,0,0], plane)
if point: print("World point: {}".format(point))
```

See also: XformWorldToCPlane

## XformChangeBasis

```python
rs.XformChangeBasis(initial_plane, final_plane)
```

Returns a change of basis transformation matrix or None on error

Arguments:

    initial_plane (plane): the initial plane
    final_plane (plane): the final plane

Returns: transform: The 4x4 transformation matrix if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
import math
objs = rs.GetObjects("Select objects to shear")
if objs:
    cplane = rs.ViewCPlane()
    cob = rs.XformChangeBasis(rs.WorldXYPlane(), cplane)
    shear2d = rs.XformIdentity()
    shear2d[0,2] = math.tan(math.radians(45.0))
    cob_inverse = rs.XformChangeBasis(cplane, rs.WorldXYPlane())
    temp = rs.XformMultiply(shear2d, cob)
    xform = rs.XformMultiply(cob_inverse, temp)
    rs.TransformObjects( objs, xform, True )
```

See also: XformCPlaneToWorld, XformWorldToCPlane

## XformChangeBasis2

```python
rs.XformChangeBasis2(x0,y0,z0,x1,y1,z1)
```

Returns a change of basis transformation matrix of None on error

Arguments:

    x0,y0,z0 (vector): initial basis
    x1,y1,z1 (vector): final basis

Returns: transform: The 4x4 transformation matrix if successful
None: if not successful

## XformCompare

```python
rs.XformCompare(xform1, xform2)
```

Compares two transformation matrices

Arguments:

    xform1, xform2 = matrices to compare

Returns: number:
-1 if xform1<xform2
 1 if xform1>xform2
 0 if xform1=xform2

Example:

```python
import rhinoscriptsyntax as rs
xform0 = rs.XformZero()
xform1 = rs.XformIdentity()
print(rs.XformCompare(xform0, xform1))
```

See also: IsXformIdentity, IsXformSimilarity, IsXformZero

## XformDeterminant

```python
rs.XformDeterminant(xform)
```

Returns the determinant of a transformation matrix. If the determinant
    of a transformation matrix is 0, the matrix is said to be singular. Singular
    matrices do not have inverses.

Arguments:

    xform (transform): List or Rhino.Geometry.Transform.  A 4x4 transformation matrix.

Returns: number: The determinant if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
xform = rs.BlockInstanceXform(obj)
if xform: print(rs.XformDeterminant(xform))
```

See also: XformInverse

## XformDiagonal

```python
rs.XformDiagonal(diagonal_value)
```

Returns a diagonal transformation matrix. Diagonal matrices are 3x3 with
    the bottom row [0,0,0,1]

Arguments:

    diagonal_value (number): the diagonal value

Returns: transform: The 4x4 transformation matrix if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
def printmatrix(xform):
    for i in range(4):
        print("[{}, {}, {}, {}]".format(xform[i,0], xform[i,1], xform[i,2], xform[i,3]))
printmatrix(rs.XformDiagonal(3))
```

See also: XformIdentity, XformZero

## XformIdentity

```python
rs.XformIdentity()
```

returns the identity transformation matrix

Returns: transform: The 4x4 transformation matrix

Example:

```python
import rhinoscriptsyntax as rs
def printmatrix(xform):
    for i in range(4):
        print("[{}, {}, {}, {}]".format(xform[i,0], xform[i,1], xform[i,2], xform[i,3]))
printmatrix(rs.XformIdentity())
```

See also: XformDiagonal, XformZero

## XformInverse

```python
rs.XformInverse(xform)
```

Returns the inverse of a non-singular transformation matrix

Arguments:

    xform (transform): List or Rhino.Geometry.Transform.  A 4x4 transformation matrix.

Returns: transform: The inverted 4x4 transformation matrix if successful.
None: if matrix is non-singular or on error.

Example:

```python
import rhinoscriptsyntax as rs
xform = rs.BlockInstanceXform(obj)
if xform:
    rs.TransformObject( obj, rs.XformInverse(xform) )
```

See also: XformDeterminant

## XformMirror

```python
rs.XformMirror(mirror_plane_point, mirror_plane_normal)
```

Creates a mirror transformation matrix

Arguments:

    mirror_plane_point (point): point on the mirror plane
    mirror_plane_normal (vector): a 3D vector that is normal to the mirror plane

Returns: transform: mirror Transform matrix

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to mirror")
if objs:
    plane = rs.ViewCPlane()
    xform = rs.XformMirror(plane.Origin, plane.Normal)
    rs.TransformObjects( objs, xform, True )
```

See also: XformPlanarProjection, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformScale, XformShear, XformTranslation

## XformMultiply

```python
rs.XformMultiply(xform1, xform2)
```

Multiplies two transformation matrices, where result = xform1 * xform2

Arguments:

    xform1 (transform): List or Rhino.Geometry.Transform.  The first 4x4 transformation matrix to multiply.
    xform2 (transform): List or Rhino.Geometry.Transform.  The second 4x4 transformation matrix to multiply.

Returns: transform: result transformation on success

Example:

```python
import rhinoscriptsyntax as rs
import math
objs = rs.GetObjects("Select objects to shear")
if objs:
    cplane = rs.ViewCPlane()
    cob = rs.XformChangeBasis(rs.WorldXYPlane(), cplane)
    shear2d = rs.XformIdentity()
    shear2d[0,2] = math.tan(math.radians(45.0))
    cob_inv = rs.XformChangeBasis(cplane, rs.WorldXYPlane())
    temp = rs.XformMultiply(shear2d, cob)
    xform = rs.XformMultiply(cob_inv, temp)
    rs.TransformObjects( objs, xform, True )
```

See also: XformPlanarProjection, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformScale, XformShear, XformTranslation

## XformPlanarProjection

```python
rs.XformPlanarProjection(plane)
```

Returns a transformation matrix that projects to a plane.

Arguments:

    plane (plane): The plane to project to.

Returns: transform: The 4x4 transformation matrix.

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to project")
if objects:
    cplane = rs.ViewCPlane()
    xform = rs.XformPlanarProjection(cplane)
    rs.TransformObjects( objects, xform, True )
```

See also: XformMirror, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformScale, XformShear, XformTranslation

## XformRotation1

```python
rs.XformRotation1(initial_plane, final_plane)
```

Returns a rotation transformation that maps initial_plane to final_plane.
    The planes should be right hand orthonormal planes.

Arguments:

    initial_plane (plane): plane to rotate from
    final_plane (plane): plane to rotate to

Returns: transform: The 4x4 transformation matrix.
None: on error.

## XformRotation2

```python
rs.XformRotation2(angle_degrees, rotation_axis, center_point)
```

Returns a rotation transformation around an axis

Arguments:

    angle_degrees (number): rotation angle in degrees
    rotation_axis (vector): rotation axis
    center_point (point): rotation center

Returns: transform: The 4x4 transformation matrix.
None: on error.

## XformRotation3

```python
rs.XformRotation3( start_direction, end_direction, center_point )
```

Calculate the minimal transformation that rotates start_direction to
    end_direction while fixing center_point

Arguments:

    start_direction, end_direction (vector): 3d vectors
    center_point (point): the rotation center

Returns: transform: The 4x4 transformation matrix.
None: on error.

## XformRotation4

```python
rs.XformRotation4(x0, y0, z0, x1, y1, z1)
```

Returns a rotation transformation.

Arguments:

    x0,y0,z0 (vector): Vectors defining the initial orthonormal frame
    x1,y1,z1 (vector): Vectors defining the final orthonormal frame

Returns: transform: The 4x4 transformation matrix.
None: on error.

## XformScale

```python
rs.XformScale(scale, point=None)
```

Creates a scale transformation

Arguments:

    scale (number|point|vector|[number, number, number]): single number, list of 3 numbers, Point3d, or Vector3d
    point (point, optional): center of scale. If omitted, world origin is used

Returns: transform: The 4x4 transformation matrix on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to scale")
if objs:
    xform = rs.XformScale( (3.0,1.0,1.0) )
    rs.TransformObjects( objs, xform, True)
```

See also: XformMirror, XformPlanarProjection, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformShear, XformTranslation

## XformScreenToWorld

```python
rs.XformScreenToWorld(point, view=None, screen_coordinates=False)
```

Transforms a point from either client-area coordinates of the specified view
    or screen coordinates to world coordinates. The resulting coordinates are represented
    as a 3-D point

Arguments:

    point (point): 2D point
    view (str, optional): title or identifier of a view. If omitted, the active view is used
    screen_coordinates (bool, optional): if False, point is in client-area coordinates. If True,
    point is in screen-area coordinates

Returns: point: on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
point2d = 200,100
view = rs.CurrentView()
point = rs.XformScreenToWorld(point2d, view)
print(point)
```

See also: XformWorldToScreen

## XformShear

```python
rs.XformShear(plane, x, y, z)
```

Returns a shear transformation matrix

Arguments:

    plane (plane): plane[0] is the fixed point
    x,y,z (number): each axis scale factor

Returns: transform: The 4x4 transformation matrix on success

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to shear")
if objects:
    cplane = rs.ViewCPlane()
    xform = rs.XformShear(cplane, (1,1,0), (-1,1,0), (0,0,1))
    rs.TransformObjects(objects, xform, True)
```

See also: XformMirror, XformPlanarProjection, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformScale, XformTranslation

## XformTranslation

```python
rs.XformTranslation(vector)
```

Creates a translation transformation matrix

Arguments:

    vector (vector): List of 3 numbers, Point3d, or Vector3d.  A 3-D translation vector.

Returns: transform: The 4x4 transformation matrix is successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to copy")
if objs:
    xform = rs.XformTranslation([1,0,0])
    rs.TransformObjects( objs, xform, True )
```

See also: XformMirror, XformPlanarProjection, XformRotation1, XformRotation2, XformRotation3, XformRotation4, XformScale, XformShear

## XformWorldToCPlane

```python
rs.XformWorldToCPlane(point, plane)
```

Transforms a point from world coordinates to construction plane coordinates.

Arguments:

    point (point): A 3D point in world coordinates.
    plane (plane): The construction plane

Returns: (point): 3D point in construction plane coordinates

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.ViewCPlane()
point = rs.XformWorldToCPlane([0,0,0], plane)
if point: print("CPlane point:{}".format(point))
```

See also: XformCPlaneToWorld

## XformWorldToScreen

```python
rs.XformWorldToScreen(point, view=None, screen_coordinates=False)
```

Transforms a point from world coordinates to either client-area coordinates of
    the specified view or screen coordinates. The resulting coordinates are represented
    as a 2D point

Arguments:

    point (point): 3D point in world coordinates
    view (str, optional): title or identifier of a view. If omitted, the active view is used
    screen_coordinates (bool, optional): if False, the function returns the results as
      client-area coordinates. If True, the result is in screen-area coordinates

Returns: (point): 2D point on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
point = (0.0, 0.0, 0.0)
view = rs.CurrentView()
point2d = rs.XformWorldToScreen(point, view)
print(point2d)
```

See also: XformScreenToWorld

## XformZero

```python
rs.XformZero()
```

Returns a zero transformation matrix

Returns: transform: a zero transformation matrix

Example:

```python
import rhinoscriptsyntax as rs
def printmatrix(xform):
    for i in range(4):
        print("[{}, {}, {}, {}]".format(xform[i,0], xform[i,1], xform[i,2], xform[i,3]))
printmatrix( rs.XformZero() )
```

See also: XformDiagonal, XformIdentity
