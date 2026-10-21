# rhinoscriptsyntax: selection

## AllObjects

```python
rs.AllObjects(select=False, include_lights=False, include_grips=False, include_references=False)
```

Returns identifiers of all objects in the document.

Arguments:

    select(bool, optional): Select the objects
    include_lights (bool, optional): Include light objects
    include_grips (bool, optional): Include grips objects

Returns: list(guid, ...): identifiers for all the objects in the document

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.AllObjects()
for obj in objs: print("Object identifier: {}".format(obj))
```

See also: HiddenObjects, LockedObjects, NormalObjects

## FirstObject

```python
rs.FirstObject(select=False, include_lights=False, include_grips=False)
```

Returns identifier of the first object in the document. The first
    object is the last object created by the user.

Arguments:

    select (bool, optional): Select the object.  If omitted (False), the object is not selected.
    include_lights (bool, optional): Include light objects.  If omitted (False), light objects are not returned.
    include_grips (bool, optional): Include grips objects.  If omitted (False), grips objects are not returned.

Returns: guid: The identifier of the object if successful.

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLine( (0,0,0), (5,5,0) )
rs.AddLine( (0,0,0), (5,0,0) )
rs.AddLine( (0,0,0), (0,5,0) )
objectId = rs.FirstObject()
print("Object identifier: {}".format(objectId))
rs.SelectObject(objectId)
```

See also: LastObject, NextObject

## GetCurveObject

```python
rs.GetCurveObject(message=None, preselect=False, select=False)
```

Prompts user to pick or select a single curve object

Arguments:

    message (str, optional): a prompt or message.
    preselect (bool,, optional): Allow for the selection of pre-selected objects.
    select (bool, optional): Select the picked objects. If False, objects that
      are picked are not selected.

Returns: Tuple containing the following information
  [0]  guid     identifier of the curve object
  [1]  bool     True if the curve was preselected, otherwise False
  [2]  number   selection method
                   0 = selected by non-mouse method (SelAll, etc.).
                   1 = selected by mouse click on the object.
                   2 = selected by being inside of a mouse window.
                   3 = selected by intersecting a mouse crossing window.
  [3]  point    selection point
  [4]  number   the curve parameter of the selection point
  [5]  str      name of the view selection was made
None: if no object picked

Example:

```python
import rhinoscriptsyntax as rs
select_result = rs.GetCurveObject("Select curve")
if select_result:
    print("Curve identifier: {}".format(select_result[0]))
```

See also: GetObject, GetObjects, GetSurfaceObject

## GetObject

```python
rs.GetObject(message=None, filter=0, preselect=False, select=False, custom_filter=None, subobjects=False)
```

Prompts user to pick, or select, a single object.

Arguments:

    message(str, optional): a prompt or message.
    filter (number, optional): The type(s) of geometry (points, curves, surfaces, meshes,...)
        that can be selected. Object types can be added together to filter
        several different kinds of geometry. use the filter class to get values
    preselect (bool, optional): Allow for the selection of pre-selected objects.
    select (bool, optional): Select the picked objects.  If False, the objects that are
        picked are not selected.
    subobjects (bool, optional): If True, subobjects can be selected. When this is the
        case, an ObjRef is returned instead of a Guid to allow for tracking
        of the subobject when passed into other functions

Returns: guid: Identifier of the picked object
None: if user did not pick an object

Example:

```python
import rhinoscriptsyntax as rs
objectId = rs.GetObject("Pick any object")
if objectId:
    print("Object identifier: {}".format(objectId))
objectId = rs.GetObject("Pick a curve or surface", rs.filter.curve | rs.filter.surface)
if objectId:
    print("Object identifier: {}".format(objectId))
```

See also: GetCurveObject, GetObjectEx, GetObjects, GetSurfaceObject

## GetObjectEx

```python
rs.GetObjectEx(message=None, filter=0, preselect=False, select=False, objects=None)
```

Prompts user to pick, or select a single object

Arguments:

    message (str, optional): a prompt or message.
    filter (number, optional): The type(s) of geometry (points, curves, surfaces, meshes,...)
        that can be selected. Object types can be added together to filter
        several different kinds of geometry. use the filter class to get values
    preselect (bool, optional):  Allow for the selection of pre-selected objects.
    select (bool, optional): Select the picked objects.  If False, the objects that are
        picked are not selected.
    objects ([guid, ...]): list of object identifiers specifying objects that are
        allowed to be selected

Returns: tuple(guid, bool, number, point, str): containing the following information
    [0] identifier of the object
    [1] True if the object was preselected, otherwise False
    [2] selection method (see help)
    [3] selection point
    [4] name of the view selection was made
None: if no object selected

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObjectEx("Select object", 0, True)
if obj:
    print("Object id = {}".format(obj[0]))
    print("Object was preselected = {}".format(obj[1]))
    if obj[2]==0:
        print("Selection method = 0 (non-mouse)")
    elif obj[2]==1:
        print("Selection method = 1 (mouse)")
        print("Pick point = {}".format(obj[3]))
    elif obj[2]==2:
        print("Selection method = 2 (window)")
    elif obj[2]==3:
        print("Selection method = 3 (crossing)")
    print("Active view = {}".format(obj[4]))
```

See also: GetCurveObject, GetObject, GetObjects, GetObjectsEx, GetSurfaceObject

## GetObjects

```python
rs.GetObjects(message=None, filter=0, group=True, preselect=False, select=False, objects=None, minimum_count=1, maximum_count=0, custom_filter=None)
```

Prompts user to pick or select one or more objects.

Arguments:

    message (str, optional): a prompt or message.
    filter (number, optional): The type(s) of geometry (points, curves, surfaces, meshes,...)
        that can be selected. Object types can be added together to filter
        several different kinds of geometry. use the filter class to get values
            Value         Description
            0             All objects (default)
            1             Point
            2             Point cloud
            4             Curve
            8             Surface or single-face brep
            16            Polysurface or multiple-face
            32            Mesh
            256           Light
            512           Annotation
            4096          Instance or block reference
            8192          Text dot object
            16384         Grip object
            32768         Detail
            65536         Hatch
            131072        Morph control
            262144        SubD
            134217728     Cage
            268435456     Phantom
            536870912     Clipping plane
            1073741824    Extrusion
    group (bool, optional): Honor object grouping.  If omitted and the user picks a group,
        the entire group will be picked (True). Note, if filter is set to a
        value other than 0 (All objects), then group selection will be disabled.
    preselect (bool, optional):  Allow for the selection of pre-selected objects.
    select (bool, optional): Select the picked objects.  If False, the objects that are
        picked are not selected.
    objects ([guid, ...]): list of objects that are allowed to be selected
    minimum_count, maximum_count(number): limits on number of objects allowed to be selected
    custom_filter (str, optional): Calls a custom function in the script and passes the Rhino Object, Geometry, and component index and returns true or false indicating if the object can be selected

Returns: list(guid, ...): identifiers of the picked objects

Example:

```python
import rhinoscriptsyntax as rs
objectIds = rs.GetObjects("Pick some curves", rs.filter.curve)
for id in objectIds: print("Object identifier:{}".format(id))
```

See also: GetCurveObject, GetObject, GetSurfaceObject

## GetObjectsEx

```python
rs.GetObjectsEx(message=None, filter=0, group=True, preselect=False, select=False, objects=None)
```

Prompts user to pick, or select one or more objects

Arguments:

    message (str, optional):  a prompt or message.
    filter (number, optional): The type(s) of geometry (points, curves, surfaces, meshes,...)
        that can be selected. Object types can be added together to filter
        several different kinds of geometry. use the filter class to get values
    group (bool, optional): Honor object grouping.  If omitted and the user picks a group,
        the entire group will be picked (True). Note, if filter is set to a
        value other than 0 (All objects), then group selection will be disabled.
    preselect (bool, optional):  Allow for the selection of pre-selected objects.
    select (bool, optional): Select the picked objects. If False, the objects that are
        picked are not selected.
    objects ([guid, ...]): list of object identifiers specifying objects that are
        allowed to be selected

Returns: list(tuple(guid, bool, number, point, str), ...): containing the following information
  [n][0]  identifier of the object
  [n][1]  True if the object was preselected, otherwise False
  [n][2]  selection method (see help)
  [n][3]  selection point
  [n][4]  name of the view selection was made

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjectsEx("Select objects", 0, True)
for obj in objects:
    print("Object id = {}".format(obj[0]))
    print("Object was preselected = {}".format(obj[1]))
    if obj[2]==0:
        print("Selection method = 0 (non-mouse)")
    elif obj[2]==1:
        print("Selection method = 1 (mouse)")
        print("Pick point = {}".format(obj[3]))
    elif obj[2]==2:
        print("Selection method = 2 (window)")
    elif obj[2]==3:
        print("Selection method = 3 (crossing)")
    print("Active view = {}".format(obj[4]))
```

See also: GetCurveObject, GetObject, GetObjectEx, GetObjects, GetSurfaceObject

## GetPointCoordinates

```python
rs.GetPointCoordinates(message="Select points", preselect=False)
```

Prompts the user to select one or more point objects.

Arguments:

    message (str, optional): a prompt message.
    preselect (bool, optional): Allow for the selection of pre-selected objects.  If omitted (False), pre-selected objects are not accepted.

Returns: list(point, ...): 3d coordinates of point objects on success

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPointCoordinates()
for point in points: print(point)
```

See also: GetObject, GetObjects, GetPoint, GetPoints, PointCoordinates

## GetSurfaceObject

```python
rs.GetSurfaceObject(message="Select surface", preselect=False, select=False)
```

Prompts the user to select a single surface

Arguments:

    message(str, optional): prompt displayed
    preselect (bool, optional): allow for preselected objects
    select (bool, optional):  select the picked object

Returns: tuple(guid, bool, number, point, (number, number), str): of information on success
  [0]  identifier of the surface
  [1]  True if the surface was preselected, otherwise False
  [2]  selection method ( see help )
  [3]  selection point
  [4]  u,v surface parameter of the selection point
  [5]  name of the view in which the selection was made
None: on error

Example:

```python
import rhinoscriptsyntax as rs
select = rs.GetSurfaceObject("Select surface")
if select:
    print("Surface identifier: {}".format(select[0]))
```

See also: GetCurveObject, GetObject, GetObjects

## HiddenObjects

```python
rs.HiddenObjects(include_lights=False, include_grips=False, include_references=False)
```

Returns identifiers of all hidden objects in the document. Hidden objects
    are not visible, cannot be snapped to, and cannot be selected

Arguments:

    include_lights (bool, optional): include light objects
    include_grips (bool, optional): include grip objects

Returns: list(guid, ...): identifiers of the hidden objects if successful.

Example:

```python
import rhinoscriptsyntax as rs
hidden = rs.HiddenObjects()
for obj in hidden: print("Object identifier{}".format(obj))
```

See also: AllObjects, LockedObjects, NormalObjects

## InvertSelectedObjects

```python
rs.InvertSelectedObjects(include_lights=False, include_grips=False, include_references=False)
```

Inverts the current object selection. The identifiers of the newly
    selected objects are returned

Arguments:

    include_lights (bool, optional): Include light objects.  If omitted (False), light objects are not returned.
    include_grips (bool, optional): Include grips objects.  If omitted (False), grips objects are not returned.
    include_references (bool, optional): Include reference objects.  If omitted (False), reference objects are not returned.

Returns: list(guid, ...): identifiers of the newly selected objects if successful.

Example:

```python
import rhinoscriptsyntax as rs
rs.GetObjects("Select some objects", select=True)
objs = rs.InvertSelectedObjects()
for id in objs: print("Object identifier:{}".format(id))
```

See also: SelectedObjects, UnselectAllObjects

## LastCreatedObjects

```python
rs.LastCreatedObjects(select=False)
```

Returns identifiers of the objects that were most recently created or changed
    by scripting a Rhino command using the Command function. It is important to
    call this function immediately after calling the Command function as only the
    most recently created or changed object identifiers will be returned

Arguments:

    select (bool, optional): Select the object.  If omitted (False), the object is not selected.

Returns: list(guid, ...): identifiers of the most recently created or changed objects if successful.

Example:

```python
import rhinoscriptsyntax as rs
rs.Command( "_-Circle 0,0,0 10" )
rs.Command( "_-Circle 10,0,0 10" )
rs.Command( "_-Circle 20,0,0 10" )
objs = rs.LastCreatedObjects()
if objs:
    # Only the last circle will be selected
    rs.SelectObjects( objs )
```

See also: Command

## LastObject

```python
rs.LastObject(select=False, include_lights=False, include_grips=False)
```

Returns the identifier of the last object in the document. The last object
    in the document is the first object created by the user

Arguments:

    select (bool, optional): select the object
    include_lights (bool, optional): include lights in the potential set
    include_grips (bool, optional): include grips in the potential set

Returns: guid: identifier of the object on success

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLine((0,0,0), (5,5,0))
rs.AddCircle((0,0,0), 5)
print("Object identifier: {}".format(rs.LastObject()))
```

See also: FirstObject, NextObject

## LockedObjects

```python
rs.LockedObjects(include_lights=False, include_grips=False, include_references=False)
```

Returns identifiers of all locked objects in the document. Locked objects
    cannot be snapped to, and cannot be selected

Arguments:

    include_lights (bool, optional): include light objects
    include_grips (bool, optional): include grip objects

Returns: list(guid, ...): identifiers the locked objects if successful.

Example:

```python
import rhinoscriptsyntax as  rs
objs = rs.LockedObjects()
for obj in objs: print("Object  identifier:{}".format(obj))
```

See also: AllObjects, HiddenObjects, NormalObjects

## NextObject

```python
rs.NextObject(object_id, select=False, include_lights=False, include_grips=False)
```

Returns the identifier of the next object in the document

Arguments:

    object_id (guid): the identifier of the object from which to get the next object
    select (bool, optional): select the object
    include_lights (bool, optional): include lights in the potential set
    include_grips (bool, optional): include grips in the potential set

Returns: guid: identifier of the object on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.FirstObject()
while obj:
    print("Object identifier:{}".format(obj))
    obj = rs.NextObject(obj)
```

See also: FirstObject, LastObject

## NormalObjects

```python
rs.NormalObjects(include_lights=False, include_grips=False)
```

Returns identifiers of all normal objects in the document. Normal objects
    are visible, can be snapped to, and are independent of selection state

Arguments:

    include_lights (bool, optional): Include light objects.  If omitted (False), light objects are not returned.
    include_gripts (bool, optional): Include grips objects.  If omitted (False), grips objects are not returned.

Returns: list(guid, ...): identifier of normal objects if successful.

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.NormalObjects()
for obj in objs: print("Object identifier:{}".format(obj))
```

See also: AllObjects, HiddenObjects, LockedObjects

## ObjectsByColor

```python
rs.ObjectsByColor(color, select=False, include_lights=False)
```

Returns identifiers of all objects based on color

Arguments:

    color (color): color to get objects by
    select (bool, optional): select the objects
    include_lights (bool, optional): include lights in the set

Returns: list(guid, ...): identifiers of objects of the selected color.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Pick any object")
if obj:
    color = rs.ObjectColor(obj)
    rs.ObjectsByColor(color, True)
```

## ObjectsByGroup

```python
rs.ObjectsByGroup(group_name, select=False)
```

Returns identifiers of all objects based on the objects' group name

Arguments:

    group_name (str): name of the group
    select (bool, optional): select the objects

Returns: list(guid, ...):identifiers for objects in the group on success

Example:

```python
import rhinoscriptsyntax as rs
group = rs.GetString("Group to select")
if group: rs.ObjectsByGroup( group, True )
```

## ObjectsByLayer

```python
rs.ObjectsByLayer(layer_name, select=False)
```

Returns identifiers of all objects based on the objects' layer name

Arguments:

    layer_name (str): name of the layer
    select (bool, optional): select the objects

Returns: list(guid, ...): identifiers for objects in the specified layer

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Pick any object")
if obj:
    layer = rs.ObjectLayer(obj)
    rs.ObjectsByLayer(layer, True)
```

## ObjectsByName

```python
rs.ObjectsByName(name, select=False, include_lights=False, include_references=False)
```

Returns identifiers of all objects based on user-assigned name

Arguments:

    name (str): name of the object or objects
    select (bool, optional): select the objects
    include_lights (bool, optional): include light objects

Returns: list(guid, ...): identifiers for objects with the specified name.

Example:

```python
import rhinoscriptsyntax as rs
name = rs.GetString("Name to select")
if name: rs.ObjectsByName(name,True)
```

## ObjectsByType

```python
rs.ObjectsByType(geometry_type, select=False, state=0)
```

Returns identifiers of all objects based on the objects' geometry type.

Arguments:

    geometry_type (number): The type(s) of geometry objects (points, curves, surfaces,
           meshes, etc.) that can be selected. Object types can be
           added together as bit-coded flags to filter several different kinds of geometry.
            Value        Description
             0           All objects
             1           Point
             2           Point cloud
             4           Curve
             8           Surface or single-face brep
             16          Polysurface or multiple-face
             32          Mesh
             256         Light
             512         Annotation
             4096        Instance or block reference
             8192        Text dot object
             16384       Grip object
             32768       Detail
             65536       Hatch
             131072      Morph control
             262144      SubD
             134217728   Cage
             268435456   Phantom
             536870912   Clipping plane
             1073741824  Extrusion
    select (bool, optional): Select the objects
    state (bool, optional): The object state (normal, locked, and hidden). Object states can be 
      added together to filter several different states of geometry.
            Value     Description
            0         All objects
            1         Normal objects
            2         Locked objects
            4         Hidden objects

Returns: list(guid, ...): identifiers of object that fit the specified type(s).

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.ObjectsByType(4 | 8, True)
```

## SelectedObjects

```python
rs.SelectedObjects(include_lights=False, include_grips=False)
```

Returns the identifiers of all objects that are currently selected

Arguments:

    include_lights (bool, optional): include light objects
    include_grips (bool, optional): include grip objects

Returns: list(guid, ...) identifiers of selected objects

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.SelectedObjects()
for obj in objects: print("Object identifier: {}".format(obj))
```

See also: InvertSelectedObjects, UnselectAllObjects

## UnselectAllObjects

```python
rs.UnselectAllObjects()
```

Unselects all objects in the document

Returns: number: the number of objects that were unselected

Example:

```python
import rhinoscriptsyntax as rs
count = rs.UnselectAllObjects()
print("{} objects were unselected".format(count))
```

See also: InvertSelectedObjects, SelectedObjects

## VisibleObjects

```python
rs.VisibleObjects(view=None, select=False, include_lights=False, include_grips=False)
```

Return identifiers of all objects that are visible in a specified view

Arguments:

    view (bool, optional): the view to use. If omitted, the current active view is used
    select (bool, optional): Select the objects
    include_lights (bool, optional): include light objects
    include_grips (bool, optional): include grip objects

Returns: list(guid, ...): identifiers of the visible objects

Example:

```python
import rhinoscriptsyntax as rs
object_ids = rs.VisibleObjects("Top")
if object_ids:
    for id in object_ids: print("Object identifier:{}".format(id))
```

See also: IsView, IsVisibleInView

## WindowPick

```python
rs.WindowPick(corner1, corner2, view=None, select=False, in_window=True)
```

Picks objects using either a window or crossing selection

Arguments:

    corner1, corner2 (point): corners of selection window
    view (bool, optional): view to perform the selection in
    select (bool, optional): select picked objects
    in_window (bool, optional): if False, then a crossing window selection is performed

Returns: list(guid, ...): identifiers of selected objects on success

Example:

```python
import rhinoscriptsyntax as  rs
rs.WindowPick((0,0,0), (0,0,0),  None, True)
```
