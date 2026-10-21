# rhinoscriptsyntax: layer

## AddLayer

```python
rs.AddLayer(name=None, color=None, visible=True, locked=False, parent=None)
```

Add a new layer to the document

Arguments:

    name (str, optional): The name of the new layer. If omitted, Rhino automatically
        generates the layer name.
    color (color): A Red-Green-Blue color value. If omitted, the color Black is assigned.
    visible (bool optional): layer's visibility
    locked (bool, optional): layer's locked state
    parent (str, optional): name of the new layer's parent layer. If omitted, the new
        layer will not have a parent layer.

Returns: str: The full name of the new layer if successful.

Example:

```python
import rhinoscriptsyntax as rs
from System.Drawing import Color
print("New layer:{}".format(rs.AddLayer()))
print("New layer:{}".format(rs.AddLayer("MyLayer1")))
print("New layer:{}".format(rs.AddLayer("MyLayer2", Color.DarkSeaGreen)))
print("New layer:{}".format(rs.AddLayer("MyLayer3", Color.Cornsilk)))
print("New layer:{}".format(rs.AddLayer("MyLayer4",parent="MyLayer3")))
```

See also: CurrentLayer, DeleteLayer, RenameLayer

## CurrentLayer

```python
rs.CurrentLayer(layer=None)
```

Returns or changes the current layer

Arguments:

    layer (guid): the name or Guid of an existing layer to make current

Returns: str: If a layer name is not specified, the full name of the current layer
str: If a layer name is specified, the full name of the previous current layer

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLayer("MyLayer")
rs.CurrentLayer("MyLayer")
```

See also: AddLayer, DeleteLayer, RenameLayer

## DeleteLayer

```python
rs.DeleteLayer(layer)
```

Removes an existing layer from the document. The layer to be removed
    cannot be the current layer. Unlike the PurgeLayer method, the layer must
    be empty, or contain no objects, before it can be removed. Any layers that
    are children of the specified layer will also be removed if they are also
    empty.

Arguments:

    layer (str|guid): the name or id of an existing empty layer

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer to remove")
if layer: rs.DeleteLayer(layer)
```

See also: AddLayer, CurrentLayer, PurgeLayer, RenameLayer

## ExpandLayer

```python
rs.ExpandLayer( layer, expand )
```

Expands a layer. Expanded layers can be viewed in Rhino's layer dialog

Arguments:

    layer (str): name of the layer to expand
    expand (bool): True to expand, False to collapse

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
if rs.IsLayerExpanded("Default"):
    rs.ExpandLayer( "Default", False )
```

See also: IsLayerExpanded

## IsLayer

```python
rs.IsLayer(layer)
```

Verifies the existance of a layer in the document

Arguments:

    layer (str|guid): the name or id of a layer to search for

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    print("The layer exists.")
else:
    print("The layer does not exist.")
```

See also: IsLayerChangeable, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerChangeable

```python
rs.IsLayerChangeable(layer)
```

Verifies that the objects on a layer can be changed (normal)

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerChangeable(layer): print("The layer is changeable.")
    else: print("The layer is not changeable.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerChildOf

```python
rs.IsLayerChildOf(layer, test)
```

Verifies that a layer is a child of another layer

Arguments:

    layer (str|guid): the name or id of the layer to test against
    test (str|guid): the name or id to the layer to test

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLayer("MyLayer1")
rs.AddLayer("MyLayer2", parent="MyLayer1")
rs.AddLayer("MyLayer3", parent="MyLayer2")
rs.MessageBox( rs.IsLayerChildOf("MyLayer1", "MyLayer3") )
```

See also: IsLayerParentOf

## IsLayerCurrent

```python
rs.IsLayerCurrent(layer)
```

Verifies that a layer is the current layer

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerCurrent(layer): print("The layer is current.")
    else: print("The layer is not current.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerEmpty

```python
rs.IsLayerEmpty(layer)
```

Verifies that an existing layer is empty, or contains no objects

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerEmpty(layer): print("The layer is empty.")
    else: print("The layer is not empty.")
else:
    print("The layer does not exist.")
```

See also: IsLayerChangeable, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerExpanded

```python
rs.IsLayerExpanded(layer)
```

Verifies that a layer is expanded. Expanded layers can be viewed in
    Rhino's layer dialog

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
if rs.IsLayerExpanded("Default"):
    rs.ExpandLayer( "Default", False )
```

See also: ExpandLayer

## IsLayerLocked

```python
rs.IsLayerLocked(layer)
```

Verifies that a layer is locked.

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: cool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerLocked(layer): print("The layer is locked.")
    else: print("The layer is not locked.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerChangeable, IsLayerEmpty, IsLayerOn, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerOn

```python
rs.IsLayerOn(layer)
```

Verifies that a layer is on.

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerOn(layer): print("The layer is on.")
    else: print("The layer is not on.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerChangeable, IsLayerEmpty, IsLayerLocked, IsLayerReference, IsLayerSelectable, IsLayerVisible

## IsLayerParentOf

```python
rs.IsLayerParentOf(layer, test)
```

Verifies that a layer is a parent of another layer

Arguments:

    layer (str|guid): the name or id of the layer to test against
    test (str|guid): the name or id to the layer to test

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLayer("MyLayer1")
rs.AddLayer("MyLayer2", parent="MyLayer1")
rs.AddLayer("MyLayer3", parent="MyLayer2")
rs.MessageBox( rs.IsLayerParentOf("MyLayer3", "MyLayer1") )
```

See also: IsLayerChildOf

## IsLayerReference

```python
rs.IsLayerReference(layer)
```

Verifies that a layer is from a reference file.

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerReference(layer): print("The layer is a reference layer.")
    else: print("The layer is not a reference layer.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerChangeable, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerSelectable, IsLayerVisible

## IsLayerSelectable

```python
rs.IsLayerSelectable(layer)
```

Verifies that an existing layer is selectable (normal and reference)

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerSelectable(layer): print("The layer is selectable.")
    else: print("The layer is not selectable.")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerChangeable, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerVisible

## IsLayerVisible

```python
rs.IsLayerVisible(layer)
```

Verifies that a layer is visible (normal, locked, and reference)

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: bool: True on success otherwise False

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer name")
if rs.IsLayer(layer):
    if rs.IsLayerVisible(layer): print("The layer is visible")
    else: print("The layer is not visible")
else:
    print("The layer does not exist.")
```

See also: IsLayer, IsLayerChangeable, IsLayerEmpty, IsLayerLocked, IsLayerOn, IsLayerReference, IsLayerSelectable

## LayerChildCount

```python
rs.LayerChildCount(layer)
```

Returns the number of immediate child layers of a layer

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: number: the number of immediate child layers if successful

Example:

```python
import rhinoscriptsyntax as rs
children = rs.LayerChildCount("Default")
if children: rs.ExpandLayer("Default", True)
```

See also: LayerChildren

## LayerChildren

```python
rs.LayerChildren(layer)
```

Returns the immediate child layers of a layer

Arguments:

    layer (str|guid): the name or id of an existing layer

Returns: list(str, ...): List of children layer names

Example:

```python
import rhinoscriptsyntax as rs
children = rs.LayerChildren("Default")
if children:
    for child in children: print(child)
```

See also: LayerChildCount, ParentLayer

## LayerColor

```python
rs.LayerColor(layer, color=None)
```

Returns or changes the color of a layer.

Arguments:

    layer (str|guid): name or id of an existing layer
    color (color): the new color value. If omitted, the current layer color is returned.

Returns: color: If a color value is not specified, the current color value on success
color: If a color value is specified, the previous color value on success

Example:

```python
import rhinoscriptsyntax as rs
import random
from System.Drawing import Color
       
def randomcolor():
    red = int(255*random.random())
    green = int(255*random.random())
    blue = int(255*random.random())
    return Color.FromArgb(red,green,blue)
       
layerNames = rs.LayerNames()
if layerNames:
    for name in layerNames: rs.LayerColor(name, randomcolor())
```

## LayerCount

```python
rs.LayerCount()
```

Returns the number of layers in the document

Returns: number: the number of layers in the document

Example:

```python
import rhinoscriptsyntax as rs
count = rs.LayerCount()
print("There are {} layers".format(count))
```

See also: LayerNames

## LayerId

```python
rs.LayerId(layer)
```

Returns the identifier of a layer given the layer's name.

Arguments:

    layer (str): name of existing layer

Returns: guid (str): The layer's identifier if successful.
None: If not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
id = rs.LayerId('Layer 01')
```

See also: LayerName

## LayerIds

```python
rs.LayerIds()
```

Return identifiers of all layers in the document

Returns: list(guid, ...): the identifiers of all layers in the document

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerIds()
for layer in layers: print(layer)
```

See also: LayerCount, LayerNames

## LayerLinetype

```python
rs.LayerLinetype(layer, linetype=None)
```

Returns or changes the linetype of a layer

Arguments:

    layer (str): name of an existing layer
    linetype (str, optional): name of a linetype

Returns: str: If linetype is not specified, name of the current linetype
str: If linetype is specified, name of the previous linetype

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers:
        if rs.LayerLinetype(layer)!="Continuous":
            rs.LayerLinetype(layer,"Continuous")
```

See also: LayerPrintColor, LayerPrintWidth

## LayerLocked

```python
rs.LayerLocked(layer, locked=None)
```

Returns or changes the locked mode of a layer

Arguments:

    layer (str): name of an existing layer
    locked (bool, optional): new layer locked mode

Returns: bool: If locked is not specified, the current layer locked mode
bool: If locked is specified, the previous layer locked mode

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers:
        if rs.LayerLocked(layer): rs.LayerLocked(layer, False)
```

See also: LayerVisible

## LayerMaterialIndex

```python
rs.LayerMaterialIndex(layer,index=None)
```

Returns or changes the material index of a layer. A material index of -1
    indicates that no material has been assigned to the layer. Thus, the layer
    will use Rhino's default layer material

Arguments:

    layer (str):  name of existing layer
    index (number, optional): the new material index

Returns: number: a zero-based material index if successful

Example:

```python
import rhinoscriptsyntax as rs
index = rs.LayerMaterialIndex("Default")
if index is not None:
    if index==-1:
        print("The default layer does not have a material assigned.")
    else:
        print("The default layer has a material assigned.")
```

## LayerName

```python
rs.LayerName(layer_id, fullpath=True)
```

Return the name of a layer given it's identifier

Arguments:

    layer_id (guid): layer identifier
    fullpath (bool, optional): return the full path name `True` or short name `False`

Returns: str: the layer's name if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerIds()
if layers:
    for layer in layers: print(rs.LayerName(layer))
```

See also: LayerId

## LayerNames

```python
rs.LayerNames(sort=False)
```

Returns the names of all layers in the document.

Arguments:

    sort (bool, optional): return a sorted list of the layer names

Returns: list(str, ...): list of layer names

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers: print(layer)
```

See also: LayerCount

## LayerOrder

```python
rs.LayerOrder(layer)
```

Returns the current display order index of a layer as displayed in Rhino's
    layer dialog box. A display order index of -1 indicates that the current
    layer dialog filter does not allow the layer to appear in the layer list

Arguments:

    layer (str): name of existing layer

Returns: number: 0 based index of layer

Example:

```python
import rhinoscriptsyntax as rs
index = rs.LayerOrder("Default")
if index is not None:
    if index==-1: print("The layer does not display in the Layer dialog.")
    else: print("The layer does display in the Layer dialog.")
```

## LayerPrintColor

```python
rs.LayerPrintColor(layer, color=None)
```

Returns or changes the print color of a layer. Layer print colors are
    represented as RGB colors.

Arguments:

    layer (str): name of existing layer
    color (color): new print color

Returns: color: if color is not specified, the current layer print color
color: if color is specified, the previous layer print color
None: on error

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers:
        black = rs.CreateColor((0,0,0))
        if rs.LayerPrintColor(layer)!=black:
            rs.LayerPrintColor(layer, black)
```

See also: LayerLinetype, LayerPrintWidth

## LayerPrintWidth

```python
rs.LayerPrintWidth(layer, width=None)
```

Returns or changes the print width of a layer. Print width is specified
    in millimeters. A print width of 0.0 denotes the "default" print width.

Arguments:

    layer (str): name of existing layer
    width (number, optional): new print width

Returns: number: if width is not specified, the current layer print width
number: if width is specified, the previous layer print width

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers:
        if rs.LayerPrintWidth(layer)!=0:
            rs.LayerPrintWidth(layer, 0)
```

See also: LayerLinetype, LayerPrintColor

## LayerVisible

```python
rs.LayerVisible(layer, visible=None, forcevisible_or_donotpersist=False)
```

Returns or changes the visible property of a layer.

Arguments:

    layer (str): name of existing layer
    visible (bool, optional): new visible state
    forcevisible_or_donotpersist (bool, optional): if visible is True then turn parent layers on if True.  If visible is False then do not persist if True

Returns: bool: if visible is not specified, the current layer visibility
bool: if visible is specified, the previous layer visibility

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    for layer in layers:
        if rs.LayerVisible(layer)==False:
            rs.LayerVisible(layer,True)
```

See also: LayerLocked

## ParentLayer

```python
rs.ParentLayer(layer, parent=None)
```

Return or modify the parent layer of a layer

Arguments:

    layer (str): name of an existing layer
    parent (str, optional):  name of new parent layer. To remove the parent layer,
      thus making a root-level layer, specify an empty string

Returns: str: If parent is not specified, the name of the current parent layer
str: If parent is specified, the name of the previous parent layer
None: if the layer does not have a parent

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
for layer in layers:
    parent = rs.ParentLayer(layer)
    print("Layer: {}, Parent: {}".format(layer, parent))
```

See also: LayerChildren

## PurgeLayer

```python
rs.PurgeLayer(layer)
```

Removes an existing layer from the document. The layer will be removed
    even if it contains geometry objects. The layer to be removed cannot be the
    current layer
    empty.

Arguments:

    layer (str|guid): the name or id of an existing empty layer

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.GetString("Layer to purge")
if layer: rs.PurgeLayer(layer)
```

See also: AddLayer, CurrentLayer, DeleteLayer, RenameLayer

## RenameLayer

```python
rs.RenameLayer(oldname, newname)
```

Renames an existing layer

Arguments:

    oldname (str): original layer name
    newname (str): new layer name

Returns: str: The new layer name if successful otherwise None

Example:

```python
import rhinoscriptsyntax as rs
oldname = rs.GetString("Old layer name")
if oldname:
    newname = rs.GetString("New layer name")
    if newname: rs.RenameLayer(oldname, newname)
```

See also: AddLayer, CurrentLayer, DeleteLayer
