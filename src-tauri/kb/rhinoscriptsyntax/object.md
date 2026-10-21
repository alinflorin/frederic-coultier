# rhinoscriptsyntax: object

## CopyObject

```python
rs.CopyObject(object_id, translation=None)
```

Copies object from one location to another, or in-place.

Arguments:

    object_id (guid): object to copy
    translation (vector, optional): translation vector to apply

Returns: guid: id for the copy if successful
None: if not able to copy

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to copy")
if id:
    start = rs.GetPoint("Point to copy from")
    if start:
        end = rs.GetPoint("Point to copy to", start)
        if end:
            translation = end-start
            rs.CopyObject( id, translation )
```

See also: CopyObjects

## CopyObjects

```python
rs.CopyObjects(object_ids, translation=None)
```

Copies one or more objects from one location to another, or in-place.

Arguments:

    object_ids ([guid, ...])list of objects to copy
    translation (vector, optional): list of three numbers or Vector3d representing
                       translation vector to apply to copied set

Returns: list(guid, ...): identifiers for the copies if successful

Example:

```python
import rhinoscriptsyntax as rs
objectIds = rs.GetObjects("Select objects to copy")
if objectIds:
    start = rs.GetPoint("Point to copy from")
    if start:
        end = rs.GetPoint("Point to copy to", start)
        if end:
            translation = end-start
            rs.CopyObjects( objectIds, translation )
```

See also: CopyObject

## DeleteObject

```python
rs.DeleteObject(object_id)
```

Deletes a single object from the document

Arguments:

    object_id (guid): identifier of object to delete

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to delete")
if id: rs.DeleteObject(id)
```

See also: DeleteObjects

## DeleteObjects

```python
rs.DeleteObjects(object_ids)
```

Deletes one or more objects from the document

Arguments:

    object_ids ([guid, ...]): identifiers of objects to delete

Returns: number: Number of objects deleted

Example:

```python
import rhinoscriptsyntax as rs
object_ids = rs.GetObjects("Select objects to delete")
if object_ids: rs.DeleteObjects(object_ids)
```

See also: DeleteObject

## FlashObject

```python
rs.FlashObject(object_ids, style=True)
```

Causes the selection state of one or more objects to change momentarily
    so the object appears to flash on the screen

Arguments:

    object_ids ([guid, ...]) identifiers of objects to flash
    style (bool, optional): If True, flash between object color and selection color.
      If False, flash between visible and invisible

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.ObjectsByLayer("Default")
if objs: rs.FlashObject(objs)
```

See also: HideObjects, SelectObjects, ShowObjects, UnselectObjects

## HideObject

```python
rs.HideObject(object_id)
```

Hides a single object

Arguments:

    object_id (guid): id of object to hide

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to hide")
if id: rs.HideObject(id)
```

See also: HideObjects, IsObjectHidden, ShowObject, ShowObjects

## HideObjects

```python
rs.HideObjects(object_ids)
```

Hides one or more objects

Arguments:

    object_ids ([guid, ...]): identifiers of objects to hide

Returns: number: Number of objects hidden

Example:

```python
import rhinoscriptsyntax as rs
ids = rs.GetObjects("Select objects to hide")
if ids: rs.HideObjects(ids)
```

See also: HideObjects, IsObjectHidden, ShowObject, ShowObjects

## IsLayoutObject

```python
rs.IsLayoutObject(object_id)
```

Verifies that an object is in either page layout space or model space

Arguments:

    object_id (guid): id of an object to test

Returns: bool: True if the object is in page layout space
bool: False if the object is in model space

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if id:
    if rs.IsLayoutObject(id):
        print("The object is in page layout space.")
    else:
        print("The object is in model space.")
```

See also: IsObject, IsObjectReference

## IsObject

```python
rs.IsObject(object_id)
```

Verifies the existence of an object

Arguments:

    object_id (guid): an object to test

Returns: bool: True if the object exists
bool: False if the object does not exist

Example:

```python
import rhinoscriptsyntax as rs
#Do something here...
if rs.IsObject(id):
    print("The object exists.")
else:
    print("The object does not exist.")
```

See also: IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectHidden

```python
rs.IsObjectHidden(object_id)
```

Verifies that an object is hidden. Hidden objects are not visible, cannot
    be snapped to, and cannot be selected

Arguments:

    object_id (guid): The identifier of an object to test

Returns: bool: True if the object is hidden
bool: False if the object is not hidden

Example:

```python
import rhinoscriptsyntax as rs
# Do something here...
if rs.IsObjectHidden(id):
    print("The object is hidden.")
else:
    print("The object is not hidden.")
```

See also: IsObject, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectInBox

```python
rs.IsObjectInBox(object_id, box, test_mode=True)
```

Verifies an object's bounding box is inside of another bounding box

Arguments:

    object_id (guid): identifier of an object to be tested
    box ([point, point, point, point, point, point, point, point]): bounding box to test for containment
    test_mode (bool, optional): If True, the object's bounding box must be contained by box
      If False, the object's bounding box must be contained by or intersect box

Returns: bool: True if object is inside box
bool: False is object is not inside box

Example:

```python
import rhinoscriptsyntax as rs
box = rs.GetBox()
if box:
    rs.EnableRedraw(False)
    object_list = rs.AllObjects()
    for obj in object_list:
        if rs.IsObjectInBox(obj, box, False):
            rs.SelectObject( obj )
    rs.EnableRedraw( True )
```

See also: BoundingBox, GetBox

## IsObjectInGroup

```python
rs.IsObjectInGroup(object_id, group_name=None)
```

Verifies that an object is a member of a group

Arguments:

    object_id (guid): The identifier of an object
    group_name (str, optional): The name of a group. If omitted, the function
      verifies that the object is a member of any group

Returns: bool: True if the object is a member of the specified group. If a group_name
  was not specified, the object is a member of some group.
bool: False if the object is not a member of the specified group. If a
  group_name was not specified, the object is not a member of any group

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if id:
    name = rs.GetString("Group name")
    if name:
        result = rs.IsObjectInGroup(id, name)
        if result:
            print("The object belongs to the group.")
        else:
            print("The object does not belong to the group.")
```

See also: IsObject, IsObjectHidden, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectLocked

```python
rs.IsObjectLocked(object_id)
```

Verifies that an object is locked. Locked objects are visible, and can
    be snapped to, but cannot be selected

Arguments:

    object_id (guid): The identifier of an object to be tested

Returns: bool: True if the object is locked
bool: False if the object is not locked

Example:

```python
import rhinoscriptsyntax as rs
# Do something here...
if rs.IsObjectLocked(object):
    print("The object is locked.")
else:
    print("The object is not locked.")
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectNormal

```python
rs.IsObjectNormal(object_id)
```

Verifies that an object is normal. Normal objects are visible, can be
    snapped to, and can be selected

Arguments:

    object_id (guid): The identifier of an object to be tested

Returns: bool: True if the object is normal
bool: False if the object is not normal

Example:

```python
import rhinoscriptsyntax as rs
#Do something here...
if rs.IsObjectNormal(object):
    print("The object is normal.")
else:
    print("The object is not normal.")
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectReference, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectReference

```python
rs.IsObjectReference(object_id)
```

Verifies that an object is a reference object. Reference objects are
    objects that are not part of the current document

Arguments:

    object_id (guid): The identifier of an object to test

Returns: bool: True if the object is a reference object
bool: False if the object is not a reference object

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if rs.IsObjectReference(id):
    print("The object is a reference object.")
else:
    print("The object is not a reference object.")
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectSelectable, IsObjectSelected, IsObjectSolid

## IsObjectSelectable

```python
rs.IsObjectSelectable(object_id)
```

Verifies that an object can be selected

Arguments:

    object_id (guid): The identifier of an object to test

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
# Do something here...
if rs.IsObjectSelectable(object):
rs.SelectObject( object )
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelected, IsObjectSolid

## IsObjectSelected

```python
rs.IsObjectSelected(object_id)
```

Verifies that an object is currently selected.

Arguments:

    object_id (guid): The identifier of an object to test

Returns: int: 0, the object is not selected
int: 1, the object is selected
int: 2, the object is entirely persistently selected
int: 3, one or more proper sub-objects are selected

Example:

```python
import rhinoscriptsyntax as rs
object = rs.GetObject()
if rs.IsObjectSelected(object):
    print("The object is selected.")
else:
    print("The object is not selected.")
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSolid

## IsObjectSolid

```python
rs.IsObjectSolid(object_id)
```

Determines if an object is closed, solid

Arguments:

    object_id (guid): The identifier of an object to test

Returns: bool: True if the object is solid, or a mesh is closed.
bool: False otherwise.

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if rs.IsObjectSolid(id):
    print("The object is solid.")
else:
    print("The object is not solid.")
```

See also: IsObject, IsObjectHidden, IsObjectInGroup, IsObjectLocked, IsObjectNormal, IsObjectReference, IsObjectSelectable, IsObjectSelected

## IsObjectValid

```python
rs.IsObjectValid(object_id)
```

Verifies an object's geometry is valid and without error

Arguments:

    object_id (guid): The identifier of an object to test

Returns: bool: True if the object is valid

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if rs.IsObjectValid(id):
    print("The object is valid.")
else:
    print("The object is not valid.")
```

See also: IsObject

## IsVisibleInView

```python
rs.IsVisibleInView(object_id, view=None)
```

Verifies an object is visible in a view

Arguments:

    object_id (guid): the identifier of an object to test
    view (str, optional): he title of the view.  If omitted, the current active view is used.

Returns: bool: True if the object is visible in the specified view, otherwise False.  None on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if rs.IsObject(obj):
    view = rs.CurrentView()
    if rs.IsVisibleInView(obj, view):
        print("The object is visible in {}.".format(view))
    else:
        print("The object is not visible in {}.".format(view))
```

See also: IsObject, IsView

## LockObject

```python
rs.LockObject(object_id)
```

Locks a single object. Locked objects are visible, and they can be
    snapped to. But, they cannot be selected.

Arguments:

    object_id (guid): The identifier of an object

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to lock")
if id: rs.LockObject(id)
```

See also: IsObjectLocked, LockObjects, UnlockObject, UnlockObjects

## LockObjects

```python
rs.LockObjects(object_ids)
```

Locks one or more objects. Locked objects are visible, and they can be
    snapped to. But, they cannot be selected.

Arguments:

    object_ids ([guid, ...]): list of Strings or Guids. The identifiers of objects

Returns: number: number of objects locked

Example:

```python
import rhinoscriptsyntax as rs
ids = rs.GetObjects("Select objects to lock")
if ids: rs.LockObjects(ids)
```

See also: IsObjectLocked, LockObject, UnlockObject, UnlockObjects

## MatchObjectAttributes

```python
rs.MatchObjectAttributes(target_ids, source_id=None)
```

Matches, or copies the attributes of a source object to a target object

Arguments:

    target_ids ([guid, ...]): identifiers of objects to copy attributes to
    source_id (guid, optional): identifier of object to copy attributes from. If None,
      then the default attributes are copied to the target_ids

Returns: number: number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
targets = rs.GetObjects("Select objects")
if targets:
    source = rs.GetObject("Select object to match")
    if source: rs.MatchObjectAttributes( targets, source )
```

See also: GetObject, GetObjects

## MirrorObject

```python
rs.MirrorObject(object_id, start_point, end_point, copy=False)
```

Mirrors a single object

Arguments:

    object_id (guid): The identifier of an object to mirror
    start_point (point): start of the mirror plane
    end_point (point): end of the mirror plane
    copy (bool, optional): copy the object

Returns: guid: Identifier of the mirrored object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to mirror")
if obj:
    start = rs.GetPoint("Start of mirror plane")
    end = rs.GetPoint("End of mirror plane")
    if start and end:
        rs.MirrorObject( obj, start, end, True )
```

See also: MirrorObjects

## MirrorObjects

```python
rs.MirrorObjects(object_ids, start_point, end_point, copy=False)
```

Mirrors a list of objects

Arguments:

    object_ids ([guid, ...]): identifiers of objects to mirror
    start_point (point): start of the mirror plane
    end_point (point): end of the mirror plane
    copy (bool, optional): copy the objects

Returns: list(guid, ...): List of identifiers of the mirrored objects if successful

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to mirror")
if objs:
    start = rs.GetPoint("Start of mirror plane")
    end = rs.GetPoint("End of mirror plane")
    if start and end:
        rs.MirrorObjects( objs, start, end, True )
```

See also: MirrorObject

## MoveObject

```python
rs.MoveObject(object_id, translation)
```

Moves a single object

Arguments:

    object_id (guid): The identifier of an object to move
    translation (vector): list of 3 numbers or Vector3d

Returns: guid: Identifier of the moved object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object to move")
if id:
    start = rs.GetPoint("Point to move from")
    if start:
        end = rs.GetPoint("Point to move to")
        if end:
            translation = end-start
            rs.MoveObject(id, translation)
```

See also: MoveObjects

## MoveObjects

```python
rs.MoveObjects(object_ids, translation)
```

Moves one or more objects

Arguments:

    object_ids ([guid, ...]): The identifiers objects to move
    translation (vector): list of 3 numbers or Vector3d

Returns: list(guid, ...): identifiers of the moved objects if successful

Example:

```python
import rhinoscriptsyntax as rs
ids = rs.GetObjects("Select objects to move")
if ids:
    start = rs.GetPoint("Point to move from")
    if start:
        end = rs.GetPoint("Point to move to")
        if end:
            translation = end-start
            rs.MoveObjects( ids, translation )
```

See also: MoveObject

## ObjectColor

```python
rs.ObjectColor(object_ids, color=None)
```

Returns of modifies the color of an object. Object colors are represented
    as RGB colors. An RGB color specifies the relative intensity of red, green,
    and blue to cause a specific color to be displayed

Arguments:

    object_ids ([guid, ...]): id or ids of object(s)
    color (color, optional): the new color value. If omitted, then current object
        color is returned. If object_ids is a list, color is required

Returns: color: If color value is not specified, the current color value
color: If color value is specified, the previous color value
number: If object_ids is a list, then the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to change color")
if objs:
    color = rs.GetColor(0)
    if color:
        for obj in objs: rs.ObjectColor( obj, color )
```

See also: ObjectColorSource, ObjectsByColor

## ObjectColorSource

```python
rs.ObjectColorSource(object_ids, source=None)
```

Returns of modifies the color source of an object.

Arguments:

    object_ids ([guid, ...]): single identifier of list of identifiers
    source (number, optional) = new color source
        0 = color from layer
        1 = color from object
        2 = color from material
        3 = color from parent

Returns: if color source is not specified, the current color source
is color source is specified, the previous color source
if color_ids is a list, then the number of objects modifief

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to reset color source")
if objs:
    for obj In objs: rs.ObjectColorSource(obj, 0)
```

See also: ObjectColor

## ObjectDescription

```python
rs.ObjectDescription(object_id)
```

Returns a short text description of an object

Arguments:

    object_id = identifier of an object

Returns: A short text description of the object if successful.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    description = rs.ObjectDescription(obj)
    print("Object description:"{} .format(description))
```

See also: ObjectType

## ObjectGroups

```python
rs.ObjectGroups(object_id)
```

Returns all of the group names that an object is assigned to

Arguments:

    object_id ([guid, ...]): identifier of an object(s)

Returns: list(str, ...): list of group names on success

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    groups = rs.ObjectGroups(obj)
    if groups:
        for group in groups: print("Object group: {}".format(group))
    else:
        print("No groups.")
```

See also: ObjectsByGroup

## ObjectLayer

```python
rs.ObjectLayer(object_id, layer=None)
```

Returns or modifies the layer of an object

Arguments:

    object_id ([guid, ...]) the identifier of the object(s)
    layer (str, optional):  name of an existing layer

Returns: str: If a layer is not specified, the object's current layer
str: If a layer is specified, the object's previous layer
number: If object_id is a list or tuple, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
id = rs.GetObject("Select object")
if id: rs.ObjectLayer(id, "Default")
```

See also: ObjectsByLayer

## ObjectLayout

```python
rs.ObjectLayout(object_id, layout=None, return_name=True)
```

Returns or changes the layout or model space of an object

Arguments:

    object_id (guid): identifier of the object
    layout (str|guid, optional): to change, or move, an object from model space to page
      layout space, or from one page layout to another, then specify the
      title or identifier of an existing page layout view. To move an object
      from page layout space to model space, just specify None
    return_name[opt] = If True, the name, or title, of the page layout view
      is returned. If False, the identifier of the page layout view is returned

Returns: str: if layout is not specified, the object's current page layout view
str: if layout is specified, the object's previous page layout view
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj: rs.ObjectLayout(obj, "Page 1")
```

See also: IsLayoutObject, IsLayout, ViewNames

## ObjectLinetype

```python
rs.ObjectLinetype(object_ids, linetype=None)
```

Returns of modifies the linetype of an object

Arguments:

    object_ids ({guid, ...]): identifiers of object(s)
    linetype (str, optional): name of an existing linetype. If omitted, the current
      linetype is returned. If object_ids is a list of identifiers, this parameter
      is required

Returns: str: If a linetype is not specified, the object's current linetype
str: If linetype is specified, the object's previous linetype
number: If object_ids is a list, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj: rs.ObjectLinetype(obj, "Continuous")
```

See also: ObjectLinetypeSource

## ObjectLinetypeSource

```python
rs.ObjectLinetypeSource(object_ids, source=None)
```

Returns of modifies the linetype source of an object

Arguments:

    object_ids ([guid, ...]): identifiers of object(s)
    source (number, optional): new linetype source. If omitted, the current source is returned.
      If object_ids is a list of identifiers, this parameter is required
        0 = By Layer
        1 = By Object
        3 = By Parent

Returns: number: If a source is not specified, the object's current linetype source
number: If source is specified, the object's previous linetype source
number: If object_ids is a list, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to reset linetype source")
if objects:
    for obj in objects: rs.ObjectLinetypeSource( obj, 0 )
```

See also: ObjectLinetype

## ObjectMaterialIndex

```python
rs.ObjectMaterialIndex(object_id, material_index=None)
```

Returns or changes the material index of an object. Rendering materials are stored in
    Rhino's rendering material table. The table is conceptually an array. Render
    materials associated with objects and layers are specified by zero based
    indices into this array.

Arguments:

    object_id (guid): identifier of an object
    index (number, optional): the new material index

Returns: number: If the return value of ObjectMaterialSource is "material by object", then
    the return value of this function is the index of the object's rendering
    material. A material index of -1 indicates no material has been assigned,
    and that Rhino's internal default material has been assigned to the object.
None: on failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    source = rs.ObjectMaterialSource(obj)
    if source==0:
        print("The material source is by layer")
    else:
        print("The material source is by object")
        index = rs.ObjectMaterialIndex(obj)
        if index==-1: print("The material is default.")
        else: print("The material is custom.")
```

See also: ObjectMaterialSource

## ObjectMaterialSource

```python
rs.ObjectMaterialSource(object_ids, source=None)
```

Returns or modifies the rendering material source of an object.

Arguments:

    object_ids ([guid, ...]): one or more object identifiers
    source (number, optional): The new rendering material source. If omitted and a single
      object is provided in object_ids, then the current material source is
      returned. This parameter is required if multiple objects are passed in
      object_ids
      0 = Material from layer
      1 = Material from object
      3 = Material from parent

Returns: number: If source is not specified, the current rendering material source
number: If source is specified, the previous rendering material source
number: If object_ids refers to multiple objects, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to reset rendering material source")
if objects:
    [rs.ObjectMaterialSource(obj, 0) for obj in objects]
```

See also: ObjectMaterialIndex

## ObjectName

```python
rs.ObjectName(object_id, name=None)
```

Returns or modifies the name of an object

Arguments:

    object_id ([guid, ...]): id or ids of object(s)
    name (str, optional): the new object name. If omitted, the current name is returned

Returns: str: If name is not specified, the current object name
str: If name is specified, the previous object name
number: If object_id is a list, the number of objects changed

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(message1="Pick some points")
if points:
    count = 0
    for point in points:
        obj = rs.AddPoint(point)
        if obj:
            rs.ObjectName( obj, "Point"+str(count) )
            count += 1
```

See also: ObjectsByName

## ObjectPrintColor

```python
rs.ObjectPrintColor(object_ids, color=None)
```

Returns or modifies the print color of an object

Arguments:

    object_ids ([guid, ...]): identifiers of object(s)
    color (color, optional): new print color. If omitted, the current color is returned.

Returns: color: If color is not specified, the object's current print color
color: If color is specified, the object's previous print color
number: If object_ids is a list or tuple, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to change print color")
if objects:
    color = rs.GetColor()
    if color:
        for object in objects: rs.ObjectPrintColor(object, color)
```

See also: ObjectPrintColorSource

## ObjectPrintColorSource

```python
rs.ObjectPrintColorSource(object_ids, source=None)
```

Returns or modifies the print color source of an object

Arguments:

    object_ids ([guid, ...]): identifiers of object(s)
    source (number, optional): new print color source
      0 = print color by layer
      1 = print color by object
      3 = print color by parent

Returns: number: If source is not specified, the object's current print color source
number: If source is specified, the object's previous print color source
number: If object_ids is a list or tuple, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to reset print color source")
if objects:
    for object in objects: rs.ObjectPrintColorSource(object, 0)
```

See also: ObjectPrintColor

## ObjectPrintWidth

```python
rs.ObjectPrintWidth(object_ids, width=None)
```

Returns or modifies the print width of an object

Arguments:

    object_ids ([guid, ...]): identifiers of object(s)
    width (number, optional): new print width value in millimeters, where width=0 means use
      the default width, and width<0 means do not print (visible for screen display,
      but does not show on print). If omitted, the current width is returned.

Returns: number: If width is not specified, the object's current print width
number: If width is specified, the object's previous print width
number: If object_ids is a list or tuple, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to change print width")
if objs:
    for obj in objs: rs.ObjectPrintWidth(obj,0.5)
```

See also: ObjectPrintWidthSource

## ObjectPrintWidthSource

```python
rs.ObjectPrintWidthSource(object_ids, source=None)
```

Returns or modifies the print width source of an object

Arguments:

    object_ids ([guid, ...]): identifiers of object(s)
    source (number, optional): new print width source
      0 = print width by layer
      1 = print width by object
      3 = print width by parent

Returns: number: If source is not specified, the object's current print width source
number: If source is specified, the object's previous print width source
number: If object_ids is a list or tuple, the number of objects modified

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select objects to reset print width source")
if objects:
    for obj in objects: rs.ObjectPrintWidthSource(obj,0)
```

See also: ObjectPrintColor

## ObjectType

```python
rs.ObjectType(object_id)
```

Returns the object type

Arguments:

    object_id (guid): identifier of an object

Returns: number: The object type if successful.
  The valid object types are as follows:
  Value   Description
    0           Unknown object
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
    134217728   Cage
    268435456   Phantom
    536870912   Clipping plane
    1073741824  Extrusion

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    objtype = rs.ObjectType(obj)
    print("Object type:{}".format(objtype))
```

See also: ObjectsByType

## OrientObject

```python
rs.OrientObject(object_id, reference, target, flags=0)
```

Orients a single object based on input points.  

    If two 3-D points are specified, then this method will function similar to Rhino's Orient command.  If more than two 3-D points are specified, then the function will orient similar to Rhino's Orient3Pt command.

    The orient flags values can be added together to specify multiple options.
        Value   Description
        1       Copy object.  The default is not to copy the object.
        2       Scale object.  The default is not to scale the object.  Note, the scale option only applies if both reference and target contain only two 3-D points.

Arguments:

    object_id (guid): The identifier of an object
    reference ([point, point, ...]): list of 3-D reference points.
    target  ([point, point, ...]): list of 3-D target points
    flags (number):  1 = copy object
                     2 = scale object
                     3 = copy and scale

Returns: guid: The identifier of the oriented object if successful.

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to orient")
if obj:
    reference = rs.GetPoints(message1="First reference point")
    if reference and len(reference)>0:
        target = rs.GetPoints(message1="First target point")
        if target and len(target)>0:
            rs.OrientObject( obj, reference, target )
```

## RotateObject

```python
rs.RotateObject(object_id, center_point, rotation_angle, axis=None, copy=False)
```

Rotates a single object

Arguments:

    object_id (guid): The identifier of an object to rotate
    center_point (point): the center of rotation
    rotation_angle (number): in degrees
    axis (plane, optional): axis of rotation, If omitted, the Z axis of the active
      construction plane is used as the rotation axis
    copy (bool, optional): copy the object

Returns: guid: Identifier of the rotated object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to rotate")
if obj:
    point = rs.GetPoint("Center point of rotation")
    if point: rs.RotateObject(obj, point, 45.0, None, copy=True)
```

See also: RotateObjects

## RotateObjects

```python
rs.RotateObjects( object_ids, center_point, rotation_angle, axis=None, copy=False)
```

Rotates multiple objects

Arguments:

    object_ids ([guid, ...]): Identifiers of objects to rotate
    center_point (point): the center of rotation
    rotation_angle (number): in degrees
    axis (plane, optional): axis of rotation, If omitted, the Z axis of the active
      construction plane is used as the rotation axis
    copy (bool, optional): copy the object

Returns: list(guid, ...): identifiers of the rotated objects if successful

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to rotate")
if objs:
    point = rs.GetPoint("Center point of rotation")
    if point:
        rs.RotateObjects( objs, point, 45.0, None, True )
```

See also: RotateObject

## ScaleObject

```python
rs.ScaleObject(object_id, origin, scale, copy=False)
```

Scales a single object. Can be used to perform a uniform or non-uniform
    scale transformation. Scaling is based on the active construction plane.

Arguments:

    object_id (guid): The identifier of an object
    origin (point): the origin of the scale transformation
    scale ([number, number, number]): three numbers that identify the X, Y, and Z axis scale factors to apply
    copy (bool, optional): copy the object

Returns: guid: Identifier of the scaled object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to scale")
if obj:
    origin = rs.GetPoint("Origin point")
    if origin:
        rs.ScaleObject( obj, origin, (1,2,3), True )
```

See also: ScaleObjects

## ScaleObjects

```python
rs.ScaleObjects(object_ids, origin, scale, copy=False)
```

Scales one or more objects. Can be used to perform a uniform or non-
    uniform scale transformation. Scaling is based on the active construction plane.

Arguments:

    object_ids ([guid, ...]): Identifiers of objects to scale
    origin (point): the origin of the scale transformation
    scale ([number, number, number]): three numbers that identify the X, Y, and Z axis scale factors to apply
    copy (bool, optional): copy the objects

Returns: list(guid, ...): identifiers of the scaled objects if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to scale")
if objs:
    origin = rs.GetPoint("Origin point")
    if origin:
        rs.ScaleObjects( objs, origin, (2,2,2), True )
```

See also: ScaleObject

## SelectObject

```python
rs.SelectObject(object_id, redraw=True)
```

Selects a single object

Arguments:

    object_id (guid): the identifier of the object to select

Returns: bool: True on success

Example:

```python
import rhinoscriptsyntax as rs
rs.Command( "Line 0,0,0 5,5,0" )
id = rs.FirstObject()
if id: rs.SelectObject(id)
# Do something here...
rs.UnselectObject(id)
```

See also: IsObjectSelectable, IsObjectSelected, SelectObjects, UnselectObject, UnselectObjects

## SelectObjects

```python
rs.SelectObjects( object_ids)
```

Selects one or more objects

Arguments:

    object_ids ([guid, ...]): identifiers of the objects to select

Returns: number: number of selected objects

Example:

```python
import rhinoscriptsyntax as rs
ids = rs.GetObjects("Select object to copy in-place")
if ids:
    rs.UnselectObjects(ids)
    copies = rs.CopyObjects(ids)
    if copies: rs.SelectObjects(copies)
```

See also: IsObjectSelectable, IsObjectSelected, SelectObject, UnselectObject, UnselectObjects

## ShearObject

```python
rs.ShearObject(object_id, origin, reference_point, angle_degrees, copy=False)
```

Perform a shear transformation on a single object

Arguments:

    object_id (guid, ...): The identifier of an object
    origin, reference_point (point) origin/reference point of the shear transformation
    copy (bool, optional): copy the objects

Returns: guid: Identifier of the sheared object if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to shear")
if obj:
    origin = rs.GetPoint("Origin point")
    refpt = rs.GetPoint("Reference point")
    if origin and refpt:
        rs.ShearObject(obj, origin, refpt, 45.0, True)
```

See also: ShearObjects

## ShearObjects

```python
rs.ShearObjects(object_ids, origin, reference_point, angle_degrees, copy=False)
```

Shears one or more objects

Arguments:

    object_ids ([guid, ...]): The identifiers objects to shear
    origin, reference_point (point): origin/reference point of the shear transformation
    copy (bool, optional): copy the objects

Returns: list(guid, ...]): identifiers of the sheared objects if successful

Example:

```python
import rhinoscriptsyntax as rs
object_ids = rs.GetObjects("Select objects to shear")
if object_ids:
    origin = rs.GetPoint("Origin point")
    refpt = rs.GetPoint("Reference point")
    if origin and refpt:
        rs.ShearObjects( object_ids, origin, refpt, 45.0, True )
```

See also: ShearObject

## ShowObject

```python
rs.ShowObject(object_id)
```

Shows a previously hidden object. Hidden objects are not visible, cannot
    be snapped to and cannot be selected

Arguments:

    object_id (guid): representing id of object to show

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to hide")
if obj: rs.HideObject(obj)
# Do something here...
rs.ShowObject( obj )
```

See also: HideObject, HideObjects, IsObjectHidden, ShowObjects

## ShowObjects

```python
rs.ShowObjects(object_ids)
```

Shows one or more objects. Hidden objects are not visible, cannot be
    snapped to and cannot be selected

Arguments:

    object_ids ([guid, ...]): ids of objects to show

Returns: number: Number of objects shown

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to hide")
if objs: rs.HideObjects(objs)
#Do something here...
rs.ShowObjects( objs )
```

See also: HideObject, HideObjects, IsObjectHidden, ShowObject

## TransformObject

```python
rs.TransformObject(object_id, matrix, copy=False)
```

Moves, scales, or rotates an object given a 4x4 transformation matrix.
    The matrix acts on the left.

Arguments:

    object (guid): The identifier of the object.
    matrix (transform): The transformation matrix (4x4 array of numbers).
    copy (bool, optional): Copy the object.

Returns: (guid): The identifier of the transformed object
None: if not successful, or on error

Example:

```python
# Rotate an object by theta degrees about the world Z axis
import math
import rhinoscriptsyntax as rs
degrees = 90.0 # Some angle
radians = math.radians(degrees)
c = math.cos(radians)
s = math.sin(radians)
matrix = []
matrix.append( [c,-s, 0, 0] )
matrix.append( [s, c, 0, 0] )
matrix.append( [0, 0, 1, 0] )
matrix.append( [0, 0, 0, 1] )
obj = rs.GetObject("Select object to rotate")
if obj: rs.TransformObject( obj, matrix )
```

See also: TransformObjects

## TransformObjects

```python
rs.TransformObjects(object_ids, matrix, copy=False)
```

Moves, scales, or rotates a list of objects given a 4x4 transformation
    matrix. The matrix acts on the left.

Arguments:

    object_ids [(guid, ...}): List of object identifiers.
    matrix (transform): The transformation matrix (4x4 array of numbers).
    copy (bool, optional): Copy the objects

Returns: list(guid, ...): ids identifying the newly transformed objects

Example:

```python
import rhinoscriptsyntax as rs
# Translate (move) objects by (10,10,0)
xform = rs.XformTranslation([10,10,0])
objs = rs.GetObjects("Select objects to translate")
if objs: rs.TransformObjects(objs, xform)
```

See also: TransformObject

## UnlockObject

```python
rs.UnlockObject(object_id)
```

Unlocks an object. Locked objects are visible, and can be snapped to,
    but they cannot be selected.

Arguments:

    object_id (guid): The identifier of an object

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object to lock")
if obj: rs.LockObject(obj)
#Do something here...
rs.UnlockObject( obj )
```

See also: IsObjectLocked, LockObject, LockObjects, UnlockObjects

## UnlockObjects

```python
rs.UnlockObjects(object_ids)
```

Unlocks one or more objects. Locked objects are visible, and can be
    snapped to, but they cannot be selected.

Arguments:

    object_ids ([guid, ...]): The identifiers of objects

Returns: number: number of objects unlocked

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select objects to lock")
if objs: rs.LockObjects(objs)
#Do something here...
rs.UnlockObjects( objs )
```

See also: IsObjectLocked, LockObject, LockObjects, UnlockObject

## UnselectObject

```python
rs.UnselectObject(object_id)
```

Unselects a single selected object

Arguments:

    object_id: (guid): id of object to unselect

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
rs.Command("Line 0,0,0 5,5,0")
obj = rs.FirstObject()
if obj: rs.SelectObject(obj)
#Do something here...
rs.UnselectObject( obj )
```

See also: IsObjectSelected, SelectObject, SelectObjects, UnselectObjects

## UnselectObjects

```python
rs.UnselectObjects(object_ids)
```

Unselects one or more selected objects.

Arguments:

    object_ids ([guid, ...]): identifiers of the objects to unselect.

Returns: number: The number of objects unselected

Example:

```python
import rhinoscriptsyntax as rs
objects = rs.GetObjects("Select object to copy in-place")
if objects:
    rs.UnselectObjects(objects)
    copies= rs.CopyObjects(objects)
    if copies: rs.SelectObjects(copies)
```

See also: IsObjectSelected, SelectObject, SelectObjects, UnselectObject
