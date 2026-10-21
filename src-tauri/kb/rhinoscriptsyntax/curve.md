# rhinoscriptsyntax: curve

## AddArc

```python
rs.AddArc(plane, radius, angle_degrees)
```

Adds an arc curve to the document

Arguments:

    plane (str): plane on which the arc will lie. The origin of the plane will be
      the center point of the arc. x-axis of the plane defines the 0 angle
      direction.
    radius(number): radius of the arc
    angle_degrees (number): interval of arc in degrees

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as  rs
plane = rs.WorldXYPlane()
plane = rs.RotatePlane(plane,  45.0, [0,0,1])
rs.AddArc( plane, 5.0, 45.0  )
```

See also: AddArc3Pt, ArcAngle, ArcCenterPoint, ArcMidPoint, ArcRadius, IsArc

## AddArc3Pt

```python
rs.AddArc3Pt(start, end, point_on_arc)
```

Adds a 3-point arc curve to the document

Arguments:

    start, end (point|guid): endpoints of the arc
    point_on_arc (point|guid): a point on the arc

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
start = rs.GetPoint("Start of arc")
if start is not None:
    end = rs.GetPoint("End of arc")
    if end is not None:
        pton = rs.GetPoint("Point on arc")
        if pton is not None:
            rs.AddArc3Pt(start, end, pton)
```

See also: AddArc, ArcAngle, ArcCenterPoint, ArcMidPoint, ArcRadius, IsArc

## AddArcPtTanPt

```python
rs.AddArcPtTanPt(start, direction, end)
```

Adds an arc curve, created from a start point, a start direction, and an
    end point, to the document

Arguments:

    start (point): the starting point of the arc
    direction (vector): the arc direction at start
    end (point): the ending point of the arc

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
pick = rs.GetCurveObject("Select curve to extend")
point = rs.GetPoint("End of extension")
domain = rs.CurveDomain(pick[0])
if abs(pick[4]-domain[0]) < abs(pick[4]-domain[1]):
    origin = rs.CurveStartPoint(pick[0])
    tangent = rs.VectorReverse(rs.CurveTangent(pick[0], domain[0]))
else:
    origin = rs.CurveEndPoint(pick[0])
    tangent = rs.CurveTangent(pick[0], domain[1])
rs.AddArcPtTanPt(origin, tangent, point)
```

See also: AddArc, AddArc3Pt, IsArc

## AddBlendCurve

```python
rs.AddBlendCurve(curves, parameters, reverses, continuities)
```

Makes a curve blend between two curves

Arguments:

    curves ([guid|curve, guid|curve]): list of two curves
    parameters ([number, number]): list of two curve parameters defining the blend end points
    reverses ([bool, bool]): list of two boolean values specifying to use the natural or opposite direction of the curve
    continuities ([number, number]): list of two numbers specifying continuity at end points
                                          0 = position
                                          1 = tangency
                                          2 = curvature

Returns: guid: identifier of new curve on success

Example:

```python
import rhinoscriptsyntax as rs
curve0 = rs.AddLine((0,0,0), (0,9,0))
curve1 = rs.AddLine((1,10,0), (10,10,0))
curves = curve0, curve1
domain_crv0 = rs.CurveDomain(curve0)
domain_crv1 = rs.CurveDomain(curve1)
params = domain_crv0[1], domain_crv1[0]
revs = False, True
cont = 2,2
rs.AddBlendCurve( curves, params, revs, cont )
```

See also: AddFilletCurve

## AddCircle

```python
rs.AddCircle(plane_or_center, radius)
```

Adds a circle curve to the document

Arguments:

    plane_or_center (point|plane): plane on which the circle will lie. If a point is
      passed, this will be the center of the circle on the active
      construction plane
    radius (number): the radius of the circle

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.WorldXYPlane()
rs.AddCircle( plane, 5.0 )
```

See also: AddCircle3Pt, CircleCenterPoint, CircleCircumference, CircleRadius, IsCircle

## AddCircle3Pt

```python
rs.AddCircle3Pt(first, second, third)
```

Adds a 3-point circle curve to the document

Arguments:

    first, second, third (point|guid): points on the circle

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("First point on circle")
if point1:
    point2 = rs.GetPoint("Second point on circle")
    if point2:
        point3 = rs.GetPoint("Third point on circle")
        if point3:
            rs.AddCircle3Pt(point1, point2, point3)
```

See also: AddCircle, CircleCenterPoint, CircleCircumference, CircleRadius, IsCircle

## AddCurve

```python
rs.AddCurve(points, degree=3)
```

Adds a control points curve object to the document

Arguments:

    points ([point|guid, ...]) a list of points
    degree (number): degree of the curve

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True, message1="Pick curve point")
if points: rs.AddCurve(points)
```

See also: AddInterpCurve, IsCurve

## AddEllipse

```python
rs.AddEllipse(plane, radiusX, radiusY)
```

Adds an elliptical curve to the document

Arguments:

    plane (plane) the plane on which the ellipse will lie. The origin of
            the plane will be the center of the ellipse
    radiusX, radiusY (number): radius in the X and Y axis directions

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.WorldXYPlane()
rs.AddEllipse( plane, 5.0, 10.0 )
```

See also: AddEllipse3Pt, IsEllipse, EllipseCenterPoint, EllipseQuadPoints

## AddEllipse3Pt

```python
rs.AddEllipse3Pt(center, second, third)
```

Adds a 3-point elliptical curve to the document

Arguments:

    center (point|guid): center point of the ellipse
    second (point|guid): end point of the x axis
    third  (point|guid): end point of the y axis

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
center = (0,0,0)
second = (5,0,0)
third = (0,10,0)
rs.AddEllipse3Pt( center, second, third )
```

See also: AddEllipse, IsEllipse, EllipseCenterPoint, EllipseQuadPoints

## AddFilletCurve

```python
rs.AddFilletCurve(curve0id, curve1id, radius=1.0, base_point0=None, base_point1=None)
```

Adds a fillet curve between two curve objects

Arguments:

    curve0id (guid): identifier of the first curve object
    curve1id (guid): identifier of the second curve object
    radius (number, optional): fillet radius
    base_point0 (point|guid, optional): base point of the first curve. If omitted,
                        starting point of the curve is used
    base_point1 (point|guid, optional): base point of the second curve. If omitted,
                        starting point of the curve is used

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
curve0 = rs.AddLine([0,0,0], [5,1,0])
curve1 = rs.AddLine([0,0,0], [1,5,0])
rs.AddFilletCurve( curve0, curve1 )
```

See also: CurveFilletPoints

## AddInterpCrvOnSrf

```python
rs.AddInterpCrvOnSrf(surface_id, points)
```

Adds an interpolated curve object that lies on a specified
    surface.  Note, this function will not create periodic curves,
    but it will create closed curves.

Arguments:

    surface_id (guid): identifier of the surface to create the curve on
    points ([point|guid, point|guid, ...])list of 3D points that lie on the specified surface.
             The list must contain at least 2 points

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
surface_id = rs.GetObject("Select surface to draw curve on", rs.filter.surface)
if surface_id:
    point1 = rs.GetPointOnSurface( surface_id, "First point on surface")
    if point1:
        point2 = rs.GetPointOnSurface( surface_id, "Second point on surface")
        if point2:
            rs.AddInterpCrvOnSrf( surface_id, [point1, point2])
```

See also: AddCurve, AddInterpCurve, AddInterpCrvOnSrfUV

## AddInterpCrvOnSrfUV

```python
rs.AddInterpCrvOnSrfUV(surface_id, points)
```

Adds an interpolated curve object based on surface parameters,
    that lies on a specified surface. Note, this function will not
    create periodic curves, but it will create closed curves.

Arguments:

    surface_id (guid): identifier of the surface to create the curve on
    points ([[number, number}, [number,number], ...]): a list of 2D surface parameters. The list must contain
                                                       at least 2 sets of parameters

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
surface_id = rs.GetObject("Select surface to draw curve on", rs.filter.surface)
if surface_id:
    domainU = rs.SurfaceDomain( surface_id, 0)
    u0 = domainU[0]/2
    u1 = domainU[1]/2
    domainV = rs.SurfaceDomain( surface_id, 1)
    v0 = domainV[0]/2
    v1 = domainV[1]/2
    rs.AddInterpCrvOnSrfUV( surface_id, [[u0,v0],[u1,v1]])
```

See also: AddCurve, AddInterpCurve, AddInterpCrvOnSrf

## AddInterpCurve

```python
rs.AddInterpCurve(points, degree=3, knotstyle=0, start_tangent=None, end_tangent=None)
```

Adds an interpolated curve object to the document. Options exist to make
    a periodic curve or to specify the tangent at the endpoints. The resulting
    curve is a non-rational NURBS curve of the specified degree.

Arguments:

    points (point|guid, point|guid, ...]): a list containing 3D points to interpolate. For periodic curves,
        if the final point is a duplicate of the initial point, it is
        ignored. The number of control points must be >= (degree+1).
    degree (number, optional): The degree of the curve (must be >=1).
        Periodic curves must have a degree >= 2. For knotstyle = 1 or 2,
        the degree must be 3. For knotstyle = 4 or 5, the degree must be odd
    knotstyle(opt):
        0 Uniform knots.  Parameter spacing between consecutive knots is 1.0.
        1 Chord length spacing.  Requires degree = 3 with arrCV1 and arrCVn1 specified.
        2 Sqrt (chord length).  Requires degree = 3 with arrCV1 and arrCVn1 specified.
        3 Periodic with uniform spacing.
        4 Periodic with chord length spacing.  Requires an odd degree value.
        5 Periodic with sqrt (chord length) spacing.  Requires an odd degree value.
    start_tangent (vector, optional): a vector that specifies a tangency condition at the
        beginning of the curve. If the curve is periodic, this argument must be omitted.
    end_tangent (vector, optional): 3d vector that specifies a tangency condition at the
        end of the curve. If the curve is periodic, this argument must be omitted.

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
points = (0,0,0), (1,1,0), (2,0,0), (3,1,0), (4,0,0), (5,1,0)
rs.AddInterpCurve(points)
```

See also: AddCurve, CurvePointCount, IsCurve

## AddLine

```python
rs.AddLine(start, end)
```

Adds a line curve to the current model.

Arguments:

    start, end (point|guid) end points of the line

Returns: guid: id of the new curve object

Example:

```python
import rhinoscriptsyntax as rs
start = rs.GetPoint("Start of line")
if start:
    end = rs.GetPoint("End of line")
    if end: rs.AddLine(start, end)
```

See also: CurveEndPoint, CurveStartPoint, IsLine

## AddNurbsCurve

```python
rs.AddNurbsCurve(points, knots, degree, weights=None)
```

Adds a NURBS curve object to the document

Arguments:

    points ([guid|point, guid|point, ...]): a list containing 3D control points
    knots ([number, number, ...]): Knot values for the curve. The number of elements in knots must
        equal the number of elements in points plus degree minus 1
    degree (number): degree of the curve. must be greater than of equal to 1
    weights([number, number, ...], optional) weight values for the curve. Number of elements should
        equal the number of elements in points. Values must be greater than 0

Returns: guid: the identifier of the new object if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
curve_id = rs.GetObject("Pick a curve", rs.filter.curve)
if curve_id:
    points = rs.CurvePoints(curve_id)
    knots = rs.CurveKnots(curve_id)
    degree = rs.CurveDegree(curve_id)
    newcurve = rs.AddNurbsCurve( points, knots, degree)
    if newcurve: rs.SelectObject(newcurve)
```

See also: CurveDegree, CurveKnots, CurvePoints

## AddPolyline

```python
rs.AddPolyline(points, replace_id=None)
```

Adds a polyline curve to the current model

Arguments:

    points ([guid|point, guid|point, ...]): list of 3D points. Duplicate, consecutive points will be
             removed. The list must contain at least two points. If the
             list contains less than four points, then the first point and
             last point must be different.
    replace_id (guid, optional): If set to the id of an existing object, the object
             will be replaced by this polyline

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True)
if points: rs.AddPolyline(points)
```

See also: IsPolyline

## AddRectangle

```python
rs.AddRectangle(plane, width, height)
```

Add a rectangular curve to the document

Arguments:

    plane (plane) plane on which the rectangle will lie
    width, height (number): width and height of rectangle as measured along the plane's
      x and y axes

Returns: guid: id of new rectangle

Example:

```python
import rhinoscriptsyntax as rs
plane = rs.WorldXYPlane()
plane = rs.RotatePlane(plane, 45.0, [0,0,1])
rs.AddRectangle( plane, 5.0, 15.0 )
```

## AddSpiral

```python
rs.AddSpiral(point0, point1, pitch, turns, radius0, radius1=None)
```

Adds a spiral or helical curve to the document

Arguments:

    point0 (point|guid): helix axis start point or center of spiral
    point1 (point|guid): helix axis end point or point normal on spiral plane
    pitch (number): distance between turns. If 0, then a spiral. If > 0 then the
            distance between helix "threads"
    turns (number): number of turns
    radius0 (number): starting radius of spiral
    radius1 (number, optional): ending radius of spiral. If omitted, the starting radius is used for the complete spiral.

Returns: guid: id of new curve on success

Example:

```python
import rhinoscriptsyntax as rs
point0 = (0,0,0)
point1 = (0,0,10)
pitch = 1
turns = 10
radius0 = 5.0
radius1 = 8.0
rs.AddSpiral(point0, point1, pitch, turns, radius0, radius1)
```

## AddSubCrv

```python
rs.AddSubCrv(curve_id, param0, param1)
```

Add a curve object based on a portion, or interval of an existing curve
    object. Similar in operation to Rhino's SubCrv command

Arguments:

    curve_id (guid): identifier of a closed planar curve object
    param0, param1 (number): first and second parameters on the source curve

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
getresult = rs.GetCurveObject()
if getresult:
    curve_id = getresult[0]
    point0 = rs.GetPointOnCurve( curve_id )
    if point0:
        point1 = rs.GetPointOnCurve( curve_id )
        if point1:
            t0 = rs.CurveClosestPoint( curve_id, point0)
            t1 = rs.CurveClosestPoint( curve_id, point1)
            rs.AddSubCrv( curve_id, t0, t1 )
```

See also: CurveClosestPoint, GetCurveObject, GetPointOnCurve

## AddTweenCurves

```python
rs.AddTweenCurves(from_curve_id, to_curve_id, number_of_curves = 1, method = 0, sample_number = 10)
```

Creates curves between two open or closed input curves.

Arguments:

    from_curve_id (guid): identifier of the first curve object.
    to_curve_id (guid): identifier of the second curve object.
    number_of_curves (number): The number of curves to create. The default is 1.
    method (number): The method for refining the output curves, where:
      0: (Default) Uses the control points of the curves for matching. So the first control point of first curve is matched to first control point of the second curve.
      1: Refits the output curves like using the FitCurve method.  Both the input curve and the output curve will have the same structure. The resulting curves are usually more complex than input unless input curves are compatible.
      2: Input curves are divided to the specified number of points on the curve, corresponding points define new points that output curves go through. If you are making one tween curve, the method essentially does the following: divides the two curves into an equal number of points, finds the midpoint between the corresponding points on the curves, and interpolates the tween curve through those points.
    sample_number (number): The number of samples points to use if method is 2. The default is 10.

Returns: list(guid, ...): The identifiers of the new tween objects if successful, None on error.

Example:

```python
import rhinoscriptsyntax as rs
curveA = rs.GetObject("Select first curve", rs.filter.curve)
curveB = rs.GetObject("Select second curve", rs.filter.curve)
arrResult = rs.AddTweenCurves(curveA, curveB, 6, 2, 30)
```

## ArcAngle

```python
rs.ArcAngle(curve_id, segment_index=-1)
```

Returns the angle of an arc curve object.

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): identifies the curve segment if
    curve_id (guid): identifies a polycurve

Returns: number: The angle in degrees if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select arc")
if rs.IsArc(id):
    angle = rs.ArcAngle(id)
    print("Arc angle: {}".format(angle))
```

See also: AddArc3Pt, ArcCenterPoint, ArcMidPoint, ArcRadius, IsArc

## ArcCenterPoint

```python
rs.ArcCenterPoint(curve_id, segment_index=-1)
```

Returns the center point of an arc curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: point: The 3D center point of the arc if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select arc")
if rs.IsArc(id):
point = rs.ArcCenterPoint(id)
rs.AddPoint(point)
```

See also: AddArc3Pt, ArcAngle, ArcMidPoint, ArcRadius, IsArc

## ArcMidPoint

```python
rs.ArcMidPoint(curve_id, segment_index=-1)
```

Returns the mid point of an arc curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: point: The 3D mid point of the arc if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select arc")
if rs.IsArc(id):
    point = rs.ArcMidPoint(id)
    rs.AddPoint(point)
```

See also: AddArc3Pt, ArcAngle, ArcCenterPoint, ArcRadius, IsArc

## ArcRadius

```python
rs.ArcRadius(curve_id, segment_index=-1)
```

Returns the radius of an arc curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: number: The radius of the arc if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select arc")
if rs.IsArc(id):
    radius = rs.ArcRadius(id)
    print("Arc radius: {}".format(radius))
```

See also: AddArc3Pt, ArcAngle, ArcCenterPoint, ArcMidPoint, IsArc

## ChangeCurveDegree

```python
rs.ChangeCurveDegree(object_id, degree)
```

Changes the degree of a curve object. For more information see the Rhino help file for the ChangeDegree command.

Arguments:

    object_id (guid): the object's identifier.
    degree (number): the new degree.

Returns: bool: True of False indicating success or failure.
None: on failure

See also: IsCurve, CurveDegree

## CircleCenterPoint

```python
rs.CircleCenterPoint(curve_id, segment_index=-1, return_plane=False)
```

Returns the center point of a circle curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve
    return_plane (bool, optional): if True, the circle's plane is returned. If omitted the plane is not returned.

Returns: point: The 3D center point of the circle if successful.
plane: The plane of the circle if return_plane is True

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select circle")
if rs.IsCircle(id):
    point = rs.CircleCenterPoint(id)
    rs.AddPoint( point )
```

See also: AddCircle, AddCircle3Pt, CircleCircumference, CircleRadius, IsCircle

## CircleCircumference

```python
rs.CircleCircumference(curve_id, segment_index=-1)
```

Returns the circumference of a circle curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: number: The circumference of the circle if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select circle")
if rs.IsCircle(id):
    circumference = rs.CircleCircumference(id)
    print("Circle circumference: {}".format(circumference))
```

See also: AddCircle, AddCircle3Pt, CircleCenterPoint, CircleRadius, IsCircle

## CircleRadius

```python
rs.CircleRadius(curve_id, segment_index=-1)
```

Returns the radius of a circle curve object

Arguments:

    curve_id (guid): identifier of a curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: number: The radius of the circle if successful.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select circle")
if rs.IsCircle(id):
    radius = rs.CircleRadius(id)
    print("Circle radius: {}".format(radius))
```

See also: AddCircle, AddCircle3Pt, CircleCenterPoint, CircleCircumference, IsCircle

## CloseCurve

```python
rs.CloseCurve(curve_id, tolerance=-1.0)
```

Closes an open curve object by making adjustments to the end points so
    they meet at a point

Arguments:

    curve_id (guid): identifier of a curve object
    tolerance (number, optional): maximum allowable distance between start and end
                                  point. If omitted, the current absolute tolerance is used

Returns: guid: id of the new curve object if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select curve", rs.filter.curve)
if not rs.IsCurveClosed(obj) and rs.IsCurveClosable(obj):
    rs.CloseCurve( obj )
```

See also: IsCurveClosable, IsCurveClosed

## ClosedCurveOrientation

```python
rs.ClosedCurveOrientation(curve_id, direction=(0,0,1))
```

Determine the orientation (counter-clockwise or clockwise) of a closed,
    planar curve

Arguments:

    curve_id (guid): identifier of a curve object
    direction (vector, optional): 3d vector that identifies up, or Z axs, direction of
                                  the plane to test against

Returns: number: 1 if the curve's orientation is clockwise
       -1 if the curve's orientation is counter-clockwise
        0 if unable to compute the curve's orientation

## ConvertCurveToPolyline

```python
rs.ConvertCurveToPolyline(curve_id, angle_tolerance=5.0, tolerance=0.01, delete_input=False, min_edge_length=0, max_edge_length=0)
```

Convert curve to a polyline curve

Arguments:

    curve_id (guid): identifier of a curve object
    angle_tolerance (number, optional): The maximum angle between curve tangents at line endpoints.
                                        If omitted, the angle tolerance is set to 5.0.
    tolerance(number, optional): The distance tolerance at segment midpoints. If omitted, the tolerance is set to 0.01.
    delete_input(bool, optional): Delete the curve object specified by curve_id. If omitted, curve_id will not be deleted.
    min_edge_length (number, optional): Minimum segment length
    max_edge_length (number, optonal): Maximum segment length

Returns: guid: The new curve if successful.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    polyline = rs.ConvertCurveToPolyline(obj)
    if polyline: rs.SelectObject(polyline)
```

See also: IsCurve

## CurveArcLengthPoint

```python
rs.CurveArcLengthPoint(curve_id, length, from_start=True)
```

Returns the point on the curve that is a specified arc length
    from the start of the curve.

Arguments:

    curve_id (guid): identifier of a curve object
    length (number): The arc length from the start of the curve to evaluate.
    from_start (bool, optional): If not specified or True, then the arc length point is
        calculated from the start of the curve. If False, the arc length
        point is calculated from the end of the curve.

Returns: point: on curve if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    length = rs.CurveLength(obj)
    point = rs.CurveArcLengthPoint(obj, length/3.0)
    rs.AddPoint( point )
```

See also: CurveEndPoint, CurveMidPoint, CurveStartPoint

## CurveArea

```python
rs.CurveArea(curve_id)
```

Returns area of closed planar curves. The results are based on the
    current drawing units.

Arguments:

    curve_id (guid): The identifier of a closed, planar curve object.

Returns: list[number, number]: List of area information. The list will contain the following information:
  Element  Description
  [0]      The area. If more than one curve was specified, the
             value will be the cumulative area.
  [1]      The absolute (+/-) error bound for the area.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a curve", rs.filter.curve)
if id:
    props = rs.CurveArea(id)
    if props:
        print("The curve area is: {}".format(props[0]))
```

See also: IsCurve, IsCurveClosed, IsCurvePlanar

## CurveAreaCentroid

```python
rs.CurveAreaCentroid(curve_id)
```

Returns area centroid of closed, planar curves. The results are based
    on the current drawing units.

Arguments:

    curve_id (guid)The identifier of a closed, planar curve object.

Returns: tuple(point, vector): of area centroid information containing the following information:
  Element  Description
  [0]        The 3d centroid point. If more than one curve was specified,
           the value will be the cumulative area.
  [1]        A 3d vector with the absolute (+/-) error bound for the area
           centroid.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a curve", rs.filter.curve)
if id:
    props = rs.CurveAreaCentroid(id)
    if props:
        print("The curve area centroid is: {}".format(props[0]))
```

See also: IsCurve, IsCurveClosed, IsCurvePlanar

## CurveArrows

```python
rs.CurveArrows(curve_id, arrow_style=None)
```

Enables or disables a curve object's annotation arrows

Arguments:

    curve_id (guid): identifier of a curve
    arrow_style (number, optional): the style of annotation arrow to be displayed. If omitted the current type is returned.
      0 = no arrows
      1 = display arrow at start of curve
      2 = display arrow at end of curve
      3 = display arrow at both start and end of curve

Returns: number: if arrow_style is not specified, the current annotation arrow style
number: if arrow_style is specified, the previous arrow style

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve", rs.filter.curve)
if rs.CurveArrows(obj)!=3: rs.CurveArrows(obj, 3)
```

See also: IsCurve

## CurveBooleanDifference

```python
rs.CurveBooleanDifference(curve_id_0, curve_id_1, tolerance=None)
```

Calculates the difference between two closed, planar curves and
    adds the results to the document. Note, curves must be coplanar.

Arguments:

    curve_id_0 (guid): identifier of the first curve object.
    curve_id_1 (guid): identifier of the second curve object.
    tolerance (float, optional): a positive tolerance value, or None for the doc default.

Returns: list(guid, ...): The identifiers of the new objects if successful, None on error.

Example:

```python
import rhinoscriptsyntax as rs
curveA = rs.GetObject("Select first curve", rs.filter.curve)
curveB = rs.GetObject("Select second curve", rs.filter.curve)
arrResult = rs.CurveBooleanDifference(curveA, curveB)
if arrResult:
    rs.DeleteObject( curveA )
    rs.DeleteObject( curveB )
```

See also: CurveBooleanIntersection, CurveBooleanUnion

## CurveBooleanIntersection

```python
rs.CurveBooleanIntersection(curve_id_0, curve_id_1, tolerance=None)
```

Calculates the intersection of two closed, planar curves and adds
    the results to the document. Note, curves must be coplanar.

Arguments:

    curve_id_0 (guid): identifier of the first curve object.
    curve_id_1 (guid): identifier of the second curve object.
    tolerance (float, optional): a positive tolerance value, or None for the doc default.

Returns: list(guid, ...): The identifiers of the new objects.

Example:

```python
import rhinoscriptsyntax as rs
curveA = rs.GetObject("Select first curve", rs.filter.curve)
curveB = rs.GetObject("Select second curve", rs.filter.curve)
result = rs.CurveBooleanIntersection(curveA, curveB)
if result:
    rs.DeleteObject( curveA )
    rs.DeleteObject( curveB )
```

See also: CurveBooleanDifference, CurveBooleanUnion

## CurveBooleanUnion

```python
rs.CurveBooleanUnion(curve_id, tolerance=None)
```

Calculate the union of two or more closed, planar curves and
    add the results to the document. Note, curves must be coplanar.

Arguments:

    curve_id ([guid, guid, ...])list of two or more close planar curves identifiers
    tolerance (float, optional): a positive tolerance value, or None for the doc default.

Returns: list(guid, ...): The identifiers of the new objects.

Example:

```python
import rhinoscriptsyntax as rs
curve_ids = rs.GetObjects("Select curves to union", rs.filter.curve)
if curve_ids and len(curve_ids)>1:
    result = rs.CurveBooleanUnion(curve_ids)
    if result: rs.DeleteObjects(curve_ids)
```

See also: CurveBooleanDifference, CurveBooleanIntersection

## CurveBrepIntersect

```python
rs.CurveBrepIntersect(curve_id, brep_id, tolerance=None)
```

Intersects a curve object with a brep object. Note, unlike the
    CurveSurfaceIntersection function, this function works on trimmed surfaces.

Arguments:

    curve_id (guid): identifier of a curve object
    brep_id (guid): identifier of a brep object
    tolerance (number, optional): distance tolerance at segment midpoints.
                      If omitted, the current absolute tolerance is used.

Returns: list(guid, ...): identifiers for the newly created intersection objects if successful.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve", rs.filter.curve)
if curve:
    brep = rs.GetObject("Select a brep", rs.filter.surface + rs.filter.polysurface)
    if brep: rs.CurveBrepIntersect( curve, brep )
```

See also: CurveSurfaceIntersection

## CurveClosestObject

```python
rs.CurveClosestObject(curve_id, object_ids)
```

Returns the 3D point locations on two objects where they are closest to
    each other. Note, this function provides similar functionality to that of
    Rhino's ClosestPt command.

Arguments:

    curve_id (guid):identifier of the curve object to test
    object_ids ([guid, ...]) list of identifiers of point cloud, curve, surface, or
      polysurface to test against

Returns: tuple[guid, point, point]: containing the results of the closest point calculation.
The elements are as follows:
  [0]    The identifier of the closest object.
  [1]    The 3-D point that is closest to the closest object.
  [2]    The 3-D point that is closest to the test curve.

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.curve | rs.filter.pointcloud | rs.filter.surface | rs.filter.polysurface
objects = rs.GetObjects("Select target objects for closest point", filter)
if objects:
    curve = rs.GetObject("Select curve")
    if curve:
        results = rs.CurveClosestObject(curve, objects)
        if results:
            print("Curve id: {}".format(results[0]))
            rs.AddPoint( results[1] )
            rs.AddPoint( results[2] )
```

See also: CurveClosestPoint, EvaluateCurve, IsCurve

## CurveClosestPoint

```python
rs.CurveClosestPoint(curve_id, test_point, segment_index=-1 )
```

Returns parameter of the point on a curve that is closest to a test point.

Arguments:

    curve_id (guid): identifier of a curve object
    point (point): sampling point
    segment_index (number, optional): curve segment index if `curve_id` identifies a polycurve

Returns: number: The parameter of the closest point on the curve

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a curve")
if id:
    point = rs.GetPointOnCurve(id, "Pick a test point")
    if point:
        param = rs.CurveClosestPoint(id, point)
        print("Curve parameter: {}".format(param))
```

See also: EvaluateCurve, IsCurve

## CurveContourPoints

```python
rs.CurveContourPoints(curve_id, start_point, end_point, interval=None)
```

Returns the 3D point locations calculated by contouring a curve object.

Arguments:

    curve_id (guid): identifier of a curve object.
    start_point (point): 3D starting point of a center line.
    end_point (point): 3D ending point of a center line.
    interval (number, optional): The distance between contour curves. If omitted,
    the interval will be equal to the diagonal distance of the object's
    bounding box divided by 50.

Returns: list(point, ....): A list of 3D points, one for each contour

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select curve", rs.filter.curve)
start_point = rs.GetPoint("Base point of center line")
end_point = rs.GetPoint("Endpoint of center line", start_point)
contour = rs.CurveContourPoints(obj, start_point, end_point)
if contour: rs.AddPoints(contour)
```

See also: AddSrfContourCrvs

## CurveCurvature

```python
rs.CurveCurvature(curve_id, parameter)
```

Returns the curvature of a curve at a parameter. See the Rhino help for
    details on curve curvature

Arguments:

    curve_id (guid): identifier of the curve
    parameter (number): parameter to evaluate

Returns: tuple[point, vector, point, number, vector]: of curvature information on success
  [0] = point at specified parameter
  [1] = tangent vector
  [2] = center of radius of curvature
  [3] = radius of curvature
  [4] = curvature vector
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    point = rs.GetPointOnCurve(obj, "Pick a test point")
    if point:
        param = rs.CurveClosestPoint(obj, point)
        if param:
            data = rs.CurveCurvature(obj, param)
            if data:
                print("Curve curvature evaluation at parameter {}".format(param, ":"))
                print(" 3-D Point: {}".format(data[0]))
                print(" 3-D Tangent: {}".format(data[1]))
                print(" Center of radius of curvature: {}".format(data[2]))
                print(" Radius of curvature: {}".format(data[3]))
                print(" 3-D Curvature: {}".format(data[4]))
```

See also: SurfaceCurvature

## CurveCurveIntersection

```python
rs.CurveCurveIntersection(curveA, curveB=None, tolerance=-1)
```

Calculates intersection of two curve objects.

Arguments:

    curveA (guid): identifier of the first curve object.
    curveB  (guid, optional): identifier of the second curve object. If omitted, then a
             self-intersection test will be performed on curveA.
    tolerance (number, optional): absolute tolerance in drawing units. If omitted,
                      the document's current absolute tolerance is used.

Returns: list of tuples: containing intersection information if successful.
The list will contain one or more of the following elements:
  Element Type     Description
  [n][0]  Number   The intersection event type, either Point (1) or Overlap (2).
  [n][1]  Point3d  If the event type is Point (1), then the intersection point 
                   on the first curve. If the event type is Overlap (2), then
                   intersection start point on the first curve.
  [n][2]  Point3d  If the event type is Point (1), then the intersection point
                   on the first curve. If the event type is Overlap (2), then
                   intersection end point on the first curve.
  [n][3]  Point3d  If the event type is Point (1), then the intersection point 
                   on the second curve. If the event type is Overlap (2), then
                   intersection start point on the second curve.
  [n][4]  Point3d  If the event type is Point (1), then the intersection point
                   on the second curve. If the event type is Overlap (2), then
                   intersection end point on the second curve.
  [n][5]  Number   If the event type is Point (1), then the first curve parameter.
                   If the event type is Overlap (2), then the start value of the
                   first curve parameter range.
  [n][6]  Number   If the event type is Point (1), then the first curve parameter.
                   If the event type is Overlap (2), then the end value of the
                   first curve parameter range.
  [n][7]  Number   If the event type is Point (1), then the second curve parameter.
                   If the event type is Overlap (2), then the start value of the
                   second curve parameter range.
  [n][8]  Number   If the event type is Point (1), then the second curve parameter.
                   If the event type is Overlap (2), then the end value of the 
                   second curve parameter range.

Example:

```python
import rhinoscriptsyntax as rs
def ccx():
    curve1 = rs.GetObject("Select first curve", rs.filter.curve)
    if curve1 is None: return
    curve2 = rs.GetObject("Select second curve", rs.filter.curve)
    if curve2 is None: return
    intersection_list = rs.CurveCurveIntersection(curve1, curve2)
    if intersection_list is None:
        print("Selected curves do not intersect.")
        return
    for intersection in intersection_list:
        if intersection[0] == 1:
            print("Point")
            print("Intersection point on first curve:  {}".format(intersection[1]))
            print("Intersection point on second curve:  {}".format(intersection[3]))
            print("First curve parameter:  {}".format(intersection[5]))
            print("Second curve parameter:  {}".format(intersection[7]))
        else:
            print("Overlap")
            print("Intersection start point on first curve: {}".format(intersection[1]))
            print("Intersection end point on first curve: {}".format(intersection[2]))
            print("Intersection start point on second curve: {}".format(intersection[3]))
            print("Intersection end point on second curve: {}".format(intersection[4]))
            print("First curve parameter range: {} to {}".format(intersection[5], intersection[6]))
            print("Second curve parameter range: {} to {}".format(intersection[7], intersection[8]))
ccx()
```

See also: CurveSurfaceIntersection

## CurveDegree

```python
rs.CurveDegree(curve_id, segment_index=-1)
```

Returns the degree of a curve object.

Arguments:

    curve_id (guid): identifier of a curve object.
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve.

Returns: number: The degree of the curve if successful.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    degree = rs.CurveDegree(obj)
    print("Curve degree:{}".format(degree))
```

See also: CurveDomain, IsCurve

## CurveDeviation

```python
rs.CurveDeviation(curve_a, curve_b)
```

Returns the minimum and maximum deviation between two curve objects

Arguments:

    curve_a, curve_b (guid): identifiers of two curves

Returns: tuple[number, number, number, number, number, number]: of deviation information on success
  [0] = curve_a parameter at maximum overlap distance point
  [1] = curve_b parameter at maximum overlap distance point
  [2] = maximum overlap distance
  [3] = curve_a parameter at minimum overlap distance point
  [4] = curve_b parameter at minimum overlap distance point
  [5] = minimum distance between curves
None on error

Example:

```python
import rhinoscriptsyntax as rs
curveA = rs.GetObject("Select first curve to test", rs.filter.curve)
curveB = rs.GetObject("Select second curve to test", rs.filter.curve)
deviation = rs.CurveDeviation(curveA, curveB)
if deviation:
    print("Minimum deviation = {}".format(deviation[5]))
    print("Maximum deviation = {}".format(deviation[2]))
```

See also: CurveArea, CurveAreaCentroid

## CurveDim

```python
rs.CurveDim(curve_id, segment_index=-1)
```

Returns the dimension of a curve object

Arguments:

    curve_id (guid): identifier of a curve object.
    segment_index (number, optional): the curve segment if `curve_id` identifies a polycurve.

Returns: number: The dimension of the curve if successful. None on error.

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve")
if rs.IsCurve(curve):
    print("Curve dimension = {}".format(rs.CurveDim(curve)))
```

See also: CurveDegree, CurveDomain

## CurveDirectionsMatch

```python
rs.CurveDirectionsMatch(curve_id_0, curve_id_1)
```

Tests if two curve objects are generally in the same direction or if they
    would be more in the same direction if one of them were flipped. When testing
    curve directions, both curves must be either open or closed - you cannot test
    one open curve and one closed curve.

Arguments:

    curve_id_0 (guid): identifier of first curve object
    curve_id_1 (guid): identifier of second curve object

Returns: bool: True if the curve directions match, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
curve1 = rs.GetObject("Select first curve to compare", rs.filter.curve)
curve2 = rs.GetObject("Select second curve to compare", rs.filter.curve)
if rs.CurveDirectionsMatch(curve1, curve2):
    print("Curves are in the same direction")
else:
    print("Curve are not in the same direction")
```

See also: ReverseCurve

## CurveDiscontinuity

```python
rs.CurveDiscontinuity(curve_id, style)
```

Search for a derivatitive, tangent, or curvature discontinuity in
    a curve object.

Arguments:

    curve_id (guid): identifier of curve object
    style (number): The type of continuity to test for. The types of
        continuity are as follows:
        Value    Description
        1        C0 - Continuous function
        2        C1 - Continuous first derivative
        3        C2 - Continuous first and second derivative
        4        G1 - Continuous unit tangent
        5        G2 - Continuous unit tangent and curvature

Returns: list(point, ...): 3D points where the curve is discontinuous

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve", rs.filter.curve)
if rs.IsCurve(curve):
    points = rs.CurveDiscontinuity(curve, 2)
    if points: rs.AddPoints( points )
```

See also: IsCurve

## CurveDomain

```python
rs.CurveDomain(curve_id, segment_index=-1)
```

Returns the domain of a curve object
    as an indexable object with two elements.

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve.

Returns: list(number, number): the domain of the curve if successful.
   [0] Domain minimum
   [1] Domain maximum
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    domain = rs.CurveDomain(obj)
    print("Curve domain: {} to {}".format(domain[0], domain[1]))
```

See also: CurveDegree, IsCurve

## CurveEditPoints

```python
rs.CurveEditPoints(curve_id, return_parameters=False, segment_index=-1)
```

Returns the edit, or Greville, points of a curve object. 
    For each curve control point, there is a corresponding edit point.

Arguments:

    curve_id (guid): identifier of the curve object
    return_parameters (bool, optional): if True, return as a list of curve parameters.
                                        If False, return as a list of 3d points
    segment_index (number, optional): the curve segment index is `curve_id` identifies a polycurve

Returns: list(point, ....): curve edit points on success
None on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    points = rs.CurveEditPoints(obj)
    if points: rs.AddPointCloud( points )
```

See also: IsCurve, CurvePointCount, CurvePoints

## CurveEndPoint

```python
rs.CurveEndPoint(curve_id, segment_index=-1)
```

Returns the end point of a curve object

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: point: The 3d endpoint of the curve if successful.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    point = rs.CurveEndPoint(object)
    rs.AddPoint(point)
```

See also: CurveMidPoint, CurveStartPoint, IsCurve

## CurveFilletPoints

```python
rs.CurveFilletPoints(curve_id_0, curve_id_1, radius=1.0, base_point_0=None, base_point_1=None, return_points=True)
```

Find points at which to cut a pair of curves so that a fillet of a
    specified radius fits. A fillet point is a pair of points (point0, point1)
    such that there is a circle of radius tangent to curve curve0 at point0 and
    tangent to curve curve1 at point1. Of all possible fillet points, this
    function returns the one which is the closest to the base point base_point_0,
    base_point_1. Distance from the base point is measured by the sum of arc
    lengths along the two curves.

Arguments:

    curve_id_0 (guid): identifier of the first curve object.
    curve_id_1 (guid): identifier of the second curve object.
    radius (number, optional): The fillet radius. If omitted, a radius
                   of 1.0 is specified.
    base_point_0 (point, optional): The base point on the first curve.
                   If omitted, the starting point of the curve is used.
    base_point_1 (point, optional): The base point on the second curve. If omitted,
                   the starting point of the curve is used.
    return_points (bool, optional): If True (Default), then fillet points are
                   returned. Otherwise, a fillet curve is created and
                   it's identifier is returned.

Returns: list(point, point, point, vector, vector, vector): If return_points is True, then a list of point and vector values
if successful. The list elements are as follows:
    [0]    A point on the first curve at which to cut (point).
    [1]    A point on the second curve at which to cut (point).
    [2]    The fillet plane's origin (point). This point is also
             the center point of the fillet
    [3]    The fillet plane's X axis (vector).
    [4]    The fillet plane's Y axis (vector).
    [5]    The fillet plane's Z axis (vector).
      
guid: If return_points is False, then the identifier of the fillet curve
      if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
curve0 = rs.AddLine([0,0,0], [5,1,0])
curve1 = rs.AddLine([0,0,0], [1,5,0])
fillet = rs.CurveFilletPoints(curve0, curve1)
if fillet:
    rs.AddPoint( fillet[0] )
    rs.AddPoint( fillet[1] )
    rs.AddPoint( fillet[2] )
```

See also: AddFilletCurve

## CurveFrame

```python
rs.CurveFrame(curve_id, parameter, segment_index=-1)
```

Returns the plane at a parameter of a curve. The plane is based on the
    tangent and curvature vectors at a parameter.

Arguments:

    curve_id (guid): identifier of the curve object.
    parameter (number): parameter to evaluate.
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: plane: The plane at the specified parameter if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetCurveObject("Select a curve")
if curve:
    plane = rs.CurveFrame(curve[0], curve[4])
    rs.AddPlaneSurface(plane, 5.0, 3.0)
```

See also: CurvePerpFrame

## CurveKnotCount

```python
rs.CurveKnotCount(curve_id, segment_index=-1)
```

Returns the knot count of a curve object.

Arguments:

    curve_id (guid): identifier of the curve object.
    segment_index (number, optional): the curve segment if `curve_id` identifies a polycurve.

Returns: number: The number of knots if successful.
None: if not successful or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    count = rs.CurveKnotCount(obj)
    print("Curve knot count:{}".format(count))
```

See also: DivideCurve, IsCurve

## CurveKnots

```python
rs.CurveKnots(curve_id, segment_index=-1)
```

Returns the knots, or knot vector, of a curve object

Arguments:

    curve_id (guid): identifier of the curve object.
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve.

Returns: list(number, ....): knot values if successful.
None: if not successful or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    knots = rs.CurveKnots(obj)
    if knots:
        for knot in knots: print("Curve knot value:{}".format(knot))
```

See also: CurveKnotCount, IsCurve

## CurveLength

```python
rs.CurveLength(curve_id, segment_index=-1, sub_domain=None)
```

Returns the length of a curve object.

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve
    sub_domain ([number, number], optional): list of two numbers identifying the sub-domain of the
        curve on which the calculation will be performed. The two parameters
        (sub-domain) must be non-decreasing. If omitted, the length of the
        entire curve is returned.

Returns: number: The length of the curve if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    length = rs.CurveLength(object)
    print("Curve length:{}".format(length))
```

See also: CurveDomain, IsCurve

## CurveMidPoint

```python
rs.CurveMidPoint(curve_id, segment_index=-1)
```

Returns the mid point of a curve object.

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: point: The 3D midpoint of the curve if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    point = rs.CurveMidPoint(pbject)
    rs.AddPoint( point )
```

See also: CurveEndPoint, CurveStartPoint, IsCurve

## CurveNormal

```python
rs.CurveNormal(curve_id, segment_index=-1)
```

Returns the normal direction of the plane in which a planar curve object lies.

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment if curve_id identifies a polycurve

Returns: vector: The 3D normal vector if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a planar curve")
if rs.IsCurve(object) and rs.IsCurvePlanar(object):
    normal = rs.CurveNormal(object)
    if normal: print("Curve Normal:{}".format(normal))
```

See also: IsCurve, IsCurvePlanar

## CurveNormalizedParameter

```python
rs.CurveNormalizedParameter(curve_id, parameter)
```

Converts a curve parameter to a normalized curve parameter;
    one that ranges between 0-1

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number): the curve parameter to convert

Returns: number: normalized curve parameter

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select curve")
if rs.IsCurve(obj):
    domain = rs.CurveDomain(obj)
    parameter = (domain[0]+domain[1])/2.0
    print("Curve parameter:{}".format(parameter))
    normalized = rs.CurveNormalizedParameter(obj, parameter)
    print("Normalized parameter:{}".format(normalized))
```

See also: CurveDomain, CurveParameter

## CurveParameter

```python
rs.CurveParameter(curve_id, parameter)
```

Converts a normalized curve parameter to a curve parameter;
    one within the curve's domain

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number): the normalized curve parameter to convert

Returns: number: curve parameter

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select curve")
if rs.IsCurve(obj):
    normalized = 0.5
    print("Normalized parameter:{}".format(normalized))
    parameter = rs.CurveParameter(obj, normalized)
    print("Curve parameter:{}".format(parameter))
```

See also: CurveDomain, CurveNormalizedParameter

## CurvePerpFrame

```python
rs.CurvePerpFrame(curve_id, parameter)
```

Returns the perpendicular plane at a parameter of a curve. The result
    is relatively parallel (zero-twisting) plane

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number): parameter to evaluate

Returns: plane: Plane on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
crv = rs.GetCurveObject("Select a curve")
if crv:
    plane = rs.CurvePerpFrame(crv[0], crv[4])
    rs.AddPlaneSurface( plane, 1, 1 )
```

See also: CurveFrame

## CurvePlane

```python
rs.CurvePlane(curve_id, segment_index=-1)
```

Returns the plane in which a planar curve lies. Note, this function works
    only on planar curves.

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: plane: The plane in which the curve lies if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve", rs.filter.curve)
if rs.IsCurvePlanar(curve):
    plane = rs.CurvePlane(curve)
    rs.ViewCPlane(None, plane)
```

See also: IsCurve, IsCurvePlanar

## CurvePointCount

```python
rs.CurvePointCount(curve_id, segment_index=-1)
```

Returns the control points count of a curve object.

Arguments:

    curve_id (guid) identifier of the curve object
    segment_index (number, optional): the curve segment if `curve_id` identifies a polycurve

Returns: number: Number of control points if successful.
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    count = rs.CurvePointCount(obj)
    print("Curve point count:{}".format(count))
```

See also: DivideCurve, IsCurve

## CurvePoints

```python
rs.CurvePoints(curve_id, segment_index=-1)
```

Returns the control points, or control vertices, of a curve object.
    If the curve is a rational NURBS curve, the euclidean control vertices
    are returned.

Arguments:

    curve_id (guid): the object's identifier
    segment_index (number, optional): the curve segment if `curve_id` identifies a polycurve

Returns: list(point, ...): the control points, or control vertices, of a curve object

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    points = rs.CurvePoints(obj)
    if points: [rs.AddPoint(pt) for pt in points]
```

See also: CurvePointCount, IsCurve

## CurveRadius

```python
rs.CurveRadius(curve_id, test_point, segment_index=-1)
```

Returns the radius of curvature at a point on a curve.

Arguments:

    curve_id (guid): identifier of the curve object
    test_point (point): sampling point
    segment_index (number, optional): the curve segment if curve_id identifies a polycurve

Returns: number: The radius of curvature at the point on the curve if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    point = rs.GetPointOnCurve(obj, "Pick a test point")
    if point:
        radius = rs.CurveRadius(obj, point)
        print("Radius of curvature:{}".format(radius))
```

See also: IsCurve

## CurveSeam

```python
rs.CurveSeam(curve_id, parameter)
```

Adjusts the seam, or start/end, point of a closed curve.

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number): The parameter of the new start/end point.
                Note, if successful, the resulting curve's
                domain will start at `parameter`.

Returns: bool: True or False indicating success or failure.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select closed curve", rs.filter.curve)
if rs.IsCurveClosed(obj):
    domain = rs.CurveDomain(obj)
    parameter = (domain[0] + domain[1])/2.0
    rs.CurveSeam( obj, parameter )
```

See also: IsCurve, IsCurveClosed

## CurveStartPoint

```python
rs.CurveStartPoint(curve_id, segment_index=-1, point=None)
```

Returns the start point of a curve object

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve
    point (point, optional): new start point

Returns: point: The 3D starting point of the curve if successful.

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    point = rs.CurveStartPoint(object)
    rs.AddPoint(point)
```

See also: CurveEndPoint, CurveMidPoint, IsCurve

## CurveSurfaceIntersection

```python
rs.CurveSurfaceIntersection(curve_id, surface_id, tolerance=-1, angle_tolerance=-1)
```

Calculates intersection of a curve object with a surface object.
    Note, this function works on the untrimmed portion of the surface.

Arguments:

    curve_id (guid): The identifier of the first curve object.
    surface_id (guid): The identifier of the second curve object. If omitted,
        the a self-intersection test will be performed on curve.
    tolerance (number, optional): The absolute tolerance in drawing units. If omitted,
        the document's current absolute tolerance is used.
    angle_tolerance (number, optional) angle tolerance in degrees. The angle
        tolerance is used to determine when the curve is tangent to the
        surface. If omitted, the document's current angle tolerance is used.

Returns: list(list(point, point, point, point, number, number, number, number, number, number), ...): of intersection information if successful.
The list will contain one or more of the following elements:
  Element Type     Description
  [n][0]  Number   The intersection event type, either Point(1) or Overlap(2).
  [n][1]  Point3d  If the event type is Point(1), then the intersection point
                   on the first curve. If the event type is Overlap(2), then
                   intersection start point on the first curve.
  [n][2]  Point3d  If the event type is Point(1), then the intersection point
                   on the first curve. If the event type is Overlap(2), then
                   intersection end point on the first curve.
  [n][3]  Point3d  If the event type is Point(1), then the intersection point
                   on the second curve. If the event type is Overlap(2), then
                   intersection start point on the surface.
  [n][4]  Point3d  If the event type is Point(1), then the intersection point
                   on the second curve. If the event type is Overlap(2), then
                   intersection end point on the surface.
  [n][5]  Number   If the event type is Point(1), then the first curve parameter.
                   If the event type is Overlap(2), then the start value of the
                   first curve parameter range.
  [n][6]  Number   If the event type is Point(1), then the first curve parameter.
                   If the event type is Overlap(2), then the end value of the
                   curve parameter range.
  [n][7]  Number   If the event type is Point(1), then the U surface parameter.
                   If the event type is Overlap(2), then the U surface parameter
                   for curve at (n, 5).
  [n][8]  Number   If the event type is Point(1), then the V surface parameter.
                   If the event type is Overlap(2), then the V surface parameter
                   for curve at (n, 5).
  [n][9]  Number   If the event type is Point(1), then the U surface parameter.
                   If the event type is Overlap(2), then the U surface parameter
                   for curve at (n, 6).
  [n][10] Number   If the event type is Point(1), then the V surface parameter.
                   If the event type is Overlap(2), then the V surface parameter
                   for curve at (n, 6).

Example:

```python
import rhinoscriptsyntax as rs
def csx():
    curve = rs.GetObject("Select curve", rs.filter.curve)
    if curve is None: return
    surface = rs.GetObject("Select surface", rs.filter.surface)
    if surface is None: return
    intersection_list = rs.CurveSurfaceIntersection(curve, surface)
    if intersection_list is None:
        print("Curve and surface do not intersect.")
        return
    for intersection in intersection_list:
        if intersection[0]==1:
            print("Point")
            print("Intersection point on curve:{}".format(intersection[1]))
            print("Intersection point on surface:{}".format(intersection[3]))
            print("Curve parameter:{}".format(intersection[5]))
            print("Surface parameter: {}, {}".format(intersection[7], intersection[8]))
        else:
            print("Overlap")
            print("Intersection start point on curve:{}".format(intersection[1]))
            print("Intersection end point on curve:{}".format(intersection[2]))
            print("Intersection start point on surface:{}".format(intersection[3]))
            print("Intersection end point on surface:{}".format(intersection[4]))
            print("Curve parameter range: {} to {}".format(intersection[5], intersection[6]))
            print("Surface parameter range: {}, {} to {}, {}".format(intersection[7] intersection[8], intersection[9], intersection[10]))
csx()
```

See also: CurveCurveIntersection, CurveBrepIntersect

## CurveTangent

```python
rs.CurveTangent(curve_id, parameter, segment_index=-1)
```

Returns a 3D vector that is the tangent to a curve at a parameter.

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number) parameter to evaluate
    segment_index (number, optional) the curve segment index if `curve_id` identifies a polycurve

Returns: vector: A 3D vector if successful.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve", rs.filter.curve)
if obj:
    point = rs.GetPointOnCurve(obj)
    if point:
        param = rs.CurveClosestPoint(obj, point)
        normal = rs.CurveTangent(obj, param)
        print(normal)
```

See also: CurveClosestPoint, CurveDomain

## CurveWeights

```python
rs.CurveWeights(curve_id, segment_index=-1)
```

Returns list of weights that are assigned to the control points of a curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: number: The weight values of the curve if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    weights = rs.CurveWeights(obj)
    if weights:
        for weight in weights:
            print("Curve control point weight value:{}".format(weight))
```

See also: CurveKnots, IsCurve

## DivideCurve

```python
rs.DivideCurve(curve_id, segments, create_points=False, return_points=True)
```

Divides a curve object into a specified number of segments.

Arguments:

    curve_id (guid):identifier of the curve object
    segments (number): The number of segments.
    create_points (bool, optional): Create the division points. If omitted or False,
        points are not created.
    return_points (bool, optional): If omitted or True, points are returned.
        If False, then a list of curve parameters are returned.

Returns: list(point|number, ...): If `return_points` is not specified or True, then a list containing 3D division points.
list(point|number, ...): If `return_points` is False, then an array containing division curve parameters.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if obj:
    points = rs.DivideCurve(obj, 4)
    for point in points: rs.AddPoint(point)
```

See also: DivideCurveEquidistant, DivideCurveLength

## DivideCurveEquidistant

```python
rs.DivideCurveEquidistant(curve_id, distance, create_points=False, return_points=True)
```

Divides a curve such that the linear distance between the points is equal.

Arguments:

    curve_id (guid): the object's identifier
    distance (number): linear distance between division points
    create_points (bool, optional): create the division points if True.
    return_points (bool, optional): If True, return a list of points.
                                    If False, return a list of curve parameters

Returns: list(point|number, ...): points or curve parameters based on the value of return_points
none on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve", rs.filter.curve)
if obj:
    points = rs.DivideCurveEquidistant(obj, 4, True)
```

See also: DivideCurve, DivideCurveLength

## DivideCurveLength

```python
rs.DivideCurveLength(curve_id, length, create_points=False, return_points=True)
```

Divides a curve object into segments of a specified length.

Arguments:

    curve_id (guid): identifier of the curve object
    length (number): The length of each segment.
    create_points (bool, optional): Create the division points. If omitted or False,
        points are not created.
    return_points (bool, optional): If omitted or True, points are returned.
        If False, then a list of curve parameters are returned.

Returns: list(point, ...): If return_points is not specified or True, then a list containing division points.
list(number, ...): If return_points is False, then an array containing division curve parameters.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    length = rs.CurveLength(obj) / 4
    points = rs.DivideCurveLength(obj, length)
    for point in points: rs.AddPoint(point)
```

See also: DivideCurve, DivideCurveEquidistant

## EllipseCenterPoint

```python
rs.EllipseCenterPoint(curve_id)
```

Returns the center point of an elliptical-shaped curve object.

Arguments:

    curve_id (guid): identifier of the curve object.

Returns: point: The 3D center point of the ellipse if successful.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select ellipse")
if rs.IsEllipse(obj):
    point = rs.EllipseCenterPoint(obj)
    rs.AddPoint( point )
```

See also: IsEllipse, EllipseQuadPoints

## EllipseQuadPoints

```python
rs.EllipseQuadPoints(curve_id)
```

Returns the quadrant points of an elliptical-shaped curve object.

Arguments:

    curve_id (guid): identifier of the curve object.

Returns: list(point, point, point, point): Four points identifying the quadrants of the ellipse

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select ellipse")
if rs.IsEllipse(obj):
    rs.AddPoints( rs.EllipseQuadPoints(obj) )
```

See also: IsEllipse, EllipseCenterPoint

## EvaluateCurve

```python
rs.EvaluateCurve(curve_id, t, segment_index=-1)
```

Evaluates a curve at a parameter and returns a 3D point

Arguments:

    curve_id (guid): identifier of the curve object
    t (number): the parameter to evaluate
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: point: a 3-D point if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    domain = rs.CurveDomain(obj)
    t = domain[1]/2.0
    point = rs.EvaluateCurve(obj, t)
    rs.AddPoint( point )
```

See also: CurveClosestPoint, IsCurve

## ExplodeCurves

```python
rs.ExplodeCurves(curve_ids, delete_input=False)
```

Explodes, or un-joins, one curves. Polycurves will be exploded into curve
    segments. Polylines will be exploded into line segments. ExplodeCurves will
    return the curves in topological order.

Arguments:

    curve_ids (guid): the curve object(s) to explode.
    delete_input (bool, optional): Delete input objects after exploding if True.

Returns: list(guid, ...): identifying the newly created curve objects

Example:

```python
import rhinoscriptsyntax as rs
crv = rs.GetObject("Select curve to explode", rs.filter.curve)
if rs.IsCurve(crv): rs.ExplodeCurves(crv)
```

See also: IsCurve, IsPolyCurve, IsPolyline, JoinCurves

## ExtendCurve

```python
rs.ExtendCurve(curve_id, extension_type, side, boundary_object_ids)
```

Extends a non-closed curve object by a line, arc, or smooth extension
    until it intersects a collection of objects.

Arguments:

    curve_id (guid): identifier of curve to extend
    extension_type (number):
      0 = line
      1 = arc
      2 = smooth
    side (number):
      0=extend from the start of the curve
      1=extend from the end of the curve
      2=extend from both the start and the end of the curve
    boundary_object_ids (guid): curve, surface, and polysurface objects to extend to

Returns: guid: The identifier of the new object if successful.
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.curve | rs.filter.surface | rs.filter.polysurface
objects = rs.GetObjects("Select boundary objects", filter)
if objects:
    curve = rs.GetObject("Select curve to extend", rs.filter.curve)
    if curve: rs.ExtendCurve( curve, 2, 1, objects )
```

See also: ExtendCurveLength, ExtendCurvePoint

## ExtendCurveLength

```python
rs.ExtendCurveLength(curve_id, extension_type, side, length)
```

Extends a non-closed curve by a line, arc, or smooth extension for a
    specified distance

Arguments:

    curve_id (guid): curve to extend
    extension_type (number):
      0 = line
      1 = arc
      2 = smooth
    side (number):
      0=extend from start of the curve
      1=extend from end of the curve
      2=Extend from both ends
    length (number): distance to extend

Returns: guid: The identifier of the new object
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to extend", rs.filter.curve)
if curve:
    length = rs.GetReal("Length to extend", 3.0)
    if length: rs.ExtendCurveLength( curve, 2, 2, length )
```

See also: ExtendCurve, ExtendCurvePoint

## ExtendCurvePoint

```python
rs.ExtendCurvePoint(curve_id, side, point, extension_type=2)
```

Extends a non-closed curve by smooth extension to a point

Arguments:

    curve_id (guid): curve to extend
    side (number):
      0=extend from start of the curve
      1=extend from end of the curve
    point (guid|point): point to extend to
    extension_type (number, optional): type of extension
      0 = Line
      1 = Arc
      2 = Smooth

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to extend", rs.filter.curve)
if curve:
    point = rs.GetPoint("Point to extend to")
    if point: rs.ExtendCurvePoint(curve, 1, point)
```

See also: ExtendCurve, ExtendCurveLength

## FairCurve

```python
rs.FairCurve(curve_id, tolerance=1.0)
```

Fairs a curve. Fair works best on degree 3 (cubic) curves. Fair attempts
    to remove large curvature variations while limiting the geometry changes to
    be no more than the specified tolerance. Sometimes several applications of
    this method are necessary to remove nasty curvature problems.

Arguments:

    curve_id (guid): curve to fair
    tolerance (number, optional): fairing tolerance

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
curves = rs.GetObjects("Select curves to fair", rs.filter.curve)
if curves:
    [rs.FairCurve(curve) for curve in curves]
```

## FitCurve

```python
rs.FitCurve(curve_id, degree=3, distance_tolerance=-1, angle_tolerance=-1)
```

Reduces number of curve control points while maintaining the curve's same
    general shape. Use this function for replacing curves with many control
    points. For more information, see the Rhino help for the FitCrv command.

Arguments:

    curve_id (guid): Identifier of the curve object
    degree (number, optional): The curve degree, which must be greater than 1.
                   The default is 3.
    distance_tolerance (number, optional): The fitting tolerance. If distance_tolerance
        is not specified or <= 0.0, the document absolute tolerance is used.
    angle_tolerance (number, optional): The kink smoothing tolerance in degrees. If
        angle_tolerance is 0.0, all kinks are smoothed. If angle_tolerance
        is > 0.0, kinks smaller than angle_tolerance are smoothed. If
        angle_tolerance is not specified or < 0.0, the document angle
        tolerance is used for the kink smoothing.

Returns: guid: The identifier of the new object
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
oldCurve = rs.GetObject("Select curve to fit", rs.filter.curve)
if oldCurve:
    newCurve = rs.FitCurve(oldCurve)
    if newCurve: rs.DeleteObject(oldCurve)
```

## InsertCurveKnot

```python
rs.InsertCurveKnot(curve_id, parameter, symmetrical=False )
```

Inserts a knot into a curve object

Arguments:

    curve_id (guid): identifier of the curve object
    parameter (number): parameter on the curve
    symmetrical (bool, optional): if True, then knots are added on both sides of
        the center of the curve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select curve for knot insertion", rs.filter.curve)
if obj:
    point = rs.GetPointOnCurve(obj, "Point on curve to add knot")
    if point:
        parameter = rs.CurveClosestPoint(obj, point)
        rs.InsertCurveKnot( obj, parameter )
```

See also: CurveKnotCount, CurveKnots

## IsArc

```python
rs.IsArc(curve_id, segment_index=-1)
```

Verifies an object is an open arc curve

Arguments:

    curve_id (guid): Identifier of the curve object
    segment_index (number): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select an arc")
if rs.IsArc(obj):
    print("The object is an arc.")
else:
    print("The object is not an arc.")
```

See also: AddArc3Pt, ArcAngle, ArcCenterPoint, ArcMidPoint, ArcRadius

## IsCircle

```python
rs.IsCircle(curve_id, tolerance=None)
```

Verifies an object is a circle curve

Arguments:

    curve_id (guid): Identifier of the curve object
    tolerance (number, optional) If the curve is not a circle, then the tolerance used
      to determine whether or not the NURBS form of the curve has the
      properties of a circle. If omitted, Rhino's internal zero tolerance is used

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a circle")
if rs.IsCircle(obj):
    print("The object is a circle.")
else:
    print("The object is not a circle.")
```

See also: AddCircle, AddCircle3Pt, CircleCenterPoint, CircleCircumference, CircleRadius

## IsCurve

```python
rs.IsCurve(object_id)
```

Verifies an object is a curve

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    print("The object is a curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurveClosed, IsCurveLinear, IsCurvePeriodic, IsCurvePlanar

## IsCurveClosable

```python
rs.IsCurveClosable(curve_id, tolerance=None)
```

Decide if it makes sense to close off the curve by moving the end point
    to the start point based on start-end gap size and length of curve as
    approximated by chord defined by 6 points

Arguments:

    curve_id (guid): identifier of the curve object
    tolerance[opt] = maximum allowable distance between start point and end
      point. If omitted, the document's current absolute tolerance is used

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
crv = rs.GetObject("Select curve", rs.filter.curve)
if not rs.IsCurveClosed(crv) and rs.IsCurveClosable(crv):
    rs.CloseCurve( crv, 0.1 )
```

See also: CloseCurve, IsCurveClosed

## IsCurveClosed

```python
rs.IsCurveClosed(object_id)
```

Verifies an object is a closed curve object

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if successful otherwise False.  None on error

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a curve")
if rs.IsCurve(object):
    if rs.IsCurveClosed(oObject):
        print("The object is a closed curve.")
    else:
        print("The object is not a closed curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurve, IsCurveLinear, IsCurvePeriodic, IsCurvePlanar

## IsCurveInPlane

```python
rs.IsCurveInPlane(object_id, plane=None)
```

Test a curve to see if it lies in a specific plane

Arguments:

    object_id (guid): the object's identifier
    plane (plane, optional): plane to test. If omitted, the active construction plane is used

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj) and rs.IsCurvePlanar(obj):
    if rs.IsCurveInPlane(obj):
        print("The curve lies in the current cplane.")
    else:
        print("The curve does not lie in the current cplane.")
else:
    print("The object is not a planar curve.")
```

See also: IsCurve, IsCurvePlanar

## IsCurveLinear

```python
rs.IsCurveLinear(object_id, segment_index=-1)
```

Verifies an object is a linear curve

Arguments:

    curve_id (guid):identifier of the curve object
    segment_index (number): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select a curve")
if rs.IsCurve(id):
    if rs.IsCurveLinear(id):
        print("The object is a linear curve.")
    else:
        print("The object is not a linear curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurve, IsCurveClosed, IsCurvePeriodic, IsCurvePlanar

## IsCurvePeriodic

```python
rs.IsCurvePeriodic(curve_id, segment_index=-1)
```

Verifies an object is a periodic curve object

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    if rs.IsCurvePeriodic(obj):
        print("The object is a periodic curve.")
    else:
        print("The object is not a periodic curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurve, IsCurveClosed, IsCurveLinear, IsCurvePlanar

## IsCurvePlanar

```python
rs.IsCurvePlanar(curve_id, segment_index=-1)
```

Verifies an object is a planar curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    if rs.IsCurvePlanar(obj):
        print("The object is a planar curve.")
    else:
        print("The object is not a planar curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurve, IsCurveClosed, IsCurveLinear, IsCurvePeriodic

## IsCurveRational

```python
rs.IsCurveRational(curve_id, segment_index=-1)
```

Verifies an object is a rational NURBS curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    if rs.IsCurveRational(obj):
        print("The object is a rational NURBS curve.")
    else:
        print("The object is not a rational NURBS curve.")
else:
    print("The object is not a curve.")
```

See also: IsCurve, IsCurveClosed, IsCurveLinear, IsCurvePeriodic

## IsEllipse

```python
rs.IsEllipse(object_id, segment_index=-1)
```

Verifies an object is an elliptical-shaped curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select an ellipse")
if rs.IsEllipse(obj):
    print("The object is an ellipse.")
else:
    print("The object is not an ellipse.")
```

See also: EllipseCenterPoint, EllipseQuadPoints

## IsLine

```python
rs.IsLine(object_id, segment_index=-1)
```

Verifies an object is a line curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a line")
if rs.IsLine(obj):
    print("The object is a line.")
else:
    print("The object is not a line.")
```

See also: AddLine

## IsPointOnCurve

```python
rs.IsPointOnCurve(object_id, point, segment_index=-1)
```

Verifies that a point is on a curve

Arguments:

    curve_id (guid): identifier of the curve object
    point (point): the test point
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve")
if rs.IsCurve(obj):
    point = rs.GetPoint("Pick a test point")
    if point:
        if rs.IsPointOnCurve(obj, point):
            print("The point is on the curve")
        else:
            print("The point is not on the curve")
```

See also: IsCurve

## IsPolyCurve

```python
rs.IsPolyCurve(object_id, segment_index=-1)
```

Verifies an object is a PolyCurve curve

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional) the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polycurve")
if rs.IsPolyCurve(obj):
    print("The object is a polycurve.")
else:
    print("The object is not a polycurve.")
```

See also: PolyCurveCount

## IsPolyline

```python
rs.IsPolyline( object_id, segment_index=-1 )
```

Verifies an object is a Polyline curve object

Arguments:

    curve_id (guid): identifier of the curve object
    segment_index (number, optional): the curve segment index if `curve_id` identifies a polycurve

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polyline")
if rs.IsPolyline(obj):
    print("The object is a polyline.")
else:
    print("The object is not a polyline.")
```

See also: IsPolyline, PolylineVertices

## JoinCurves

```python
rs.JoinCurves(object_ids, delete_input=False, tolerance=None)
```

Joins multiple curves together to form one or more curves or polycurves

Arguments:

    object_ids (guid): list of multiple curves
    delete_input (bool, optional): delete input objects after joining
    tolerance (number, optional): join tolerance. If omitted, 2.1 * document absolute
        tolerance is used

Returns: list(guid, ...): Object id representing the new curves

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select curves to join", rs.filter.curve)
if objs: rs.JoinCurves(objs)
```

See also: ExplodeCurves, IsCurve, IsCurveClosed

## LineFitFromPoints

```python
rs.LineFitFromPoints(points)
```

Returns a line that was fit through an array of 3D points

Arguments:

    points ([point, point, ...]): a list of at least two 3D points

Returns: line: line on success

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints()
if points and len(points)>1:
    line=rs.LineFitFromPoints(points)
    if line: rs.AddLine(line.From, line.To)
```

See also: AddLine, CurveEndPoint, CurveStartPoint

## MakeCurveNonPeriodic

```python
rs.MakeCurveNonPeriodic(curve_id, delete_input=False)
```

Makes a periodic curve non-periodic. Non-periodic curves can develop
    kinks when deformed

Arguments:

    curve_id (guid): identifier of the curve object
    delete_input (bool): delete the input curve. If omitted, the input curve will not be deleted.

Returns: guid: id of the new or modified curve if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve", rs.filter.curve)
if rs.IsCurvePeriodic(curve): rs.MakeCurveNonPeriodic( curve )
```

See also: IsCurvePeriodic

## MeanCurve

```python
rs.MeanCurve(curve0, curve1, tolerance=None)
```

Creates an average curve from two curves

Arguments:

    curve0, curve1 (guid): identifiers of two curves
    tolerance (number, optional): angle tolerance used to match kinks between curves

Returns: guid: id of the new or modified curve if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve0 = rs.GetObject("Select the first curve", rs.filter.curve)
curve1 = rs.GetObject("Select the second curve", rs.filter.curve)
rs.MeanCurve( curve0, curve1 )
```

See also: UnitAngleTolerance

## MeshPolyline

```python
rs.MeshPolyline(polyline_id)
```

Creates a polygon mesh object based on a closed polyline curve object.
    The created mesh object is added to the document

Arguments:

    polyline_id (guid): identifier of the polyline curve object

Returns: guid: identifier of the new mesh object
None: on error

Example:

```python
import rhinoscriptsyntax as rs
polyline = rs.GetObject("Select a polyline", rs.filter.curve)
if polyline:
    if rs.IsPolyline(polyline) and rs.IsCurveClosed(polyline):
        rs.MeshPolyline( polyline )
```

See also: IsCurveClosed, IsPolyline

## OffsetCurve

```python
rs.OffsetCurve(object_id, direction, distance, normal=None, style=1)
```

Offsets a curve by a distance. The offset curve will be added to Rhino

Arguments:

    object_id (guid): identifier of a curve object
    direction (point): point describing direction of the offset
    distance (number): distance of the offset
    normal (vector, optional): normal of the plane in which the offset will occur.
        If omitted, the normal of the active construction plane will be used
    style (number, optional): the corner style. If omitted, the style is sharp.
                              0 = None
                              1 = Sharp
                              2 = Round
                              3 = Smooth
                              4 = Chamfer

Returns: list(guid, ...): list of ids for the new curves on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a curve", rs.filter.curve)
if rs.IsCurve(obj):
    rs.OffsetCurve( obj, [0,0,0], 1.0 )
```

See also: OffsetCurveOnSurface, OffsetSurface

## OffsetCurveOnSurface

```python
rs.OffsetCurveOnSurface(curve_id, surface_id, distance_or_parameter)
```

Offset a curve on a surface. The source curve must lie on the surface.
    The offset curve or curves will be added to Rhino

Arguments:

    curve_id, surface_id (guid): curve and surface identifiers
    distance_or_parameter (number|tuple(number, number)): If a single number is passed, then this is the
      distance of the offset. Based on the curve's direction, a positive value
      will offset to the left and a negative value will offset to the right.
      If a tuple of two values is passed, this is interpreted as the surface
      U,V parameter that the curve will be offset through

Returns: list(guid, ...): identifiers of the new curves if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
def TestOffset():
    curve = rs.GetObject("Select curve on a surface", rs.filter.curve)
    if curve is None: return False
    surface = rs.GetObject("Select base surface", rs.filter.surface)
    if surface is None: return False
    point = rs.GetPointOnSurface( surface, "Through point" )
    if point is None: return False
    parameter = rs.SurfaceClosestPoint(surface, point)
    rc = rs.OffsetCurveOnSurface( curve, surface, parameter )
    return rc is not None
       
TestOffset()
```

See also: OffsetCurve, OffsetSurface

## PlanarClosedCurveContainment

```python
rs.PlanarClosedCurveContainment(curve_a, curve_b, plane=None, tolerance=None)
```

Determines the relationship between the regions bounded by two coplanar
    simple closed curves

Arguments:

    curve_a, curve_b (guid): identifiers of two planar, closed curves
    plane (plane, optional): test plane. If omitted, the currently active construction
      plane is used
    tolerance (number, optional): if omitted, the document absolute tolerance is used

Returns: number: a number identifying the relationship if successful
  0 = the regions bounded by the curves are disjoint
  1 = the two curves intersect
  2 = the region bounded by curve_a is inside of curve_b
  3 = the region bounded by curve_b is inside of curve_a
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
curve1 = rs.GetObject("Select first curve", rs.filter.curve )
curve2 = rs.GetObject("Select second curve", rs.filter.curve )
if rs.IsCurvePlanar(curve1) and rs.IsCurvePlanar(curve2):
    if rs.IsCurveClosed(curve1) and rs.IsCurveClosed(curve2):
        if rs.IsCurveInPlane(curve1) and rs.IsCurveInPlane(curve2):
            result = rs.PlanarClosedCurveContainment(curve1, curve2)
            if result==0: print("The regions bounded by the curves are disjoint.")
            elif result==1: print("The two curves intersect..")
            elif result==2: print("The region bounded by Curve1 is inside of Curve2.")
            else: print("The region bounded by Curve2 is inside of Curve1.")
```

See also: PlanarCurveCollision, PointInPlanarClosedCurve

## PlanarCurveCollision

```python
rs.PlanarCurveCollision(curve_a, curve_b, plane=None, tolerance=None)
```

Determines if two coplanar curves intersect

Arguments:

    curve_a, curve_b (guid): identifiers of two planar curves
    plane (plane, optional): test plane. If omitted, the currently active construction
      plane is used
    tolerance (number, optional): if omitted, the document absolute tolerance is used

Returns: bool: True if the curves intersect; otherwise False

Example:

```python
import rhinoscriptsyntax as rs
curve1 = rs.GetObject("Select first curve")
curve2 = rs.GetObject("Select second curve")
if( rs.IsCurvePlanar(curve1) and rs.IsCurvePlanar(curve2) and rs.IsCurveInPlane(curve1) and rs.IsCurveInPlane(curve2) ):
    if rs.PlanarCurveCollision(curve1, curve2):
        print("The coplanar curves intersect.")
    else:
        print("The coplanar curves do not intersect.")
```

See also: CurveCurveIntersection, PlanarClosedCurveContainment, PointInPlanarClosedCurve

## PointInPlanarClosedCurve

```python
rs.PointInPlanarClosedCurve(point, curve, plane=None, tolerance=None)
```

Determines if a point is inside of a closed curve, on a closed curve, or
    outside of a closed curve

Arguments:

    point (point|guid): text point
    curve (guid): identifier of a curve object
    plane (plane, optional): plane containing the closed curve and point. If omitted,
        the currently active construction plane is used
    tolerance (number, optional) it omitted, the document abosulte tolerance is used

Returns: number: number identifying the result if successful
        0 = point is outside of the curve
        1 = point is inside of the curve
        2 = point in on the curve

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a planar, closed curve", rs.filter.curve)
if rs.IsCurveClosed(curve) and rs.IsCurvePlanar(curve):
    point = rs.GetPoint("Pick a point")
    if point:
        result = rs.PointInPlanarClosedCurve(point, curve)
        if result==0: print("The point is outside of the closed curve.")
        elif result==1: print("The point is inside of the closed curve.")
        else: print("The point is on the closed curve.")
```

See also: PlanarClosedCurveContainment, PlanarCurveCollision

## PolyCurveCount

```python
rs.PolyCurveCount(curve_id, segment_index=-1)
```

Returns the number of curve segments that make up a polycurve

Arguments:

    curve_id (guid): the object's identifier
    segment_index (number, optional): if `curve_id` identifies a polycurve object, then `segment_index` identifies the curve segment of the polycurve to query.

Returns: number: the number of curve segments in a polycurve if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polycurve")
if rs.IsPolyCurve(obj):
    count = rs.PolyCurveCount(obj)
    if count: print("The polycurve contains {} curves".format(count))
```

See also: IsPolyCurve

## PolylineVertices

```python
rs.PolylineVertices(curve_id, segment_index=-1)
```

Returns the vertices of a polyline curve on success

Arguments:

    curve_id (guid): the object's identifier
    segment_index (number, optional): if curve_id identifies a polycurve object, then segment_index identifies the curve segment of the polycurve to query.

Returns: list(point, ...): an list of Point3d vertex points if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polyline")
if rs.IsPolyline(obj):
    points = rs.PolylineVertices(obj)
    if points:
        for point in points: rs.AddPoint(point)
```

See also: AddPolyline, IsPolyline

## ProjectCurveToMesh

```python
rs.ProjectCurveToMesh(curve_ids, mesh_ids, direction)
```

Projects one or more curves onto one or more surfaces or meshes

Arguments:

    curve_ids ([guid, ...]): identifiers of curves to project
    mesh_ids ([guid, ...]): identifiers of meshes to project onto
    direction (vector): projection direction

Returns: list(guid, ...): list of identifiers for the resulting curves.

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh to project onto", rs.filter.mesh)
curve= rs.GetObject("Select curve to project", rs.filter.curve)
#Project down...
results = rs.ProjectCurveToMesh(curve, mesh, (0,0,-1))
```

See also: ProjectCurveToSurface, ProjectPointToMesh, ProjectPointToSurface

## ProjectCurveToSurface

```python
rs.ProjectCurveToSurface(curve_ids, surface_ids, direction)
```

Projects one or more curves onto one or more surfaces or polysurfaces

Arguments:

    curve_ids ([guid, ...]): identifiers of curves to project
    surface_ids ([guid, ...]): identifiers of surfaces to project onto
    direction (vector): projection direction

Returns: list(guid, ...): list of identifiers

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface to project onto", rs.filter.surface)
curve = rs.GetObject("Select curve to project", rs.filter.curve)
# Project down...
results = rs.ProjectCurveToSurface(curve, surface, (0,0,-1))
```

See also: ProjectCurveToMesh, ProjectPointToMesh, ProjectPointToSurface

## RebuildCurve

```python
rs.RebuildCurve(curve_id, degree=3, point_count=10)
```

Rebuilds a curve to a given degree and control point count. For more
    information, see the Rhino help for the Rebuild command.

Arguments:

    curve_id (guid): identifier of the curve object
    degree (number, optional): new degree (must be greater than 0)
    point_count (number, optional) new point count, which must be bigger than degree.

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to rebuild", rs.filter.curve)
if curve: rs.RebuildCurve(curve, 3, 10)
```

See also: RebuildSurface

## RemoveCurveKnot

```python
rs.RemoveCurveKnot(curve, parameter)
```

Deletes a knot from a curve object.

Arguments:

    curve (guid): The reference of the source object
    parameter (number): The parameter on the curve. Note, if the parameter is not equal to one
                    of the existing knots, then the knot closest to the specified parameter
                    will be removed.

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs

crv_info = rs.GetCurveObject("Select curve near knot to be removed")
if crv_info:
    crv_id = crv_info[0]
    crv_param = crv_info[4]
    rs.RemoveCurveKnot(crv_id, crv_param)
```

See also: RemoveSurfaceKnot

## ReverseCurve

```python
rs.ReverseCurve(curve_id)
```

Reverses the direction of a curve object. Same as Rhino's Dir command

Arguments:

    curve_id (guid): identifier of the curve object

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve to reverse")
if rs.IsCurve(curve): rs.ReverseCurve(curve)
```

See also: CurveDirectionsMatch

## SimplifyCurve

```python
rs.SimplifyCurve(curve_id, flags=0)
```

Replace a curve with a geometrically equivalent polycurve.
    
    The polycurve will have the following properties:
     - All the polycurve segments are lines, polylines, arcs, or NURBS curves.
     - The NURBS curves segments do not have fully multiple interior knots.
     - Rational NURBS curves do not have constant weights.
     - Any segment for which IsCurveLinear or IsArc is True is a line, polyline segment, or an arc.
     - Adjacent co-linear or co-circular segments are combined.
     - Segments that meet with G1-continuity have there ends tuned up so that they meet with G1-continuity to within machine precision.
     - If the polycurve is a polyline, a polyline will be created

Arguments:

    curve_id (guid): the object's identifier
    flags (number, optional): the simplification methods to use. By default, all methods are used (flags = 0)
      Value Description
      0     Use all methods.
      1     Do not split NURBS curves at fully multiple knots.
      2     Do not replace segments with IsCurveLinear = True with line curves.
      4     Do not replace segments with IsArc = True with arc curves.
      8     Do not replace rational NURBS curves with constant denominator with an equivalent non-rational NURBS curve.
      16    Do not adjust curves at G1-joins.
      32    Do not merge adjacent co-linear lines or co-circular arcs or combine consecutive line segments into a polyline.

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve to simplify", rs.filter.curve)
if curve: rs.SimplifyCurve(curve)
```

See also: IsArc, IsCurveLinear

## SplitCurve

```python
rs.SplitCurve(curve_id, parameter, delete_input=True)
```

Splits, or divides, a curve at a specified parameter. The parameter must
    be in the interior of the curve's domain

Arguments:

    curve_id (guid): the curve to split
    parameter ({number, ...]) one or more parameters to split the curve at
    delete_input (bool, optional): delete the input curve

Returns: list(guid, ....): list of new curves on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve to split", rs.filter.curve)
if rs.IsCurve(curve):
    domain = rs.CurveDomain(curve)
    parameter = domain[1] / 2.0
    rs.SplitCurve( curve, parameter )
```

See also: TrimCurve

## TrimCurve

```python
rs.TrimCurve(curve_id, interval, delete_input=True)
```

Trims a curve by removing portions of the curve outside a specified interval

Arguments:

    curve_id (guid):the curve to trim
    interval ([number, number]): two numbers identifying the interval to keep. Portions of
      the curve before domain[0] and after domain[1] will be removed. If the
      input curve is open, the interval must be increasing. If the input
      curve is closed and the interval is decreasing, then the portion of
      the curve across the start and end of the curve is returned
    delete_input (bool): delete the input curve. If omitted the input curve is deleted.

Returns: list(guid, ...): identifier of the new curve on success
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select a curve to trim", rs.filter.curve)
if rs.IsCurve(curve):
    domain = rs.CurveDomain(curve)
    domain[1] /= 2.0
    rs.TrimCurve( curve, domain )
```

See also: SplitCurve
