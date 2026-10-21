# rhinoscriptsyntax: mesh

## AddMesh

```python
rs.AddMesh(vertices, face_vertices, vertex_normals=None, texture_coordinates=None, vertex_colors=None)
```

Add a mesh object to the document

Arguments:

    vertices ([point, ...]) list of 3D points defining the vertices of the mesh
    face_vertices ([[number, number, number], [number, number, number, number], ...]) list containing lists of 3 or 4 numbers that define the
                  vertex indices for each face of the mesh. If the third a fourth vertex
                   indices of a face are identical, a triangular face will be created.
    vertex_normals ([vector, ...], optional) list of 3D vectors defining the vertex normals of
      the mesh. Note, for every vertex, there must be a corresponding vertex
      normal
    texture_coordinates ([[number, number], [number, number], [number, number]], ...], optional): list of 2D texture coordinates. For every
      vertex, there must be a corresponding texture coordinate
    vertex_colors ([color, ...]) a list of color values. For every vertex,
      there must be a corresponding vertex color

Returns: guid: Identifier of the new object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
vertices = []
vertices.append((0.0,0.0,0.0))
vertices.append((5.0, 0.0, 0.0))
vertices.append((10.0, 0.0, 0.0))
vertices.append((0.0, 5.0, 0.0))
vertices.append((5.0, 5.0, 0.0))
vertices.append((10.0, 5.0, 0.0))
vertices.append((0.0, 10.0, 0.0))
vertices.append((5.0, 10.0, 0.0))
vertices.append((10.0, 10.0, 0.0))
faceVertices = []
faceVertices.append((0,1,4,4))
faceVertices.append((2,4,1,1))
faceVertices.append((0,4,3,3))
faceVertices.append((2,5,4,4))
faceVertices.append((3,4,6,6))
faceVertices.append((5,8,4,4))
faceVertices.append((6,4,7,7))
faceVertices.append((8,7,4,4))
rs.AddMesh( vertices, faceVertices )
```

See also: MeshFaces, MeshFaceVertices, MeshVertexNormals, MeshVertices

## AddPlanarMesh

```python
rs.AddPlanarMesh(object_id, delete_input=False)
```

Creates a planar mesh from a closed, planar curve

Arguments:

    object_id (guid): identifier of a closed, planar curve
    delete_input (bool, optional) if True, delete the input curve defined by object_id

Returns: guid: id of the new mesh on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select planar curves to build mesh", rs.filter.curve)
if obj: rs.AddPlanarMesh(obj)
```

See also: IsCurveClosed, IsCurvePlanar

## CurveMeshIntersection

```python
rs.CurveMeshIntersection(curve_id, mesh_id, return_faces=False)
```

Calculates the intersection of a curve object and a mesh object

Arguments:

    curve_id (guid): identifier of a curve object
    mesh_id (guid): identifier or a mesh object
    return_faces (bool, optional): return both intersection points and face indices.
      If False, then just the intersection points are returned

Returns: list(point, ...): if return_false is omitted or False, then a list of intersection points
list([point, number], ...): if return_false is True, the a one-dimensional list containing information
  about each intersection. Each element contains the following two elements
    [0] = point of intersection
    [1] = mesh face index where intersection lies
None: on error

Example:

```python
import rhinoscriptsyntax as rs
curve = rs.GetObject("Select curve to intersect", rs.filter.curve)
if curve:
    mesh = rs.GetObject("Select mesh to intersect", rs.filter.mesh)
    if mesh:
        cmx = rs.CurveMeshIntersection(curve, mesh, True)
        if cmx:
            for element in cmx:
                print("{}, Face index = {}".format(element[0], element[1]))
                rs.AddPoint(element[0])
```

See also: MeshClosestPoint, MeshMeshIntersection

## DisjointMeshCount

```python
rs.DisjointMeshCount(object_id)
```

Returns number of meshes that could be created by calling SplitDisjointMesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: The number of meshes that could be created

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if rs.DisjointMeshCount(obj)>1: rs.SplitDisjointMesh(obj)
```

See also: IsMesh, SplitDisjointMesh

## DuplicateMeshBorder

```python
rs.DuplicateMeshBorder(mesh_id)
```

Creates curves that duplicates a mesh border

Arguments:

    mesh_id (guid): identifier of a mesh object

Returns: list(guid, ...): list of curve ids on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if obj: rs.DuplicateMeshBorder(obj)
```

See also: DuplicateEdgeCurves, DuplicateSurfaceBorder

## ExplodeMeshes

```python
rs.ExplodeMeshes(mesh_ids, delete=False)
```

Explodes a mesh object, or mesh objects int submeshes. A submesh is a
    collection of mesh faces that are contained within a closed loop of
    unwelded mesh edges. Unwelded mesh edges are where the mesh faces that
    share the edge have unique mesh vertices (not mesh topology vertices)
    at both ends of the edge

Arguments:

    mesh_ids ([guid, ...]): list of mesh identifiers
    delete (bool, optional): delete the input meshes

Returns: list(guid, ...): List of resulting objects after explode.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh to explode", rs.filter.mesh)
if rs.IsMesh(obj): rs.ExplodeMeshes(obj)
```

See also: IsMesh

## IsMesh

```python
rs.IsMesh(object_id)
```

Verifies if an object is a mesh

Arguments:

    object_id (guid): the object's identifier

Returns: bool: True if successful, otherwise False

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh")
if rs.IsMesh(obj):
    print("The object is a mesh.")
else:
    print("The object is not a mesh.")
```

See also: IsMeshClosed, MeshFaceCount, MeshFaces, MeshVertexCount, MeshVertices

## IsMeshClosed

```python
rs.IsMeshClosed(object_id)
```

Verifies a mesh object is closed

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.IsMeshClosed(obj):
    print("The mesh is closed.")
else:
    print("The mesh is not closed.")
```

See also: IsMesh

## IsMeshManifold

```python
rs.IsMeshManifold(object_id)
```

Verifies a mesh object is manifold. A mesh for which every edge is shared
    by at most two faces is called manifold. If a mesh has at least one edge
    that is shared by more than two faces, then that mesh is called non-manifold

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.IsMeshClosed(obj):
    print("The mesh is manifold.")
else:
    print("The mesh is non-manifold.")
```

See also: IsMesh, IsMeshClosed

## IsPointOnMesh

```python
rs.IsPointOnMesh(object_id, point)
```

Verifies a point is on a mesh

Arguments:

    object_id (guid): identifier of a mesh object
    point (point): test point

Returns: bool: True if successful, otherwise False.
None: on error.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh")
if rs.IsMesh(obj):
    point = rs.GetPointOnMesh(strObject, "Pick a test point")
    if point:
        if rs.IsPointOnMesh(obj, point):
            print("The point is on the mesh")
        else:
            print("The point is not on the mesh")
```

See also: IsMesh, MeshClosestPoint

## JoinMeshes

```python
rs.JoinMeshes(object_ids, delete_input=False)
```

Joins two or or more mesh objects together

Arguments:

    object_ids ([guid, ...]): identifiers of two or more mesh objects
    delete_input (bool, optional): delete input after joining

Returns: guid: identifier of newly created mesh on success

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select meshes to join", rs.filter.mesh)
if objs and len(objs)>1: rs.JoinMeshes(objs, True)
```

See also: JoinCurves, JoinSurfaces

## MeshArea

```python
rs.MeshArea(object_ids)
```

Returns approximate area of one or more mesh objects

Arguments:

    object_ids ([guid, ...]): identifiers of one or more mesh objects

Returns: list(number, number, number): if successful where
  [0] = number of meshes used in calculation
  [1] = total area of all meshes
  [2] = the error estimate
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
if obj:
    area_rc = rs.MeshArea(obj)
    if area_rc: print("Mesh area:{}".format(area_rc[1]))
```

See also: MeshVolume

## MeshAreaCentroid

```python
rs.MeshAreaCentroid(object_id)
```

Calculates the area centroid of a mesh object

Arguments:

    object_id (guid): identifier of a mesh object

Returns: point: representing the area centroid if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
rs.AddPoint( rs.MeshAreaCentroid(obj) )
```

See also: IsMesh, MeshArea, MeshVolume, MeshVolumeCentroid

## MeshBooleanDifference

```python
rs.MeshBooleanDifference(input0, input1, delete_input=True, tolerance=None)
```

Performs boolean difference operation on two sets of input meshes

Arguments:

    input0, input1 (guid): identifiers of meshes
    delete_input (bool, optional): delete the input meshes
    tolerance (float, optional): this value is ignored. 
        The parameter is only there to keep the function signature the same, 
        The build in tolerenace always is used.

Returns: list(guid, ...): identifiers of newly created meshes

Example:

```python
import rhinoscriptsyntax as rs
input0 = rs.GetObjects("Select first set of meshes", rs.filter.mesh)
if input0:
    input1 = rs.GetObjects("Select second set of meshes", rs.filter.mesh)
    if input1: rs.MeshBooleanDifference(input0, input1)
```

See also: MeshBooleanIntersection, MeshBooleanSplit, MeshBooleanUnion

## MeshBooleanIntersection

```python
rs.MeshBooleanIntersection(input0, input1, delete_input=True)
```

Performs boolean intersection operation on two sets of input meshes

Arguments:

    input0, input1 (guid): identifiers of meshes
    delete_input (bool, optional): delete the input meshes

Returns: list(guid, ...): identifiers of new meshes on success

Example:

```python
import rhinoscriptsyntax as rs
input0 = rs.GetObjects("Select first set of meshes", rs.filter.mesh)
if input0:
    input1 = rs.GetObjects("Select second set of meshes", rs.filter.mesh)
    if input1: rs.MeshBooleanIntersection(input0, input1)
```

See also: MeshBooleanDifference, MeshBooleanSplit, MeshBooleanUnion

## MeshBooleanSplit

```python
rs.MeshBooleanSplit(input0, input1, delete_input=True)
```

Performs boolean split operation on two sets of input meshes

Arguments:

    input0, input1 (guid): identifiers of meshes
    delete_input (bool, optional): delete the input meshes

Returns: list(guid, ...): identifiers of new meshes on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
input0 = rs.GetObjects("Select first set of meshes", rs.filter.mesh)
if input0:
    input1 = rs.GetObjects("Select second set of meshes", rs.filter.mesh)
    if input1: rs.MeshBooleanSplit(input0, input1)
```

See also: MeshBooleanDifference, MeshBooleanIntersection, MeshBooleanUnion

## MeshBooleanUnion

```python
rs.MeshBooleanUnion(mesh_ids, delete_input=True)
```

Performs boolean union operation on a set of input meshes

Arguments:

    mesh_ids ([guid, ...]): identifiers of meshes
    delete_input (bool, optional): delete the input meshes

Returns: list(guid, ...): identifiers of new meshes

Example:

```python
import rhinoscriptsyntax as rs
input = rs.GetObjects("Select meshes to union", rs.filter.mesh)
if input: rs.MeshBooleanUnion(input)
```

See also: MeshBooleanDifference, MeshBooleanIntersection, MeshBooleanSplit

## MeshClosestPoint

```python
rs.MeshClosestPoint(object_id, point, maximum_distance=None)
```

Returns the point on a mesh that is closest to a test point

Arguments:

    object_id (guid): identifier of a mesh object
    point (point): point to test
    maximum_distance (number, optional): upper bound used for closest point calculation.
      If you are only interested in finding a point Q on the mesh when
      point.DistanceTo(Q) < maximum_distance, then set maximum_distance to
      that value

Returns: tuple(point, number): containing the results of the calculation where
                      [0] = the 3-D point on the mesh
                      [1] = the index of the mesh face on which the 3-D point lies
None: on error

Example:

```python
import rhinocriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
point = rs.GetPoint("Pick test point")
intersect = rs.MeshClosestPoint(obj, point)
if intersect: rs.AddPoint(intersect)
```

See also: MeshFaceCount, MeshFaces

## MeshFaceCenters

```python
rs.MeshFaceCenters(mesh_id)
```

Returns the center of each face of the mesh object

Arguments:

    mesh_id (guid): identifier of a mesh object

Returns: list(point, ...): points defining the center of each face

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
centers = rs.MeshFaceCenters(obj)
if centers:
    for point in centers: rs.AddPoint(point)
```

See also: IsMesh, MeshFaceCount, MeshFaces

## MeshFaceCount

```python
rs.MeshFaceCount(object_id)
```

Returns total face count of a mesh object

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: the number of mesh faces if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
print("Quad faces:{}".format(rs.MeshQuadCount(obj)))
print("Triangle faces:{}".format(rs.MeshTriangleCount(obj)))
print("Total faces:{}".format(rs.MeshFaceCount(obj)))
```

See also: IsMesh, MeshFaces, MeshVertexCount, MeshVertices

## MeshFaceNormals

```python
rs.MeshFaceNormals(mesh_id)
```

Returns the face unit normal for each face of a mesh object

Arguments:

    mesh_id (guid): identifier of a mesh object

Returns: list(vector, ...): 3D vectors that define the face unit normals of the mesh
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
normals = rs.MeshFaceNormals(obj)
if normals:
    for vector in normals: print(vector)
```

See also: MeshHasFaceNormals, MeshFaceCount, MeshFaces

## MeshFaceVertices

```python
rs.MeshFaceVertices(object_id)
```

Returns the vertex indices of all faces of a mesh object

Arguments:

    object_id (guid): identifier of a mesh object

Returns: list((number, number, number, number), ...): containing tuples of 4 numbers that define the vertex indices for
each face of the mesh. Both quad and triangle faces are returned. If the
third and fourth vertex indices are identical, the face is a triangle.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
faceVerts = rs.MeshFaceVertices( obj )
if faceVerts:
    for count, face in enumerate(faceVerts):
        print("face({}) = ({}, {}, {}, {})".format(count, face[0], face[1], face[2], face[3]))
```

See also: IsMesh, MeshFaceCount, MeshFaces

## MeshFaces

```python
rs.MeshFaces(object_id, face_type=True)
```

Returns face vertices of a mesh

Arguments:

    object_id (guid): identifier of a mesh object
    face_type (bool, optional): The face type to be returned. True = both triangles
      and quads. False = only triangles

Returns: list([point, point, point, point], ...): 3D points that define the face vertices of the mesh. If
face_type is True, then faces are returned as both quads and triangles
(4 3D points). For triangles, the third and fourth vertex will be
identical. If face_type is False, then faces are returned as only
triangles(3 3D points). Quads will be converted to triangles.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
faces = rs.MeshFaces(obj, False)
if faces:
    rs.EnableRedraw(False)
    i = 0
    while( i<=len(faces) ):
        face = faces[i], faces[i+1], faces[i+2], faces[i]
        rs.AddPolyline( face )
        i += 3
rs.EnableRedraw(True)
```

See also: IsMesh, MeshFaceCount, MeshVertexCount, MeshVertices

## MeshHasFaceNormals

```python
rs.MeshHasFaceNormals(object_id)
```

Verifies a mesh object has face normals

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.MeshHasFaceNormals(obj):
    print("The mesh has face normal.")
else:
    print("The mesh does not have face normals.")
```

See also: MeshFaceNormals

## MeshHasTextureCoordinates

```python
rs.MeshHasTextureCoordinates(object_id)
```

Verifies a mesh object has texture coordinates

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.MeshHasTextureCoordinates(obj):
    print("The mesh has texture coordinates.")
else:
    print("The mesh does not have texture coordinates.")
```

## MeshHasVertexColors

```python
rs.MeshHasVertexColors(object_id)
```

Verifies a mesh object has vertex colors

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.mesh.MeshHasVertexColors(obj):
    print("The mesh has vertex colors.")
else:
    print("The mesh does not have vertex colors.")
```

See also: MeshVertexColors

## MeshHasVertexNormals

```python
rs.MeshHasVertexNormals(object_id)
```

Verifies a mesh object has vertex normals

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True if successful, otherwise False.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select a mesh", rs.filter.mesh)
if rs.MeshHasVertexNormals(obj):
    print("The mesh has vertex normals.")
else:
    print("The mesh does not have vertex normals.")
```

See also: MeshVertexNormals

## MeshMeshIntersection

```python
rs.MeshMeshIntersection(mesh1, mesh2, tolerance=None)
```

Calculates the intersections of a mesh object with another mesh object

Arguments:

    mesh1, mesh2 (guid): identifiers of meshes
    tolerance (number, optional): the intersection tolerance. Defaults to ModelAbsoluteTolerance * MeshIntersectionsTolerancesCoefficient

Returns: list(point, ...): of points that define the vertices of the intersection curves

Example:

```python
import rhinoscriptsyntax as rs
mesh1 = rs.GetObject("Select first mesh to intersect", rs.filter.mesh)
mesh2 = rs.GetObject("Select second mesh to intersect", rs.filter.mesh)
results = rs.MeshMeshIntersection(mesh1, mesh2)
if results:
    for points in results: rs.AddPolyline(points)
```

See also: CurveMeshIntersection, MeshClosestPoint

## MeshNakedEdgePoints

```python
rs.MeshNakedEdgePoints(object_id)
```

Identifies the naked edge points of a mesh object. This function shows
    where mesh vertices are not completely surrounded by faces. Joined
    meshes, such as are made by MeshBox, have naked mesh edge points where
    the sub-meshes are joined

Arguments:

    object_id (guid): identifier of a mesh object

Returns: list(bool, ...): of boolean values that represent whether or not a mesh vertex is
naked or not. The number of elements in the list will be equal to
the value returned by MeshVertexCount. In which case, the list will
identify the naked status for each vertex returned by MeshVertices
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
vertices = rs.MeshVertices( obj )
naked = rs.MeshNakedEdgePoints( obj )
for i, vertex in enumerate(vertices):
    if naked[i]: rs.AddPoint(vertex)
```

See also: IsMesh, MeshVertexCount, MeshVertices

## MeshOffset

```python
rs.MeshOffset(mesh_id, distance)
```

Makes a new mesh with vertices offset at a distance in the opposite
    direction of the existing vertex normals

Arguments:

    mesh_id (guid): identifier of a mesh object
    distance (number, optional): the distance to offset

Returns: guid: identifier of the new mesh object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh to offset", rs.filter.mesh)
rs.MeshOffset( mesh, 10.0 )
```

See also: IsMesh

## MeshOutline

```python
rs.MeshOutline(object_ids, view=None)
```

Creates polyline curve outlines of mesh objects

Arguments:

    objects_ids ([guid, ...]): identifiers of meshes to outline
    view (str, optional): view to use for outline direction

Returns: list(guid, ...): polyline curve identifiers on success

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select mesh objects to outline", rs.filter.mesh)
if objs: rs.MeshOutline(objs)
```

See also: IsMesh

## MeshQuadCount

```python
rs.MeshQuadCount(object_id)
```

Returns the number of quad faces of a mesh object

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: the number of quad mesh faces if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
print("Quad faces:{}".format(rs.MeshQuadCount(obj)))
print("Triangle faces:{}".format(rs.MeshTriangleCount(obj)))
print("Total faces:{}".format(rs.MeshFaceCount(obj)))
```

See also: MeshQuadCount

## MeshQuadsToTriangles

```python
rs.MeshQuadsToTriangles(object_id)
```

Converts a mesh object's quad faces to triangles

Arguments:

    object_id (guid): identifier of a mesh object

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
if rs.MeshQuadCount(obj)>0:
    rs.MeshQuadsToTriangles(obj)
```

## MeshToNurb

```python
rs.MeshToNurb(object_id, trimmed_triangles=True, delete_input=False)
```

Duplicates each polygon in a mesh with a NURBS surface. The resulting
    surfaces are then joined into a polysurface and added to the document

Arguments:

    object_id (guid): identifier of a mesh object
    trimmed_triangles (bool, optional): if True, triangles in the mesh will be
      represented by a trimmed plane
    delete_input (bool, optional): delete input object

Returns: list(guid, ...): identifiers for the new breps on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if obj: rs.MeshToNurb(obj)
```

See also: IsMesh, MeshFaces, MeshVertices

## MeshTriangleCount

```python
rs.MeshTriangleCount(object_id)
```

Returns number of triangular faces of a mesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: The number of triangular mesh faces if successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
print("Quad faces:{}".format(rs.MeshQuadCount(obj)))
print("Triangle faces:{}".format(rs.MeshTriangleCount(obj)))
print("Total faces:{}".format(rs.MeshFaceCount(obj)))
```

See also: IsMesh

## MeshVertexColors

```python
rs.MeshVertexColors(mesh_id, colors=0)
```

Returns of modifies vertex colors of a mesh

Arguments:

    mesh_id (guid): identifier of a mesh object
    colors 9{color, ...], optional) A list of color values. Note, for each vertex, there must
      be a corresponding vertex color. If the value is None, then any
      existing vertex colors will be removed from the mesh

Returns: color: if colors is not specified, the current vertex colors
color: if colors is specified, the previous vertex colors

Example:

```python
import rhinoscriptsyntax as rs
import random
       
def randomcolor():
    r = random.randint(0,255)
    g = random.randint(0,255)
    b = random.randint(0,255)
    return r,g,b
       
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if obj:
    colors = []
    for i in range(rs.MeshVertexCount(obj)): colors.append( randomcolor() )
    rs.MeshVertexColors( obj, colors )
```

See also: MeshHasVertexColors, MeshVertexCount, MeshVertices

## MeshVertexCount

```python
rs.MeshVertexCount(object_id)
```

Returns the vertex count of a mesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: The number of mesh vertices if successful.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
print("Vertex count: {}".format(rs.MeshVertexCount(obj)))
```

See also: IsMesh, MeshFaceCount, MeshFaces, MeshVertices

## MeshVertexFaces

```python
rs.MeshVertexFaces(mesh_id, vertex_index)
```

Returns the mesh faces that share a specified mesh vertex

Arguments:

    mesh_id (guid): identifier of a mesh object
    vertex_index (number): index of the mesh vertex to find faces for

Returns: list(number, ...): face indices on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
import random
def TestMeshVertexFaces():
    mesh = rs.GetObject("Select mesh", rs.filter.mesh)
    vertices = rs.MeshVertices(mesh)
    meshfaces = rs.MeshFaceVertices(mesh)
    vertex = random.randint(0, len(vertices)-1) #some random vertex
    vertex_faces = rs.MeshVertexFaces(mesh, vertex )
    if vertex_faces:
        rs.AddPoint( vertices[vertex] )
        for face_index in vertex_faces:
            face = meshfaces[face_index]
            polyline = []
            polyline.append( vertices[face[0]] )
            polyline.append( vertices[face[1]] )
            polyline.append( vertices[face[2]] )
            if face[2]!=face[3]:
                polyline.append( vertices[face[3]] )
            polyline.append( polyline[0] )
            rs.AddPolyline(polyline)
       
TestMeshVertexFaces()
```

See also: MeshFaces, MeshFaceVertices, MeshVertices

## MeshVertexNormals

```python
rs.MeshVertexNormals(mesh_id)
```

Returns the vertex unit normal for each vertex of a mesh

Arguments:

    mesh_id (guid): identifier of a mesh object

Returns: list(vector, ...): of vertex normals, (empty list if no normals exist)

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
normals = rs.MeshVertexNormals(obj)
if normals:
    for normal in normals: print(normal)
```

See also: MeshHasVertexNormals, MeshVertexCount, MeshVertices

## MeshVertices

```python
rs.MeshVertices(object_id)
```

Returns the vertices of a mesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: list(point, ...): vertex points in the mesh

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
vertices = rs.MeshVertices(obj)
if vertices: rs.AddPointCloud(vertices)
```

See also: IsMesh, MeshFaceCount, MeshFaces, MeshVertexCount

## MeshVolume

```python
rs.MeshVolume(object_ids)
```

Returns the approximate volume of one or more closed meshes

Arguments:

    object_ids ([guid, ...]): identifiers of one or more mesh objects

Returns: tuple(number, number, number): containing 3 velues if successful where
     [0] = number of meshes used in volume calculation
     [1] = total volume of all meshes
     [2] = the error estimate
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
if obj and rs.IsMeshClosed(obj):
    volume = rs.MeshVolume(obj)
    if volume: print("Mesh volume:{}".format(volume[1]))
```

See also: IsMeshClosed, MeshArea

## MeshVolumeCentroid

```python
rs.MeshVolumeCentroid(object_id)
```

Calculates the volume centroid of a mesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: point: Point3d representing the volume centroid
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh )
centroid = rs.MeshVolumeCentroid(obj)
rs.AddPoint( centroid )
```

See also: IsMesh, MeshArea, MeshAreaCentroid, MeshVolume

## PullCurveToMesh

```python
rs.PullCurveToMesh(mesh_id, curve_id)
```

Pulls a curve to a mesh. The function makes a polyline approximation of
    the input curve and gets the closest point on the mesh for each point on
    the polyline. Then it "connects the points" to create a polyline on the mesh

Arguments:

    mesh_id (guid): identifier of mesh that pulls
    curve_id (guid): identifier of curve to pull

Returns: guid: identifier new curve on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh that pulls", rs.filter.mesh)
curve = rs.GetObject("Select curve to pull", rs.filter.curve)
rs.PullCurveToMesh( mesh, curve )
```

See also: IsMesh

## SplitDisjointMesh

```python
rs.SplitDisjointMesh(object_id, delete_input=False)
```

Splits up a mesh into its unconnected pieces

Arguments:

    object_id (guid): identifier of a mesh object
    delete_input (bool, optional): delete the input object

Returns: list(guid, ...): identifiers for the new meshes

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if rs.DisjointMeshCount(obj)>0: rs.SplitDisjointMesh(obj)
```

See also: IsMesh, DisjointMeshCount

## UnifyMeshNormals

```python
rs.UnifyMeshNormals(object_id)
```

Fixes inconsistencies in the directions of faces of a mesh

Arguments:

    object_id (guid): identifier of a mesh object

Returns: number: the number of faces that were modified

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select mesh", rs.filter.mesh)
if rs.IsMesh(obj): rs.UnifyMeshNormals(obj)
```

See also: IsMesh
