# rhinoscriptsyntax: surface

## AddBox

```python
rs.AddBox(corners)
```

Adds a box shaped polysurface to the document

Arguments:

    corners ([point, point, point ,point, point, point ,point,point]) 8 points that define the corners of the box. Points need to
      be in counter-clockwise order starting with the bottom rectangle of the box

Returns: guid: identifier of the new object on success

Example:

```python
import rhinoscriptsyntax as rs
box = rs.GetBox()
if box: rs.AddBox(box)
```

See also: AddCone, AddCylinder, AddSphere, AddTorus

## AddCone

```python
rs.AddCone(base, height, radius, cap=True)
```

Adds a cone shaped polysurface to the document

Arguments:

    base (point|plane): 3D origin point of the cone or a plane with an apex at the origin
        and normal along the plane's z-axis
    height (point|number): 3D height point of the cone if base is a 3D point. The height
        point defines the height and direction of the cone. If base is a
        plane, height is a numeric value
    radius (number): the radius at the base of the cone
    cap (bool, optional): cap base of the cone

Returns: guid: identifier of the new object on success

Example:

```python
import rhinoscriptsyntax as rs
radius = 5.0
base = rs.GetPoint("Base of cone")
if base:
    height = rs.GetPoint("Height of cone", base)
    if height: rs.AddCone(base, height, radius)
```

See also: AddBox, AddCylinder, AddSphere, AddTorus

## AddCutPlane

```python
rs.AddCutPlane(object_ids, start_point, end_point, normal=None)
```

Adds a planar surface through objects at a designated location. For more
    information, see the Rhino help file for the CutPlane command

Arguments:

    objects_ids ([guid, ...]): identifiers of objects that the cutting plane will
        pass through
    start_point, end_point (line): line that defines the cutting plane
    normal (vector, optional): vector that will be contained in the returned planar
        surface. In the case of Rhino's CutPlane command, this is the
        normal to, or Z axis of, the active view's construction plane.
        If omitted, the world Z axis is used

Returns: guid: identifier of new object on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects for cut plane")
if objs:
    point0 = rs.GetPoint("Start of cut plane")
    if point0:
        point1 = rs.GetPoint("End of cut plane", point0)
        if point1: rs.AddCutPlane( objs, point0, point1 )
```

See also: AddPlaneSurface

## AddCylinder

```python
rs.AddCylinder(base, height, radius, cap=True)
```

Adds a cylinder-shaped polysurface to the document

Arguments:

    base (point|plane): The 3D base point of the cylinder or the base plane of the cylinder
    height (point|number): if base is a point, then height is a 3D height point of the
      cylinder. The height point defines the height and direction of the
      cylinder. If base is a plane, then height is the numeric height value
      of the cylinder
    radius (number): radius of the cylinder
    cap (bool, optional): cap the cylinder

Returns: guid: identifier of new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
radius = 5.0
base = rs.GetPoint("Base of cylinder")
if base:
    height = rs.GetPoint("Height of cylinder", base)
    if height: rs.AddCylinder( base, height, radius )
```

See also: AddBox, AddCone, AddSphere, AddTorus

## AddEdgeSrf

```python
rs.AddEdgeSrf(curve_ids)
```

Creates a surface from 2, 3, or 4 edge curves

Arguments:

    curve_ids ([guid, ...]): list or tuple of curves

Returns: guid: identifier of new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curves = rs.GetObjects("Select 2, 3, or 4 curves", rs.filter.curve)
if curves and len(curves)>1 ): rs.AddEdgeSrf(curves)
```

See also: AddPlanarSrf, AddSrfControlPtGrid, AddSrfPt, AddSrfPtGrid

## AddLoftSrf

```python
rs.AddLoftSrf(object_ids, start=None, end=None, loft_type=0, simplify_method=0, value=0, closed=False)
```

Adds a surface created by lofting curves to the document.
    - no curve sorting performed. pass in curves in the order you want them sorted
    - directions of open curves not adjusted. Use CurveDirectionsMatch and
      ReverseCurve to adjust the directions of open curves
    - seams of closed curves are not adjusted. Use CurveSeam to adjust the seam
      of closed curves

Arguments:

    object_ids ({guid, guid, ...]): ordered list of the curves to loft through
    start (point, optional): starting point of the loft
    end (point, optional): ending point of the loft
    loft_type (number, optional): type of loft. Possible options are:
      0 = Normal. Uses chord-length parameterization in the loft direction
      1 = Loose. The surface is allowed to move away from the original curves
          to make a smoother surface. The surface control points are created
          at the same locations as the control points of the loft input curves.
      2 = Straight. The sections between the curves are straight. This is
          also known as a ruled surface.
      3 = Tight. The surface sticks closely to the original curves. Uses square
          root of chord-length parameterization in the loft direction
      4 = Developable. Creates a separate developable surface or polysurface
          from each pair of curves.
    simplify_method (number, optional): Possible options are:
      0 = None. Does not simplify.
      1 = Rebuild. Rebuilds the shape curves before lofting. modified by `value` below
      2 = Refit. Refits the shape curves to a specified tolerance. modified by `value` below
    value (number, optional): Additional value based on the specified `simplify_method`:
      Simplify  -   Description
      Rebuild(1) - then value is the number of control point used to rebuild
      Rebuild(1) - is specified and this argument is omitted, then curves will be
                   rebuilt using 10 control points.
      Refit(2) - then value is the tolerance used to rebuild.
      Refit(2) - is specified and this argument is omitted, then the document's
                   absolute tolerance us used for refitting.
    closed (bool, optional): close the loft back to the first curve

Returns: list(guid, ...):Array containing the identifiers of the new surface objects if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Pick curves to loft", rs.filter.curve)
if objs: rs.AddLoftSrf(objs)
```

See also: CurveDirectionsMatch, CurveSeam, ReverseCurve

## AddNetworkSrf

```python
rs.AddNetworkSrf(curves, continuity=1, edge_tolerance=0, interior_tolerance=0, angle_tolerance=0)
```

Creates a surface from a network of crossing curves

Arguments:

    curves ([guid, ...]): curves from which to create the surface
    continuity (number, optional): how the edges match the input geometry
               0 = loose
               1 = position
               2 = tangency
               3 = curvature

Returns: guid: identifier of new object if successful

Example:

```python
import rhinoscriptsyntax as  rs
curve_ids = rs.GetObjects("Select  curves in network", 4, True, True)
if len(curve_ids) > 0:
    rs.AddNetworkSrf(curve_ids)
```

## AddNurbsSurface

```python
rs.AddNurbsSurface(point_count, points, knots_u, knots_v, degree, weights=None)
```

Adds a NURBS surface object to the document

Arguments:

    point_count ([number, number]) number of control points in the u and v direction
    points ({point, ...]): list of 3D points
    knots_u ([number, ...]): knot values for the surface in the u direction.
              Must contain point_count[0]+degree[0]-1 elements
    knots_v ([number, ...]): knot values for the surface in the v direction.
              Must contain point_count[1]+degree[1]-1 elements
    degree ([number, number]): degree of the surface in the u and v directions.
    weights [(number, ...]): weight values for the surface. The number of elements in
      weights must equal the number of elements in points. Values must be
      greater than zero.

Returns: guid: identifier of new object if successful
None on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Pick a surface", rs.filter.surface)
if obj:
    point_count = rs.SurfacePointCount(obj)
    points = rs.SurfacePoints(obj)
    knots = rs.SurfaceKnots(obj)
    degree = rs.SurfaceDegree(obj)
    if rs.IsSurfaceRational(obj):
        weights = rs.SurfaceWeights(obj)
        obj = rs.AddNurbsSurface(point_count, points, knots[0], knots[1], degree, weights)
    else:
        obj = rs.AddNurbsSurface(point_count, points, knots[0], knots[1], degree)
    if obj: rs.SelectObject(obj)
```

See also: IsSurfaceRational, SurfaceDegree, SurfaceKnotCount, SurfaceKnots, SurfacePointCount, SurfacePoints, SurfaceWeights

## AddPatch

```python
rs.AddPatch(object_ids, uv_spans_tuple_OR_surface_object_id, tolerance=None, trim=True, point_spacing=0.1, flexibility=1.0, surface_pull=1.0, fix_edges=False)
```

Fits a surface through curve, point, point cloud, and mesh objects.

Arguments:

    object_ids ({guid, ...]): a list of object identifiers that indicate the objects to use for the patch fitting.
        Acceptable object types include curves, points, point clouds, and meshes.
    uv_spans_tuple_OR_surface_object_id ([number, number]|guid):  the U and V direction span counts for the automatically generated surface OR
        The identifier of the starting surface.  It is best if you create a starting surface that is similar in shape 
        to the surface you are trying to create.
    tolerance (number, optional): The tolerance used by input analysis functions. If omitted, Rhino's document absolute tolerance is used.
    trim (bool, optional): Try to find an outside curve and trims the surface to it.  The default value is True.
    point_spacing (number, optional): The basic distance between points sampled from input curves.  The default value is 0.1.
    flexibility (number, optional): Determines the behavior of the surface in areas where its not otherwise controlled by the input.
        Lower numbers make the surface behave more like a stiff material, higher, more like a flexible material.  
        That is, each span is made to more closely match the spans adjacent to it if there is no input geometry 
        mapping to that area of the surface when the flexibility value is low.  The scale is logarithmic.  
        For example, numbers around 0.001 or 0.1 make the patch pretty stiff and numbers around 10 or 100 
        make the surface flexible.  The default value is 1.0.
    surface_pull (number, optional): Similar to stiffness, but applies to the starting surface. The bigger the pull, the closer
        the resulting surface shape will be to the starting surface.  The default value is 1.0.
    fix_edges (bool, optional): Clamps the edges of the starting surface in place. This option is useful if you are using a
        curve or points for deforming an existing surface, and you do not want the edges of the starting surface 
        to move.  The default if False.

Returns: guid: Identifier of the new surface object if successful.
None: on error.

## AddPipe

```python
rs.AddPipe(curve_id, parameters, radii, blend_type=0, cap=0, fit=False)
```

Creates a single walled surface with a circular profile around a curve

Arguments:

    curve_id (guid): identifier of rail curve
    parameters, radii ([number, ...]): list of radius values at normalized curve parameters
    blend_type (number, optional): 0(local) or 1(global)
    cap (number, optional): 0(none), 1(flat), 2(round)
    fit (bool, optional): attempt to fit a single surface

Returns: list(guid, ...): identifiers of new objects created

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to create pipe around", rs.filter.curve, True)
if curve:
    domain = rs.CurveDomain(curve)
    rs.AddPipe(curve, 0, 4)
```

## AddPlanarSrf

```python
rs.AddPlanarSrf(object_ids)
```

Creates one or more surfaces from planar curves

Arguments:

    object_ids ({guid, ...]): curves to use for creating planar surfaces

Returns: list(guid, ...): identifiers of surfaces created on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select planar curves to build surface", rs.filter.curve)
if objs: rs.AddPlanarSrf(objs)
```

See also: AddEdgeSrf, AddSrfControlPtGrid, AddSrfPt, AddSrfPtGrid

## AddPlaneSurface

```python
rs.AddPlaneSurface(plane, u_dir, v_dir)
```

Create a plane surface and add it to the document.

Arguments:

    plane (plane): The plane.
    u_dir (number): The magnitude in the U direction.
    v_dir (number): The magnitude in the V direction.

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
rs.AddPlaneSurface( rs.WorldXYPlane(), 5.0, 3.0 )
```

See also: AddCutPlane, AddEdgeSrf, AddSrfControlPtGrid, AddSrfPt, AddSrfPtGrid, IsPlaneSurface

## AddRailRevSrf

```python
rs.AddRailRevSrf(profile, rail, axis, scale_height=False)
```

Adds a surface created through profile curves that define the surface
    shape and two curves that defines a surface edge.

Arguments:

    profile (guid): identifier of the profile curve
    rail (guid): identifier of the rail curve
    axis ([point, point]): A list of two 3-D points identifying the start point and end point of the rail revolve axis, or a Line
    scale_height (bool, optional): If True, surface will be locally scaled. Defaults to False

Returns: guid: identifier of the new object if successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
profile = rs.GetObject("Select a profile", rs.filter.curve)
if profile:
    rail = rs.GetObject("Select a rail", rs.filter.curve)
    if rail:
        rs.AddRailRevSrf(profile, rail, ((0,0,0),(0,0,1)))
```

See also: AddSweep1, CurveDirectionsMatch, ReverseCurve

## AddRevSrf

```python
rs.AddRevSrf(curve_id, axis, start_angle=0.0, end_angle=360.0)
```

Create a surface by revolving a curve around an axis

Arguments:

    curve_id (guid): identifier of profile curve
    axis (line): line for the rail revolve axis
    start_angle, end_angle (number, optional): start and end angles of revolve

Returns: guid: identifier of new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.AddLine((5,0,0), (10,0,10))
rs.AddRevSrf( curve, ((0,0,0), (0,0,1)) )
```

## AddSphere

```python
rs.AddSphere(center_or_plane, radius)
```

Add a spherical surface to the document

Arguments:

    center_or_plane (point|plane): center point of the sphere. If a plane is input,
      the origin of the plane will be the center of the sphere
    radius (number): radius of the sphere in the current model units

Returns: guid: identifier of the new object on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
radius = 2
center = rs.GetPoint("Center of sphere")
if center: rs.AddSphere(center, radius)
```

See also: AddBox, AddCone, AddCylinder, AddTorus

## AddSrfContourCrvs

```python
rs.AddSrfContourCrvs(object_id, points_or_plane, interval=None)
```

Adds a spaced series of planar curves resulting from the intersection of
    defined cutting planes through a surface or polysurface. For more
    information, see Rhino help for details on the Contour command

Arguments:

    object_id (guid): object identifier to contour
    points_or_plane ([point,point]|plane): either a list/tuple of two points or a plane
      if two points, they define the start and end points of a center line
      if a plane, the plane defines the cutting plane
    interval (number, optional): distance between contour curves.

Returns: guid: ids of new contour curves on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object", rs.filter.surface + rs.filter.polysurface)
startpoint = rs.GetPoint("Base point of center line")
endpoint = rs.GetPoint("Endpoint of center line", startpoint)
rs.AddSrfContourCrvs( obj, (startpoint, endpoint) )
```

See also: CurveContourPoints

## AddSrfControlPtGrid

```python
rs.AddSrfControlPtGrid(count, points, degree=(3,3))
```

Creates a surface from a grid of points

Arguments:

    count ([number, number])tuple of two numbers defining number of points in the u,v directions
    points ([point, ...]): list of 3D points
    degree ([number, number]): two numbers defining degree of the surface in the u,v directions

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

## AddSrfPt

```python
rs.AddSrfPt(points)
```

Creates a new surface from either 3 or 4 corner points.

Arguments:

    points ([point, point, point, point]): list of either 3 or 4 corner points

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True, message1="Pick 3 or 4 corner points")
if points: rs.AddSrfPt(points)
```

See also: AddEdgeSrf, AddSrfControlPtGrid, AddSrfPtGrid

## AddSrfPtGrid

```python
rs.AddSrfPtGrid(count, points, degree=(3,3), closed=(False,False))
```

Creates a surface from a grid of points

Arguments:

    count ([number, number}): tuple of two numbers defining number of points in the u,v directions
    points ([point, ...]): list of 3D points
    degree ([number, number], optional): two numbers defining degree of the surface in the u,v directions
    closed ([bool, bool], optional): two booleans defining if the surface is closed in the u,v directions

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

## AddSweep1

```python
rs.AddSweep1(rail, shapes, closed=False)
```

Adds a surface created through profile curves that define the surface
    shape and one curve that defines a surface edge.

Arguments:

    rail (guid): identifier of the rail curve
    shapes ([guid, ...]): one or more cross section shape curves
    closed (bool, optional): If True, then create a closed surface

Returns: list(guid, ...): of new surface objects if successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
rail = rs.GetObject("Select rail curve", rs.filter.curve)
if rail:
    shapes = rs.GetObjects("Select cross-section curves", rs.filter.curve)
    if shapes: rs.AddSweep1( rail, shapes )
```

See also: AddSweep2, CurveDirectionsMatch, ReverseCurve

## AddSweep2

```python
rs.AddSweep2(rails, shapes, closed=False)
```

Adds a surface created through profile curves that define the surface
    shape and two curves that defines a surface edge.

Arguments:

    rails ([guid, guid]): identifiers of the two rail curve
    shapes ([guid, ...]): one or more cross section shape curves
    closed (bool, optional): If True, then create a closed surface

Returns: list(guid, ...): of new surface objects if successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
rails = rs.GetObjects("Select two rail curve", rs.filter.curve)
if rails and len(rails)==2:
    shapes = rs.GetObjects("Select cross-section curves", rs.filter.curve)
    if shapes: rs.AddSweep2(rails, shapes)
```

See also: AddSweep1, CurveDirectionsMatch, ReverseCurve

## AddTorus

```python
rs.AddTorus(base, major_radius, minor_radius, direction=None)
```

Adds a torus shaped revolved surface to the document

Arguments:

    base (point): 3D origin point of the torus or the base plane of the torus
    major_radius, minor_radius (number): the two radii of the torus
    directions (point):  A point that defines the direction of the torus when base is a point.
      If omitted, a torus that is parallel to the world XY plane is created

Returns: guid: The identifier of the new object if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
major_radius = 5.0
minor_radius = major_radius - 2.0
base = rs.GetPoint("Base of torus")
if base:
    direction = rs.GetPoint("Direction of torus", base)
    if direction:
        rs.AddTorus( base, major_radius, minor_radius, direction )
```

See also: AddBox, AddCone, AddCylinder, AddSphere

## BooleanDifference

```python
rs.BooleanDifference(input0, input1, delete_input=True)
```

Performs a boolean difference operation on two sets of input surfaces
    and polysurfaces. For more details, see the BooleanDifference command in
    the Rhino help file

Arguments:

    input0 ([guid, ...]): list of surfaces to subtract from
    input1 ([guid, ...]): list of surfaces to be subtracted
    delete_input (bool, optional): delete all input objects

Returns: list(guid, ...): of identifiers of newly created objects on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.surface | rs.filter.polysurface
input0 = rs.GetObjects("Select first set of surfaces or polysurfaces", filter)
if input0:
    input1 = rs.GetObjects("Select second set of surfaces or polysurfaces", filter)
    if input1: rs.BooleanDifference(input0, input1)
```

See also: BooleanIntersection, BooleanUnion

## BooleanIntersection

```python
rs.BooleanIntersection(input0, input1, delete_input=True)
```

Performs a boolean intersection operation on two sets of input surfaces
    and polysurfaces. For more details, see the BooleanIntersection command in
    the Rhino help file

Arguments:

    input0 ([guid, ...]): list of surfaces
    input1 ([guid, ...]): list of surfaces
    delete_input (bool, optional): delete all input objects

Returns: list(guid, ...): of identifiers of newly created objects on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
input0 = rs.GetObjects("Select first set of surfaces or polysurfaces", rs.filter.surface | rs.filter.polysurface)
if input0:
    input1 = rs.GetObjects("Select second set of surfaces or polysurfaces", rs.filter.surface | rs.filter.polysurface)
    if input1: rs.BooleanIntersection( input0, input1 )
```

See also: BooleanDifference, BooleanUnion

## BooleanUnion

```python
rs.BooleanUnion(input, delete_input=True)
```

Performs a boolean union operation on a set of input surfaces and
    polysurfaces. For more details, see the BooleanUnion command in the
    Rhino help file

Arguments:

    input ([guid, ...]): list of surfaces to union
    delete_input (bool, optional):  delete all input objects

Returns: list(guid, ...): of identifiers of newly created objects on success
None on error

Example:

```python
import rhinoscriptsyntax as rs
input = rs.GetObjects("Select surfaces or polysurfaces to union", rs.filter.surface | rs.filter.polysurface)
if input and len(input)>1: rs.BooleanUnion(input)
```

See also: BooleanDifference, BooleanUnion

## BrepClosestPoint

```python
rs.BrepClosestPoint(object_id, point)
```

Returns the point on a surface or polysurface that is closest to a test
    point. This function works on both untrimmed and trimmed surfaces.

Arguments:

    object_id (guid): The object's identifier.
    point (point): The test, or sampling point.

Returns: tuple(point, [number, number], [number, number], vector): of closest point information if successful. The list will
contain the following information:
Element     Type             Description
   0        Point3d          The 3-D point at the parameter value of the 
                             closest point.
   1        (U, V)           Parameter values of closest point. Note, V 
                             is 0 if the component index type is brep_edge
                             or brep_vertex. 
   2        (type, index)    The type and index of the brep component that
                             contains the closest point. Possible types are
                             brep_face, brep_edge or brep_vertex.
   3        Vector3d         The normal to the brep_face, or the tangent
                             to the brep_edge.  
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if obj:
    point = rs.GetPoint("Pick a test point")
    if point:
        arrCP = rs.BrepClosestPoint(obj, point)
        if arrCP:
            rs.AddPoint(point)
            rs.AddPoint( arrCP[0] )
```

See also: EvaluateSurface, IsSurface, SurfaceClosestPoint

## CapPlanarHoles

```python
rs.CapPlanarHoles(surface_id)
```

Caps planar holes in a surface or polysurface

Arguments:

    surface_id (guid): The identifier of the surface or polysurface to cap.

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface or polysurface to cap", rs.filter.surface | rs.filter.polysurface)
if surface: rs.CapPlanarHoles( surface )
```

See also: ExtrudeCurve, ExtrudeCurvePoint, ExtrudeCurveStraight, ExtrudeSurface

## ChangeSurfaceDegree

```python
rs.ChangeSurfaceDegree(object_id, degree)
```

Changes the degree of a surface object.  For more information see the Rhino help file for the ChangeDegree command.

Arguments:

    object_id (guid): the object's identifier.
    degree ([number, number]) two integers, specifying the degrees for the U  V directions

Returns: bool: True of False indicating success or failure.
None: on failure.

See also: IsSurface

## DuplicateEdgeCurves

```python
rs.DuplicateEdgeCurves(object_id, select=False)
```

Duplicates the edge curves of a surface or polysurface. For more
    information, see the Rhino help file for information on the DupEdge
    command.

Arguments:

    object_id (guid): The identifier of the surface or polysurface object.
    select (bool, optional):  Select the duplicated edge curves. The default is not
    to select (False).

Returns: list(guid, ..): identifying the newly created curve objects if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select surface or polysurface", rs.filter.surface | rs.filter.polysurface)
if obj:
    rs.DuplicateEdgeCurves( obj, True )
    rs.DeleteObject( obj )
```

See also: IsPolysurface, IsSurface

## DuplicateSurfaceBorder

```python
rs.DuplicateSurfaceBorder(surface_id, type=0)
```

Create curves that duplicate a surface or polysurface border

Arguments:

    surface_id (guid): identifier of a surface
    type (number, optional): the border curves to return
       0=both exterior and interior,
       1=exterior
       2=interior

Returns: list(guid, ...): list of curve ids on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface or polysurface", rs.filter.surface | rs.filter.polysurface)
if surface: rs.DuplicateSurfaceBorder( surface )
```

See also: DuplicateEdgeCurves, DuplicateMeshBorder

## EvaluateSurface

```python
rs.EvaluateSurface(surface_id, u, v)
```

Evaluates a surface at a U,V parameter

Arguments:

    surface_id (guid): the object's identifier.
    u, v ({number, number]): u, v parameters to evaluate.

Returns: point: a 3-D point if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
objectId = rs.GetObject("Select a surface")
if rs.IsSurface(objectId):
    domainU = rs.SurfaceDomain(objectId, 0)
    domainV = rs.SurfaceDomain(objectId, 1)
    u = domainU[1]/2.0
    v = domainV[1]/2.0
    point = rs.EvaluateSurface(objectId, u, v)
    rs.AddPoint( point )
```

See also: IsSurface, SurfaceClosestPoint

## ExplodePolysurfaces

```python
rs.ExplodePolysurfaces(object_ids, delete_input=False)
```

Explodes, or unjoins, one or more polysurface objects. Polysurfaces
    will be exploded into separate surfaces

Arguments:

    object_ids ([guid, ...]): identifiers of polysurfaces to explode
    delete_input 9bool, optional): delete input objects after exploding

Returns: list(guid, ...): of identifiers of exploded pieces on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select polysurface to explode", rs.filter.polysurface)
if rs.IsPolysurface(obj):
    rs.ExplodePolysurfaces( obj )
```

See also: IsPolysurface, IsSurface

## ExtendSurface

```python
rs.ExtendSurface(surface_id, parameter, length, smooth=True)
```

Lengthens an untrimmed surface object

Arguments:

    surface_id (guid): identifier of a surface
    parameter ([number, number}): tuple of two values definfing the U,V parameter to evaluate.
      The surface edge closest to the U,V parameter will be the edge that is
      extended
    length (number): amount to extend to surface
    smooth (bool, optional): If True, the surface is extended smoothly curving from the
      edge. If False, the surface is extended in a straight line from the edge

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
pick = rs.GetObjectEx("Select surface to extend", rs.filter.surface)
if pick:
    parameter = rs.SurfaceClosestPoint(pick[0], pick[3])
    rs.ExtendSurface(pick[0], parameter, 5.0)
```

See also: IsSurface

## ExtractIsoCurve

```python
rs.ExtractIsoCurve(surface_id, parameter, direction)
```

Extracts isoparametric curves from a surface

Arguments:

    surface_id (guid): identifier of a surface
    parameter ([number, number]): u,v parameter of the surface to evaluate
    direction (number): Direction to evaluate
      0 = u
      1 = v
      2 = both

Returns: list(guid, ...): of curve ids on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select surface for isocurve extraction", rs.filter.surface)
point = rs.GetPointOnSurface(obj, "Select location for extraction")
parameter = rs.SurfaceClosestPoint(obj, point)
rs.ExtractIsoCurve( obj, parameter, 2 )
```

See also: IsSurface

## ExtractSurface

```python
rs.ExtractSurface(object_id, face_indices, copy=False)
```

Separates or copies a surface or a copy of a surface from a polysurface

Arguments:

    object_id (guid): polysurface identifier
    face_indices (number, ...): one or more numbers representing faces
    copy (bool, optional): If True the faces are copied. If False, the faces are extracted

Returns: list(guid, ...): identifiers of extracted surface objects on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select polysurface", rs.filter.polysurface, True)
if obj: rs.ExtractSurface(obj, 0)
```

See also: BrepClosestPoint, IsSurface, IsPolysurface

## ExtrudeCurve

```python
rs.ExtrudeCurve(curve_id, path_id)
```

Creates a surface by extruding a curve along a path

Arguments:

    curve_id (guid): identifier of the curve to extrude
    path_id (guid): identifier of the path curve

Returns: guid: identifier of new surface on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.AddCircle(rs.WorldXYPlane(), 5)
path = rs.AddLine([5,0,0], [10,0,10])
rs.ExtrudeCurve( curve, path )
```

See also: ExtrudeCurvePoint, ExtrudeCurveStraight, ExtrudeSurface

## ExtrudeCurvePoint

```python
rs.ExtrudeCurvePoint(curve_id, point)
```

Creates a surface by extruding a curve to a point

Arguments:

    curve_id (guid): identifier of the curve to extrude
    point (point): 3D point

Returns: guid: identifier of new surface on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.AddCircle(rs.WorldXYPlane(), 5)
point = (0,0,10)
rs.ExtrudeCurvePoint( curve, point )
```

See also: ExtrudeCurve, ExtrudeCurveStraight, ExtrudeSurface

## ExtrudeCurveStraight

```python
rs.ExtrudeCurveStraight(curve_id, start_point, end_point)
```

Create surface by extruding a curve along two points that define a line

Arguments:

    curve_id (guid): identifier of the curve to extrude
    start_point, end_point (point): 3D points that specify distance and direction

Returns: guid: identifier of new surface on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.AddCircle(rs.WorldXYPlane(), 5)
rs.ExtrudeCurveStraight( curve, (0,0,0), (0, 10, 10) )
```

See also: ExtrudeCurve, ExtrudeCurvePoint, ExtrudeSurface

## ExtrudeSurface

```python
rs.ExtrudeSurface(surface, curve, cap=True)
```

Create surface by extruding along a path curve

Arguments:

    surface (guid): identifier of the surface to extrude
    curve (guid): identifier of the path curve
    cap (bool, optional): extrusion is capped at both ends

Returns: guid: identifier of new surface on success

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.AddSrfPt([(0,0,0), (5,0,0), (5,5,0), (0,5,0)])
curve = rs.AddLine((5,0,0), (10,0,10))
rs.ExtrudeSurface(surface, curve)
```

See also: ExtrudeCurve, ExtrudeCurvePoint, ExtrudeCurveStraight

## FilletSurfaces

```python
rs.FilletSurfaces(surface0, surface1, radius, uvparam0=None, uvparam1=None)
```

Create constant radius rolling ball fillets between two surfaces. Note,
    this function does not trim the original surfaces of the fillets

Arguments:

    surface0, surface1 (guid): identifiers of first and second surface
    radius (number): a positive fillet radius
    uvparam0 ([number, number], optional): a u,v surface parameter of surface0 near where the fillet
      is expected to hit the surface
    uvparam1([number, number], optional): same as uvparam0, but for surface1

Returns: guid: ids of surfaces created on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface0 = rs.GetObject("First surface", rs.filter.surface)
surface1 = rs.GetObject("Second surface", rs.filter.surface)
rs.FilletSurfaces(surface0, surface1, 2.0)
```

See also: IsSurface

## FlipSurface

```python
rs.FlipSurface(surface_id, flip=None)
```

Returns or changes the normal direction of a surface. This feature can
    also be found in Rhino's Dir command

Arguments:

    surface_id (guid): identifier of a surface object
    flip (bool, optional) new normal orientation, either flipped(True) or not flipped (False).

Returns: vector: if flipped is not specified, the current normal orientation
vector: if flipped is specified, the previous normal orientation
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surf = rs.GetObject("Select object", rs.filter.surface)
if surf:
    flip = rs.FlipSurface(surf)
    if flip: rs.FlipSurface(surf, False)
```

See also: IsSurface

## IntersectBreps

```python
rs.IntersectBreps(brep1, brep2, tolerance=None)
```

Intersects a brep object with another brep object. Note, unlike the
    SurfaceSurfaceIntersection function this function works on trimmed surfaces.

Arguments:

    brep1 (guid): identifier of first brep object
    brep2 (guid): identifier of second brep object
    tolerance (number): Distance tolerance at segment midpoints. If omitted,
                the current absolute tolerance is used.

Returns: list(guid, ...): identifying the newly created intersection curve and point objects if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
brep1 = rs.GetObject("Select the first brep", rs.filter.surface | rs.filter.polysurface)
if brep1:
    brep2 = rs.GetObject("Select the second", rs.filter.surface | rs.filter.polysurface)
    if brep2: rs.IntersectBreps( brep1, brep2)
```

## IntersectSpheres

```python
rs.IntersectSpheres(sphere_plane0, sphere_radius0, sphere_plane1, sphere_radius1)
```

Calculates intersections of two spheres

Arguments:

    sphere_plane0 (plane): an equatorial plane of the first sphere. The origin of the
      plane will be the center point of the sphere
    sphere_radius0 (number): radius of the first sphere
    sphere_plane1 (plane): plane for second sphere
    sphere_radius1 (number): radius for second sphere

Returns: list(number, point, number): of intersection results
  [0] = type of intersection (0=point, 1=circle, 2=spheres are identical)
  [1] = Point of intersection or plane of circle intersection
  [2] = radius of circle if circle intersection
None: on error

Example:

```python
import rhinoscriptsyntax as rs
plane0 = rs.WorldXYPlane()
plane1 = rs.MovePlane(plane0, (10,0,0))
radius = 10
results = rs.IntersectSpheres(plane0, radius, plane1, radius)
if results:
    if results[0] == 0: rs.AddPoint(results[1])
    else: rs.AddCircle( results[1], results[2])
```

See also: IntersectBreps, IntersectPlanes

## IsBrep

```python
rs.IsBrep(object_id)
```

Verifies an object is a Brep, or a boundary representation model, object.

Arguments:

    object_id (guid): The object's identifier.

Returns: bool: True if successful, otherwise False.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a Brep")
if rs.IsBrep(obj):
    print("The object is a Brep.")
else:
    print("The object is not a Brep.")
```

See also: IsPolysurface, IsPolysurfaceClosed, IsSurface

## IsCone

```python
rs.IsCone(object_id)
```

Determines if a surface is a portion of a cone

Arguments:

    object_id (guid): the surface object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if surface:
    if rs.IsCone(surface):
        print("The surface is a portion of a cone.")
    else:
        print("The surface is not a portion of a cone.")
```

See also: IsCylinder, IsSphere, IsSurface, IsTorus

## IsCylinder

```python
rs.IsCylinder(object_id)
```

Determines if a surface is a portion of a cone

Arguments:

    object_id (guid): the cylinder object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if surface:
    if rs.IsCylinder(surface):
        print("The surface is a portion of a cylinder.")
    else:
        print("The surface is not a portion of a cylinder.")
```

See also: IsCone, IsSphere, IsSurface, IsTorus

## IsPlaneSurface

```python
rs.IsPlaneSurface(object_id)
```

Verifies an object is a plane surface. Plane surfaces can be created by
    the Plane command. Note, a plane surface is not a planar NURBS surface

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface to trim", rs.filter.surface)
if surface and rs.IsPlaneSurface(surface):
    print("got a plane surface")
else:
    print("not a plane surface")
```

See also: IsBrep, IsPolysurface, IsSurface

## IsPointInSurface

```python
rs.IsPointInSurface(object_id, point, strictly_in=False, tolerance=None)
```

Verifies that a point is inside a closed surface or polysurface

Arguments:

    object_id (guid): the object's identifier
    point (point): The test, or sampling point
    strictly_in (bool, optional): If true, the test point must be inside by at least tolerance
    tolerance (number, optional): distance tolerance used for intersection and determining
      strict inclusion. If omitted, Rhino's internal tolerance is used

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polysurface", rs.filter.polysurface)
if rs.IsPolysurfaceClosed(obj):
    point = rs.GetPoint("Pick a test point")
    if point:
        if rs.IsPointInSurface(obj, point):
            print("The point is inside the polysurface.")
        else:
            print("The point is not inside the polysurface.")
```

See also: IsPointOnSurface

## IsPointOnSurface

```python
rs.IsPointOnSurface(object_id, point)
```

Verifies that a point lies on a surface

Arguments:

    object_id (guid): the object's identifier
    point (point): The test, or sampling point

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surf = rs.GetObject("Select a surface")
if rs.IsSurface(surf):
    point = rs.GetPoint("Pick a test point")
    if point:
        if rs.IsPointOnSurface(surf, point):
            print("The point is on the surface.")
        else:
            print("The point is not on the surface.")
```

See also: IsPointInSurface

## IsPolysurface

```python
rs.IsPolysurface(object_id)
```

Verifies an object is a polysurface. Polysurfaces consist of two or more
    surfaces joined together. If the polysurface fully encloses a volume, it is
    considered a solid.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True is successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polysurface")
if rs.IsPolysurface(obj):
    print("The object is a polysurface.")
else:
    print("The object is not a polysurface.")
```

See also: IsBrep, IsPolysurfaceClosed

## IsPolysurfaceClosed

```python
rs.IsPolysurfaceClosed(object_id)
```

Verifies a polysurface object is closed. If the polysurface fully encloses
    a volume, it is considered a solid.

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True is successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a polysurface", rs.filter.polysurface)
if rs.IsPolysurfaceClosed(obj):
    print("The polysurface is closed.")
else:
    print("The polysurface is not closed.")
```

See also: IsBrep, IsPolysurface

## IsSphere

```python
rs.IsSphere(object_id)
```

Determines if a surface is a portion of a sphere

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if surface:
    if rs.IsSphere(surface):
        print("The surface is a portion of a sphere.")
    else:
        print("The surface is not a portion of a sphere.")
```

See also: IsCone, IsCylinder, IsSurface, IsTorus

## IsSurface

```python
rs.IsSurface(object_id)
```

Verifies an object is a surface. Brep objects with only one face are
    also considered surfaces.

Arguments:

    object_id (guid): the object's identifier.

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
objectId = rs.GetObject("Select a surface")
if rs.IsSurface(objectId):
    print("The object is a surface.")
else:
    print("The object is not a surface.")
```

See also: IsPointOnSurface, IsSurfaceClosed, IsSurfacePlanar, IsSurfaceSingular, IsSurfaceTrimmed

## IsSurfaceClosed

```python
rs.IsSurfaceClosed( surface_id, direction )
```

Verifies a surface object is closed in the specified direction.  If the
    surface fully encloses a volume, it is considered a solid

Arguments:

    surface_id (guid): identifier of a surface
    direction (number): 0=U direction check, 1=V direction check

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfaceClosed(obj, 0):
    print("The surface is closed in the U direction.")
else:
    print("The surface is not closed in the U direction.")
```

See also: IsSurface, IsSurfacePlanar, IsSurfaceSingular, IsSurfaceTrimmed

## IsSurfacePeriodic

```python
rs.IsSurfacePeriodic(surface_id, direction)
```

Verifies a surface object is periodic in the specified direction.

Arguments:

    surface_id (guid): identifier of a surface
    direction (number): 0=U direction check, 1=V direction check

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfacePeriodic(obj, 0):
    print("The surface is periodic in the U direction.")
else:
    print("The surface is not periodic in the U direction.")
```

See also: IsSurface, IsSurfaceClosed, IsSurfacePlanar, IsSurfaceSingular, IsSurfaceTrimmed

## IsSurfacePlanar

```python
rs.IsSurfacePlanar(surface_id, tolerance=None)
```

Verifies a surface object is planar

Arguments:

    surface_id (guid): identifier of a surface
    tolerance (number): tolerance used when checked. If omitted, the current absolute
      tolerance is used

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfacePlanar(obj):
    print("The surface is planar.")
else:
    print("The surface is not planar.")
```

See also: IsSurface, IsSurfaceClosed, IsSurfaceSingular, IsSurfaceTrimmed

## IsSurfaceRational

```python
rs.IsSurfaceRational(surface_id)
```

Verifies a surface object is rational

Arguments:

    surface_id (guid): the surface's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfaceRational(obj):
    print("The surface is rational.")
else:
    print("The surface is not rational.")
```

See also: IsSurface, IsSurfaceClosed, IsSurfacePlanar, IsSurfaceTrimmed

## IsSurfaceSingular

```python
rs.IsSurfaceSingular(surface_id, direction)
```

Verifies a surface object is singular in the specified direction.
    Surfaces are considered singular if a side collapses to a point.

Arguments:

    surface_id (guid): the surface's identifier
    direction (number):
      0=south
      1=east
      2=north
      3=west

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfaceSingular(obj, 0):
    print("The surface is singular.")
else:
    print("The surface is not singular.")
```

See also: IsSurface, IsSurfaceClosed, IsSurfacePlanar, IsSurfaceTrimmed

## IsSurfaceTrimmed

```python
rs.IsSurfaceTrimmed(surface_id)
```

Verifies a surface object has been trimmed

Arguments:

    surface_id (guid): the surface's identifier

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurfaceTrimmed(obj):
    print("The surface is trimmed.")
else:
    print("The surface is not trimmed.")
```

See also: IsSurface, IsSurfaceClosed, IsSurfacePlanar, IsSurfaceSingular

## IsTorus

```python
rs.IsTorus(surface_id)
```

Determines if a surface is a portion of a torus

Arguments:

    surface_id (guid): the surface object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if surface:
    if rs.IsTorus(surface):
        print("The surface is a portion of a torus.")
    else:
        print("The surface is not a portion of a torus.")
```

See also: IsCone, IsCylinder, IsSphere, IsSurface

## JoinSurfaces

```python
rs.JoinSurfaces(object_ids, delete_input=False, return_all=False)
```

Joins two or more surface or polysurface objects together to form one
    polysurface object

Arguments:

    object_ids ([guid, ...]) list of object identifiers
    delete_input (bool, optional): Delete the original surfaces
    return_all (bool, optional): Return all surfaces in result

Returns: guid or guid list: identifier, or list of identifiers if return_all == True, of newly created object(s) on success
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select surfaces in order", rs.filter.surface)
if objs and len(objs)>1: rs.JoinSurfaces(objs)
```

See also: ExplodePolysurfaces, IsPolysurface, IsPolysurfaceClosed, IsSurface, IsSurfaceClosed

## MakeSurfacePeriodic

```python
rs.MakeSurfacePeriodic(surface_id, direction, delete_input=False)
```

Makes an existing surface a periodic NURBS surface

Arguments:

    surface_id (guid): the surface's identifier
    direction (number): The direction to make periodic, either 0=U or 1=V
    delete_input (bool, optional): delete the input surface

Returns: guid: if delete_input is False, identifier of the new surface
guid: if delete_input is True, identifier of the modifier surface
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
obj = rs.GetObject("Select  a surface", rs.filter.surface)
if not rs.IsSurfacePeriodic(obj,  0):
    rs.MakeSurfacePeriodic(obj,  0)
```

See also: IsSurfacePeriodic

## OffsetSurface

```python
rs.OffsetSurface(surface_id, distance, tolerance=None, both_sides=False, create_solid=False)
```

Offsets a trimmed or untrimmed surface by a distance. The offset surface
    will be added to Rhino.

Arguments:

    surface_id (guid): the surface's identifier
    distance (number): the distance to offset
    tolerance (number, optional): The offset tolerance. Use 0.0 to make a loose offset. Otherwise, the
      document's absolute tolerance is usually sufficient.
    both_sides (bool, optional): Offset to both sides of the input surface
    create_solid (bool, optional): Make a solid object

Returns: guid: identifier of the new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurface(surface):
    rs.OffsetSurface( surface, 10.0 )
```

See also: OffsetCurve

## PullCurve

```python
rs.PullCurve(surface, curve, delete_input=False)
```

Pulls a curve object to a surface object

Arguments:

    surface (guid): the surface's identifier
    curve (guid): the curve's identifier
    delete_input (bool, optional) should the input items be deleted

Returns: list(guid, ...): of new curves if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to pull", rs.filter.curve )
surface = rs.GetObject("Select surface that pulls", rs.filter.surface )
rs.PullCurve(surface, curve)
```

See also: IsSurface

## RebuildSurface

```python
rs.RebuildSurface(object_id, degree=(3,3), pointcount=(10,10))
```

Rebuilds a surface to a given degree and control point count. For more
    information see the Rhino help file for the Rebuild command

Arguments:

    object_id (guid): the surface's identifier
    degree ([number, number], optional): two numbers that identify surface degree in both U and V directions
    pointcount ([number, number], optional): two numbers that identify the surface point count in both the U and V directions

Returns: bool: True of False indicating success or failure

## RemoveSurfaceKnot

```python
rs.RemoveSurfaceKnot(surface, uv_parameter, v_direction)
```

Deletes a knot from a surface object.

Arguments:

    surface (guid): The reference of the surface object
    uv_parameter (list(number, number)): An indexable item containing a U,V parameter on the surface. List, tuples and UVIntervals will work.
      Note, if the parameter is not equal to one of the existing knots, then the knot closest to the specified parameter will be removed.
    v_direction (bool): if True, or 1, the V direction will be addressed. If False, or 0, the U direction.

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs

srf_info = rs.GetSurfaceObject()
if srf_info:
    srf_id = srf_info[0]
    srf_param = srf_info[4]
    rs.RemoveSurfaceKnot(srf_id, srf_param, 1)
```

See also: RemoveSurfaceKnot

## ReverseSurface

```python
rs.ReverseSurface(surface_id, direction)
```

Reverses U or V directions of a surface, or swaps (transposes) U and V
    directions.

Arguments:

    surface_id (guid): identifier of a surface object
    direction (number): as a bit coded flag to swap
          1 = reverse U
          2 = reverse V
          4 = transpose U and V (values can be combined)

Returns: bool: indicating success or failure
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface to reverse")
if rs.IsSurface(obj):
    rs.ReverseSurface( obj, 1 )
```

See also: FlipSurface, IsSurface

## ShootRay

```python
rs.ShootRay(surface_ids, start_point, direction, reflections=10)
```

Shoots a ray at a collection of surfaces

Arguments:

    surface_ids ([guid, ...]): one of more surface identifiers
    start_point (point): starting point of the ray
    direction (vector):  vector identifying the direction of the ray
    reflections (number, optional): the maximum number of times the ray will be reflected

Returns: list(point, ...): of reflection points on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
def TestRayShooter():
    corners = []
    corners.append((0,0,0))
    corners.append((10,0,0))
    corners.append((10,10,0))
    corners.append((0,10,0))
    corners.append((0,0,10))
    corners.append((10,0,10))
    corners.append((10,10,10))
    corners.append((0,10,10))
    box = rs.AddBox(corners)
    dir = 10,7.5,7
    reflections = rs.ShootRay(box, (0,0,0), dir)
    rs.AddPolyline( reflections )
    rs.AddPoints( reflections )
TestRayShooter()
```

See also: IsPolysurface, IsSurface

## ShortPath

```python
rs.ShortPath(surface_id, start_point, end_point)
```

Creates the shortest possible curve(geodesic) between two points on a
    surface. For more details, see the ShortPath command in Rhino help

Arguments:

    surface_id (guid): identifier of a surface
    start_point, end_point (point): start/end points of the short curve

Returns: guid: identifier of the new surface on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface for short path", rs.filter.surface + rs.filter.surface)
if surface:
    start = rs.GetPointOnSurface(surface, "First point")
    end = rs.GetPointOnSurface(surface, "Second point")
    rs.ShortPath(surface, start, end)
```

See also: EvaluateSurface, SurfaceClosestPoint

## ShrinkTrimmedSurface

```python
rs.ShrinkTrimmedSurface(object_id, create_copy=False)
```

Shrinks the underlying untrimmed surfaces near to the trimming
    boundaries. See the ShrinkTrimmedSrf command in the Rhino help.

Arguments:

    object_id (guid): the surface's identifier
    create_copy (bool, optional): If True, the original surface is not deleted

Returns: bool: If create_copy is False, True or False indicating success or failure
bool: If create_copy is True, the identifier of the new surface
None: on error

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.surface | rs.filter.polysurface
surface = rs.GetObject("Select surface or polysurface to shrink", filter )
if surface: rs.ShrinkTrimmedSurface( surface )
```

See also: IsSurfaceTrimmed

## SplitBrep

```python
rs.SplitBrep(brep_id, cutter_id, delete_input=False)
```

Splits a brep

Arguments:

    brep (guid): identifier of the brep to split
    cutter (guid): identifier of the brep to split with

Returns: list(guid, ...): identifiers of split pieces on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.surface + rs.filter.polysurface
brep = rs.GetObject("Select brep to split", filter)
cutter = rs.GetObject("Select cutting brep", filter)
rs.SplitBrep ( brep, cutter )
```

See also: IsBrep

## SurfaceArea

```python
rs.SurfaceArea(object_id)
```

Calculate the area of a surface or polysurface object. The results are
    based on the current drawing units

Arguments:

    object_id (guid): the surface's identifier

Returns: list(number, number): of area information on success (area, absolute error bound)
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if obj:
    massprop = rs.SurfaceArea( obj )
    if massprop:
        print("The surface area is: {}".format(massprop[0]))
```

See also: SurfaceAreaCentroid, SurfaceAreaMoments

## SurfaceAreaCentroid

```python
rs.SurfaceAreaCentroid(object_id)
```

Calculates the area centroid of a surface or polysurface

Arguments:

    object_id (guid): the surface's identifier

Returns: list(point, tuple(number, number, number)): Area centroid information (Area Centroid, Error bound in X, Y, Z)
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if obj:
    massprop = rs.SurfaceAreaCentroid(obj)
    if massprop: rs.AddPoint( massprop[0] )
```

See also: SurfaceArea, SurfaceAreaMoments

## SurfaceAreaMoments

```python
rs.SurfaceAreaMoments(surface_id)
```

Calculates area moments of inertia of a surface or polysurface object.
    See the Rhino help for "Mass Properties calculation details"

Arguments:

    surface_id (guid): the surface's identifier

Returns: list(tuple(number, number,number), ...): of moments and error bounds in tuple(X, Y, Z) - see help topic
  Index   Description
  [0]     First Moments.
  [1]     The absolute (+/-) error bound for the First Moments.
  [2]     Second Moments.
  [3]     The absolute (+/-) error bound for the Second Moments.
  [4]     Product Moments.
  [5]     The absolute (+/-) error bound for the Product Moments.
  [6]     Area Moments of Inertia about the World Coordinate Axes.
  [7]     The absolute (+/-) error bound for the Area Moments of Inertia about World Coordinate Axes.
  [8]     Area Radii of Gyration about the World Coordinate Axes.
  [9]     The absolute (+/-) error bound for the Area Radii of Gyration about World Coordinate Axes.
  [10]    Area Moments of Inertia about the Centroid Coordinate Axes.
  [11]    The absolute (+/-) error bound for the Area Moments of Inertia about the Centroid Coordinate Axes.
  [12]    Area Radii of Gyration about the Centroid Coordinate Axes.
  [13]    The absolute (+/-) error bound for the Area Radii of Gyration about the Centroid Coordinate Axes.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if obj:
    massprop= rs.SurfaceAreaMoments(obj)
    if massprop:
        print("Area Moments of Inertia about the World Coordinate Axes: {}".format(massprop[6]))
```

See also: SurfaceArea, SurfaceAreaCentroid

## SurfaceClosestPoint

```python
rs.SurfaceClosestPoint(surface_id, test_point)
```

Returns U,V parameters of point on a surface that is closest to a test point

Arguments:

    surface_id (guid): identifier of a surface object
    test_point (point): sampling point

Returns: list(number, number): The U,V parameters of the closest point on the surface if successful.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurface(obj):
    point = rs.GetPointOnSurface(obj, "Pick a test point")
    if point:
        param = rs.SurfaceClosestPoint(obj, point)
        if param:
            print("Surface U parameter: {}".format(str(param[0])))
            print("Surface V parameter: {}".format(str(param[1])))
```

See also: BrepClosestPoint, EvaluateSurface, IsSurface

## SurfaceCone

```python
rs.SurfaceCone(surface_id)
```

Returns the definition of a surface cone

Arguments:

    surface_id (guid): the surface's identifier

Returns: tuple(plane, number, number): containing the definition of the cone if successful
  [0]   the plane of the cone. The apex of the cone is at the
        plane's origin and the axis of the cone is the plane's z-axis
  [1]   the height of the cone
  [2]   the radius of the cone
None: on error

Example:

```python
import rhinoscriptsyntax as rs
cone = rs.AddCone(rs.WorldXYPlane(), 6, 2, False)
if rs.IsCone(cone):
    cone_def = rs.SurfaceCone(cone)
    rs.AddCone( cone_def[0], cone_def[1], cone_def[2], False )
```

## SurfaceCurvature

```python
rs.SurfaceCurvature(surface_id, parameter)
```

Returns the curvature of a surface at a U,V parameter. See Rhino help
    for details of surface curvature

Arguments:

    surface_id (guid): the surface's identifier
    parameter (number, number): u,v parameter

Returns: tuple(point, vector, number, number, number, number, number): of curvature information
  [0]   point at specified U,V parameter
  [1]   normal direction
  [2]   maximum principal curvature
  [3]   maximum principal curvature direction
  [4]   minimum principal curvature
  [5]   minimum principal curvature direction
  [6]   gaussian curvature
  [7]   mean curvature
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
srf = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurface(srf):
    point = rs.GetPointOnSurface(srf, "Pick a test point")
    if point:
        param = rs.SurfaceClosestPoint(srf, point)
        if param:
            data = rs.SurfaceCurvature(srf, param)
            if data:
                print("Surface curvature evaluation at parameter {}:".format(param))
                print(" 3-D Point:{}".format(data[0]))
                print(" 3-D Normal:{}".format(data[1]))
                print(" Maximum principal curvature: {} {}".format(data[2], data[3]))
                print(" Minimum principal curvature: {} {}".format(data[4], data[5]))
                print(" Gaussian curvature:{}".format(data[6]))
                print(" Mean curvature:{}".format(data[7]))
```

See also: CurveCurvature

## SurfaceCylinder

```python
rs.SurfaceCylinder(surface_id)
```

Returns the definition of a cylinder surface

Arguments:

    surface_id (guid): the surface's identifier

Returns: tuple(plane, number, number): of the cylinder plane, height, radius on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
cylinder = rs.AddCylinder(rs.WorldXYPlane(), 6, 2, False)
if rs.IsCylinder(cylinder):
    plane, height, radius = rs.SurfaceCylinder(cylinder)
    rs.AddCylinder(plane, height, radius, False)
```

See also: SurfaceSphere

## SurfaceDegree

```python
rs.SurfaceDegree(surface_id, direction=2)
```

Returns the degree of a surface object in the specified direction

Arguments:

    surface_id (guid): the surface's identifier
    direction (number, optional): The degree U, V direction
              0 = U
              1 = V
              2 = both

Returns: number: Single number if `direction` = 0 or 1
tuple(number, number): of two values if `direction` = 2
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurface(obj):
    print("Degree in U direction: {}".format(rs.SurfaceDegree(obj, 0)))
    print("Degree in V direction: {}".format(rs.SurfaceDegree(obj, 1)))
```

See also: IsSurface, SurfaceDomain

## SurfaceDomain

```python
rs.SurfaceDomain(surface_id, direction)
```

Returns the domain of a surface object in the specified direction.

Arguments:

    surface_id (guid): the surface's identifier
    direction (number): domain direction 0 = U, or 1 = V

Returns: list(number, number): containing the domain interval in the specified direction
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject("Select a surface", rs.filter.surface)
if rs.IsSurface(object):
    domainU = rs.SurfaceDomain(object, 0)
    domainV = rs.SurfaceDomain(object, 1)
    print("Domain in U direction: {}".format(domainU))
    print("Domain in V direction: {}".format(domainV))
```

See also: IsSurface, SurfaceDegree

## SurfaceEditPoints

```python
rs.SurfaceEditPoints(surface_id, return_parameters=False, return_all=True)
```

Returns the edit, or Greville points of a surface object. For each
    surface control point, there is a corresponding edit point

Arguments:

    surface_id (guid): the surface's identifier
    return_parameters (bool, optional): If False, edit points are returned as a list of
      3D points. If True, edit points are returned as a list of U,V surface
      parameters
    return_all (bool, options): If True, all surface edit points are returned. If False,
      the function will return surface edit points based on whether or not the
      surface is closed or periodic

Returns: list(point, ...): if return_parameters is False, a list of 3D points
list((number, number), ...): if return_parameters is True, a list of U,V parameters
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface")
if rs.IsSurface(obj):
    points = rs.SurfaceEditPoints(obj)
    if points: rs.AddPointCloud(points)
```

See also: IsSurface, SurfacePointCount, SurfacePoints

## SurfaceEvaluate

```python
rs.SurfaceEvaluate(surface_id, parameter, derivative)
```

A general purpose surface evaluator

Arguments:

    surface_id (guid): the surface's identifier
    parameter ([number, number]): u,v parameter to evaluate
    derivative (number): number of derivatives to evaluate

Returns: list((point, vector, ...), ...): list length (derivative+1)*(derivative+2)/2 if successful.  The elements are as follows:
  Element  Description
  [0]      The 3-D point.
  [1]      The first derivative.
  [2]      The first derivative.
  [3]      The second derivative.
  [4]      The second derivative.
  [5]      The second derivative.
  [6]      etc...
None: If not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
def TestSurfaceEvaluate():
    srf = rs.GetObject("Select surface to evaluate", rs.filter.surface, True)
    if srf is None: return
    point = rs.GetPointOnSurface(srf, "Point to evaluate")
    if point is None: return
    der = rs.GetInteger("Number of derivatives to evaluate", 1, 1)
    if der is None: return
    uv = rs.SurfaceClosestPoint(srf, point)
    res = rs.SurfaceEvaluate(srf, uv, der)
    if res is None:
        print("Failed to evaluate surface.")
        return
    for i,r in enumerate(res):
        print("{} = {}".format(i, r))
TestSurfaceEvaluate()
```

See also: EvaluateSurface

## SurfaceFrame

```python
rs.SurfaceFrame(surface_id, uv_parameter)
```

Returns a plane based on the normal, u, and v directions at a surface
    U,V parameter

Arguments:

    surface_id (guid): the surface's identifier
    uv_parameter ([number, number]): u,v parameter to evaluate

Returns: plane: plane on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetSurfaceObject("Select a surface")
if surface:
    plane = rs.SurfaceFrame(surface[0], surface[4])
    rs.ViewCPlane(None, plane)
```

See also: EvaluateSurface, SurfaceClosestPoint, SurfaceNormal

## SurfaceIsocurveDensity

```python
rs.SurfaceIsocurveDensity(surface_id, density=None)
```

Returns or sets the isocurve density of a surface or polysurface object.
    An isoparametric curve is a curve of constant U or V value on a surface.
    Rhino uses isocurves and surface edge curves to visualize the shape of a
    NURBS surface

Arguments:

    surface_id (guid): the surface's identifier
    density (number, optional): the isocurve wireframe density. The possible values are
        -1: Hides the surface isocurves
         0: Display boundary and knot wires
         1: Display boundary and knot wires and one interior wire if there
            are no interior knots
       >=2: Display boundary and knot wires and (N+1) interior wires

Returns: number: If density is not specified, then the current isocurve density if successful
number: If density is specified, the the previous isocurve density if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface | rs.filter.polysurface)
if obj: rs.SurfaceIsocurveDensity( obj, 8 )
```

See also: IsPolysurface, IsSurface

## SurfaceKnotCount

```python
rs.SurfaceKnotCount(surface_id)
```

Returns the control point count of a surface
      surface_id = the surface's identifier

Arguments:

    surface_id (guid): the surface object's identifier

Returns: list(number, number): a list containing (U count, V count) on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface")
if rs.IsSurface(obj):
    count = rs.SurfaceKnotCount(obj)
    print("Knot count in U direction: {}".format(count[0]))
    print("Knot count in V direction: {}".format(count[1]))
```

See also: IsSurface, SurfaceKnots

## SurfaceKnots

```python
rs.SurfaceKnots(surface_id)
```

Returns the knots, or knot vector, of a surface object.

Arguments:

    surface_id (guid): the surface's identifier

Returns: list(number, number): knot values of the surface if successful. The list will
 contain the following information:
 Element   Description
   [0]     Knot vector in U direction
   [1]     Knot vector in V direction
 None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface")
if rs.IsSurface(obj):
    knots = rs.SurfaceKnots(obj)
    if knots:
        vector = knots[0]
        print("Knot vector in U direction")
        for item in vector: print("Surface knot value: {}".format(item))
        vector = knots[1]
        print("Knot vector in V direction")
        for item in vector: print("Surface knot value: {}".format(item))
```

See also: IsSurface, SurfaceKnotCount

## SurfaceNormal

```python
rs.SurfaceNormal(surface_id, uv_parameter)
```

Returns 3D vector that is the normal to a surface at a parameter

Arguments:

    surface_id (guid): the surface's identifier
    uv_parameter  ([number, number]): the uv parameter to evaluate

Returns: vector: Normal vector on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.surface)
if obj:
    point = rs.GetPointOnSurface(obj)
    if point:
        param = rs.SurfaceClosestPoint(obj, point)
        normal = rs.SurfaceNormal(obj, param)
        rs.AddPoints( [point, point + normal] )
```

See also: SurfaceClosestPoint, SurfaceDomain

## SurfaceNormalizedParameter

```python
rs.SurfaceNormalizedParameter(surface_id, parameter)
```

Converts surface parameter to a normalized surface parameter; one that
    ranges between 0.0 and 1.0 in both the U and V directions

Arguments:

    surface_id (guid) the surface's identifier
    parameter ([number, number]): the surface parameter to convert

Returns: list(number, number): normalized surface parameter if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select surface")
if rs.IsSurface(obj):
    domain_u = rs.SurfaceDomain(obj, 0)
    domain_v = rs.SurfaceDomain(obj, 1)
    parameter = (domain_u[1] + domain_u[0]) / 2.0, (domain_v[1] + domain_v[0]) / 2.0
    print("Surface parameter: {}".format(parameter))
    normalized = rs.SurfaceNormalizedParameter(obj, parameter)
    print("Normalized parameter: {}".format(normalized))
```

See also: SurfaceDomain, SurfaceParameter

## SurfaceParameter

```python
rs.SurfaceParameter(surface_id, parameter)
```

Converts normalized surface parameter to a surface parameter; or
    within the surface's domain

Arguments:

    surface_id (guid): the surface's identifier
    parameter ([number, number]): the normalized parameter to convert

Returns: tuple(number, number): surface parameter on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select surface")
if obj:
    normalized = (0.5, 0.5)
    print("Normalized parameter: {}".format(normalized))
    parameter = rs.SurfaceParameter(obj, normalized)
    print("Surface parameter: {}".format(parameter))
```

See also: SurfaceDomain, SurfaceNormalizedParameter

## SurfacePointCount

```python
rs.SurfacePointCount(surface_id)
```

Returns the control point count of a surface
      surface_id = the surface's identifier

Arguments:

    surface_id (guid): the surface object's identifier

Returns: list(number, number): THe number of control points in UV direction. (U count, V count)

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface")
if rs.IsSurface(obj):
    count = rs.SurfacePointCount(obj)
    print("Point count in U direction: {}".format(count[0]))
    print("Point count in V direction: {}".format(count[1]))
```

See also: IsSurface, SurfacePoints

## SurfacePoints

```python
rs.SurfacePoints(surface_id, return_all=True)
```

Returns the control points, or control vertices, of a surface object

Arguments:

    surface_id (guid): the surface's identifier
    return_all (bool, optional): If True all surface edit points are returned. If False,
      the function will return surface edit points based on whether or not
      the surface is closed or periodic

Returns: list(point, ...): the control points if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
def PrintControlPoints():
    surface = rs.GetObject("Select surface", rs.filter.surface)
    points = rs.SurfacePoints(surface)
    if points is None: return
    count = rs.SurfacePointCount(surface)
    i = 0
    for u in range(count[0]):
        for v in range(count[1]):
            print("CV[{}".format(u, ",", v, "] = ", points[i]))
            i += 1
PrintControlPoints()
```

See also: IsSurface, SurfacePointCount

## SurfaceSphere

```python
rs.SurfaceSphere(surface_id)
```

Gets the sphere definition from a surface, if possible.

Arguments:

    surface_id (guid): the identifier of the surface object

Returns: (plane, number): The equatorial plane of the sphere, and its radius.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select a surface", rs.filter.surface)
if surface:
    result = rs.SurfaceSphere(surface)
    if result:
        print("The sphere radius is: " + str(result[1]))
```

See also: SurfaceCylinder

## SurfaceTorus

```python
rs.SurfaceTorus(surface_id)
```

Returns the definition of a surface torus

Arguments:

    surface_id (guid): the surface's identifier

Returns: tuple(plane, number, number): containing the definition of the torus if successful
  [0]   the base plane of the torus
  [1]   the major radius of the torus
  [2]   the minor radius of the torus
None: on error

Example:

```python
import rhinoscriptsyntax as rs
torus = rs.AddTorus(rs.WorldXYPlane(), 6, 2)
if rs.IsTorus(torus):
    torus_def = rs.SurfaceTorus(torus)
    rs.AddTorus( torus_def[0], torus_def[1], torus_def[2] )
```

## SurfaceVolume

```python
rs.SurfaceVolume(object_id)
```

Calculates volume of a closed surface or polysurface

Arguments:

    object_id (guid): the surface's identifier

Returns: list(number, tuple(X, Y, Z): volume data returned (Volume, Error bound) on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.polysurface)
if rs.IsPolysurfaceClosed(obj):
    massprop = rs.SurfaceVolume(obj)
    if massprop:
        print("The polysurface volume is: {}".format(massprop[0]))
```

See also: SurfaceVolume, SurfaceVolumeCentroid, SurfaceVolumeMoments

## SurfaceVolumeCentroid

```python
rs.SurfaceVolumeCentroid(object_id)
```

Calculates volume centroid of a closed surface or polysurface

Arguments:

    object_id (guid): the surface's identifier

Returns: list(point, tuple(X, Y, Z): volume data returned (Volume Centriod, Error bound) on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.polysurface)
if rs.IsPolysurfaceClosed(obj):
    massprop= rs.SurfaceVolumeCentroid(obj)
    if massprop: rs.AddPoint( massprop[0] )
```

See also: SurfaceVolume, SurfaceVolumeMoments

## SurfaceVolumeMoments

```python
rs.SurfaceVolumeMoments(surface_id)
```

Calculates volume moments of inertia of a surface or polysurface object.
    For more information, see Rhino help for "Mass Properties calculation details"

Arguments:

    surface_id (guid): the surface's identifier

Returns: list(tuple(number, number,number), ...): of moments and error bounds in tuple(X, Y, Z) - see help topic
  Index   Description
  [0]     First Moments.
  [1]     The absolute (+/-) error bound for the First Moments.
  [2]     Second Moments.
  [3]     The absolute (+/-) error bound for the Second Moments.
  [4]     Product Moments.
  [5]     The absolute (+/-) error bound for the Product Moments.
  [6]     Area Moments of Inertia about the World Coordinate Axes.
  [7]     The absolute (+/-) error bound for the Area Moments of Inertia about World Coordinate Axes.
  [8]     Area Radii of Gyration about the World Coordinate Axes.
  [9]     The absolute (+/-) error bound for the Area Radii of Gyration about World Coordinate Axes.
  [10]    Area Moments of Inertia about the Centroid Coordinate Axes.
  [11]    The absolute (+/-) error bound for the Area Moments of Inertia about the Centroid Coordinate Axes.
  [12]    Area Radii of Gyration about the Centroid Coordinate Axes.
  [13]    The absolute (+/-) error bound for the Area Radii of Gyration about the Centroid Coordinate Axes.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a surface", rs.filter.polysurface)
if rs.IsPolysurfaceClosed(obj):
    massprop = rs.SurfaceVolumeMoments(obj)
    if massprop:
        print("Volume Moments of Inertia about the World Coordinate Axes: {}".format(massprop[6]))
```

See also: SurfaceVolume, SurfaceVolumeCentroid

## SurfaceWeights

```python
rs.SurfaceWeights(object_id)
```

Returns list of weight values assigned to the control points of a surface.
    The number of weights returned will be equal to the number of control points
    in the U and V directions.

Arguments:

    object_id (guid): the surface's identifier

Returns: list(number, ...): point weights.
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surf = rs.GetObject("Select a surface")
if rs.IsSurface(surf):
    weights = rs.SurfaceWeights(surf)
    if weights:
        for w in weights:
            print("Surface control point weight value:{}".format(w))
```

See also: IsSurface, SurfacePointCount, SurfacePoints

## TrimBrep

```python
rs.TrimBrep(object_id, cutter, tolerance=None)
```

Trims a surface using an oriented cutter

Arguments:

    object_id (guid): surface or polysurface identifier
    cutter (guid|plane): surface, polysurface, or plane performing the trim
    tolerance (number, optional): trimming tolerance. If omitted, the document's absolute
      tolerance is used

Returns: list(guid, ...): identifiers of retained components on success

Example:

```python
import rhinoscriptsyntax as rs
filter = rs.filter.surface + rs.filter.polysurface
obj = rs.GetObject("Select surface or polysurface to trim", filter)
if obj:
    cutter = rs.GetObject("Select cutting surface or polysurface", filter)
    if cutter:
        rs.TrimBrep(obj,cutter)
```

See also: TrimSurface

## TrimSurface

```python
rs.TrimSurface( surface_id, direction, interval, delete_input=False)
```

Remove portions of the surface outside of the specified interval

Arguments:

    surface_id (guid): surface identifier
    direction (number, optional): 0(U), 1(V), or 2(U and V)
    interval (interval): sub section of the surface to keep.
      If both U and V then a list or tuple of 2 intervals
    delete_input (bool, optional): should the input surface be deleted

Returns: guid: new surface identifier on success

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface to split", rs.filter.surface)
if surface:
    domain_u = rs.SurfaceDomain(surface, 0)
    domain_u[0] = (domain_u[1] - domain_u[0]) * 0.25
    rs.TrimSurface( surface, 0, domain_u, True )
```

## UnrollSurface

```python
rs.UnrollSurface(surface_id, explode=False, following_geometry=None, absolute_tolerance=None, relative_tolerance=None)
```

Flattens a developable surface or polysurface

Arguments:

    surface_id (guid): the surface's identifier
    explode (bool, optional): If True, the resulting surfaces ar not joined
    following_geometry ({guid, ...]): List of curves, dots, and points which
      should be unrolled with the surface

Returns: list(guid, ...): of unrolled surface ids
tuple((guid, ...),(guid, ...)): if following_geometry is not None, a tuple
  [1] is the list of unrolled surface ids
  [2] is the list of unrolled following geometry

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Select surface or polysurface to unroll", rs.filter.surface + rs.filter.polysurface)
if surface: rs.UnrollSurface(surface)
```
