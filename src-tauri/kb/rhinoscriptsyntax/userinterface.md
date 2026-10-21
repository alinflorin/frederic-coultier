# rhinoscriptsyntax: userinterface

## BrowseForFolder

```python
rs.BrowseForFolder(folder=None, message=None, title=None)
```

Display browse-for-folder dialog allowing the user to select a folder

Arguments:

    folder (str, optional): a default folder
    message (str, optional): a prompt or message
    title (str, optional): a dialog box title

Returns: str: selected folder
None: on error

Example:

```python
import rhinoscriptsyntax as rs
folder = rs.BrowseForFolder("C:\\Program Files\\" )
if folder: print(folder)
```

See also: OpenFileName, SaveFileName

## CheckListBox

```python
rs.CheckListBox(items, message=None, title=None)
```

Displays a list of items in a checkable-style list dialog box

Arguments:

    items ([[str, bool], ...]): a list of tuples containing a string and a boolean check state
    message (str, optional):  a prompt or message
    title (str, optional):  a dialog box title

Returns: list((str, bool), ...): of tuples containing the input string in items along with their new boolean check value
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
layers = rs.LayerNames()
if layers:
    items  = [(layer, rs.IsLayerOn(layer)) for layer in layers]
    results  = rs.CheckListBox(items, "Turn layers on/off", "Layers")
    if results:
        for  layer, state in results: rs.LayerVisible(layer, state)
```

See also: ComboListBox, ListBox, MultiListBox, PropertyListBox

## ComboListBox

```python
rs.ComboListBox(items, message=None, title=None)
```

Displays a list of items in a combo-style list box dialog.

Arguments:

    items ([str, ...]): a list of string
    message (str, optional):  a prompt of message
    title (str, optional):  a dialog box title

Returns: str: The selected item if successful
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    layer = rs.ComboListBox(layers, "Select current layer")
    if layer: rs.CurrentLayer(layer)
```

See also: CheckListBox, ListBox, MultiListBox, PropertyListBox

## EditBox

```python
rs.EditBox(default_string=None, message=None, title=None)
```

Display dialog prompting the user to enter a string. The
    string value may span multiple lines

Arguments:

    default_string  (str, optional):  a default string value.
    message (str, optional): a prompt message.
    title (str, optional): a dialog box title.

Returns: str: Multiple lines that are separated by carriage return-linefeed combinations if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
text = rs.EditBox(message="Enter some text")
print(text)
```

See also: GetString, StringBox

## GetAngle

```python
rs.GetAngle(point=None, reference_point=None, default_angle_degrees=0, message=None)
```

Pause for user input of an angle

Arguments:

    point (point): starting, or base point
    reference_point (point, optional): if specified, the reference angle is calculated
      from it and the base point
    default_angle_degrees (number, optional): a default angle value specified
    message (str, optional): a prompt to display

Returns: number: angle in degree if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
point = rs.GetPoint("Base point")
if point:
    reference = rs.GetPoint("Reference point", point)
    if reference:
        angle = rs.GetAngle(point, reference)
        if angle!=None: print("Angle:{}".format(angle))
```

See also: GetDistance

## GetBoolean

```python
rs.GetBoolean(message, items, defaults)
```

Pauses for user input of one or more boolean values. Boolean values are
    displayed as click-able command line option toggles

Arguments:

    message (str): a prompt
    items ([str, str, str], ...): list or tuple of options. Each option is a tuple of three strings
      [n][1]    description of the boolean value. Must only consist of letters
                and numbers. (no characters like space, period, or dash
      [n][2]    string identifying the false value
      [n][3]    string identifying the true value
    defaults ([bool, ...]): list of boolean values used as default or starting values

Returns: list(bool, ...): a list of values that represent the boolean values if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
items = ("Lights", "Off", "On"), ("Cameras", "Disabled", "Enabled"), ("Action", "False", "True")
results = rs.GetBoolean("Boolean options", items, (True, True, True) )
if results:
    for val in results: print(val)
```

See also: GetString

## GetBox

```python
rs.GetBox(mode=0, base_point=None, prompt1=None, prompt2=None, prompt3=None)
```

Pauses for user input of a box

Arguments:

    mode (number): The box selection mode.
       0 = All modes
       1 = Corner. The base rectangle is created by picking two corner points
       2 = 3-Point. The base rectangle is created by picking three points
       3 = Vertical. The base vertical rectangle is created by picking three points.
       4 = Center. The base rectangle is created by picking a center point and a corner point
    base_point (point, optional): optional 3D base point
    prompt1, prompt2, prompt3 (str, optional): optional prompts to set

Returns: list(point, ...): list of eight Point3d that define the corners of the box on success
None: is not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
box = rs.GetBox()
if box:
    for i, pt in enumerate(box): rs.AddTextDot( i, pt )
```

See also: GetRectangle

## GetColor

```python
rs.GetColor(color=[0,0,0])
```

Display the Rhino color picker dialog allowing the user to select an RGB color

Arguments:

    color (color, optional): default RGB value. If omitted, the default color is black

Returns: color: RGB tuple of three numbers on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
color = rs.LayerColor("Default")
rgb = rs.GetColor(color)
if rgb: rs.LayerColor("Default", rgb)
```

## GetCursorPos

```python
rs.GetCursorPos()
```

Retrieves the cursor's position

Returns: tuple(point, point, guid, point) containing the following information
  [0]  cursor position in world coordinates
  [1]  cursor position in screen coordinates
  [2]  id of the active viewport
  [3]  cursor position in client coordinates

Example:

```python
import rhinoscriptsyntax as  rs
world, screen, view, client  = rs.GetCursorPos()
```

See also: XformScreenToWorld, XformWorldToScreen

## GetDistance

```python
rs.GetDistance(first_pt=None, distance=None, first_pt_msg='First distance point', second_pt_msg='Second distance point')
```

Pauses for user input of a distance.

Arguments:

    first_pt (point, optional): First distance point
    distance (number, optional): Default distance
    first_pt_msg (str, optional): Prompt for the first distance point
    second_pt_msg (str, optional): Prompt for the second distance point

Returns: number: The distance between the two points if successful.
None: if not successful, or on error.

Example:

```python
import rhinoscriptsyntax as  rs
dist = rs.GetDistance()
if dist:
    print(dist)
```

See also: GetAngle

## GetEdgeCurves

```python
rs.GetEdgeCurves(message=None, min_count=1, max_count=0, select=False)
```

Prompt the user to pick one or more surface or polysurface edge curves

Arguments:

    message  (str, optional):  A prompt or message.
    min_count (number, optional): minimum number of edges to select.
    max_count (number, optional): maximum number of edges to select.
    select (bool, optional): Select the duplicated edge curves.

Returns: list(tuple[guid, point, point], ...): of selection prompts (curve id, parent id, selection point)
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
edges = rs.GetEdgeCurves()
if edges:
    for edgeinfo in edges:
        print("Curve Id ={}".format(edgeinfo[0]))
        print("Parent Id ={}".format(edgeinfo[1]))
        print("Pick point ={}".format(edgeinfo[2]))
```

See also: DuplicateEdgeCurves

## GetInteger

```python
rs.GetInteger(message=None, number=None, minimum=None, maximum=None)
```

Pauses for user input of a whole number.

Arguments:

    message (str, optional): A prompt or message.
    number (number, optional): A default whole number value.
    minimum (number, optional): A minimum allowable value.
    maximum (number, optional): A maximum allowable value.

Returns: number: The whole number input by the user if successful.
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
color = rs.LayerColor("Default")
color = rs.GetInteger("Enter an RGB color value", color.ToArgb(), 0)
if color: rs.LayerColor("Default", color)
```

## GetLayer

```python
rs.GetLayer(title="Select Layer", layer=None, show_new_button=False, show_set_current=False)
```

Displays dialog box prompting the user to select a layer

Arguments:

    title (str, optional): dialog box title
    layer (str, optional): name of a layer to preselect. If omitted, the current layer will be preselected
    show_new_button, show_set_current (bool, optional): Optional buttons to show on the dialog

Returns: str: name of selected layer if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Select object")
if obj:
    layer = rs.GetLayer("Select Layer", rs.ObjectLayer(obj), True, True)
    if layer: rs.ObjectLayer( obj, layer )
```

## GetLayers

```python
rs.GetLayers(title="Select Layers", show_new_button=False)
```

Displays a dialog box prompting the user to select one or more layers

Arguments:

    title (str, optional):  dialog box title
    show_new_button (bool, optional): Optional button to show on the dialog

Returns: str: The names of selected layers if successful

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.GetLayers("Select Layers")
if layers:
    for layer in layers: print(layer)
```

See also: GetLayer

## GetLine

```python
rs.GetLine(mode=0, point=None, message1=None, message2=None, message3=None)
```

Prompts the user to pick points that define a line

Arguments:

    mode (number, optional): line definition mode.
      0  Default - Show all modes, start in two-point mode
      1  Two-point - Defines a line from two points.
      2  Normal - Defines a line normal to a location on a surface.
      3  Angled - Defines a line at a specified angle from a reference line.
      4  Vertical - Defines a line vertical to the construction plane.
      5  Four-point - Defines a line using two points to establish direction and two points to establish length.
      6  Bisector - Defines a line that bisects a specified angle.
      7  Perpendicular - Defines a line perpendicular to or from a curve
      8  Tangent - Defines a line tangent from a curve.
      9  Extension - Defines a line that extends from a curve.
    point (point, optional): optional starting point
    message1, message2, message3 (str, optional): optional prompts

Returns: line: Tuple of two points on success
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
line = rs.GetLine()
if line: rs.AddLine( line[0],  line[1] )
```

See also: GetBox, GetPoint, GetPolyline, GetRectangle

## GetLinetype

```python
rs.GetLinetype(default_linetype=None, show_by_layer=False)
```

Displays a dialog box prompting the user to select one linetype

Arguments:

    default_linetype (str, optional):  Optional. The name of the linetype to select. If omitted, the current linetype will be selected.
    show_by_layer (bool, optional): If True, the "by Layer" linetype will show. Defaults to False.

Returns: str: The names of selected linetype if successful

Example:

```python
import rhinoscriptsyntax as rs
linetype = rs.GetLinetype()
if linetype: print(linetype)
```

See also: GetLayer

## GetMeshFaces

```python
rs.GetMeshFaces(object_id, message="", min_count=1, max_count=0)
```

Prompts the user to pick one or more mesh faces

Arguments:

    object_id (guid): the mesh object's identifier
    message (str, optional): a prompt of message
    min_count (number, optional): the minimum number of faces to select
    max_count (number, optional): the maximum number of faces to select.
      If 0, the user must press enter to finish selection.
      If -1, selection stops as soon as there are at least min_count faces selected.

Returns: list(number, ...): of mesh face indices on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh", rs.filter.mesh)
if mesh:
    indices = rs.GetMeshFaces(mesh)
    if indices:
        for index in indices: print(index)
```

See also: GetMeshVertices, MeshFaces, MeshFaceVertices, MeshVertices

## GetMeshVertices

```python
rs.GetMeshVertices(object_id, message="", min_count=1, max_count=0)
```

Prompts the user to pick one or more mesh vertices

Arguments:

    object_id (guid): the mesh object's identifier
    message (str, optional): a prompt of message
    min_count (number, optional): the minimum number of vertices to select
    max_count (number, optional): the maximum number of vertices to select. If 0, the user must
      press enter to finish selection. If -1, selection stops as soon as there
      are at least min_count vertices selected.

Returns: list(number, ...): of mesh vertex indices on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Select mesh", rs.filter.mesh)
if mesh:
    indices = rs.GetMeshVertices(mesh)
    if indices:
        for index in indices: print(index)
```

See also: GetMeshFaces, MeshFaces, MeshFaceVertices, MeshVertices

## GetPoint

```python
rs.GetPoint(message=None, base_point=None, distance=None, in_plane=False)
```

Pauses for user input of a point.

Arguments:

    message (str, optional): A prompt or message.
    base_point (point, optional): list of 3 numbers or Point3d identifying a starting, or base point
    distance  (number, optional): constraining distance. If distance is specified, basePoint must also be specified.
    in_plane (bool, optional): constrains the point selections to the active construction plane.

Returns: point: point on success
None: if no point picked or user canceled

Example:

```python
import rhinoscriptsyntax as rs
point1 = rs.GetPoint("Pick first point")
if point1:
    rs.AddPoint(point1)
    point2 = rs.GetPoint("Pick second point", point1)
    if point2:
        rs.AddPoint(point2)
        distance = (point1-point2).Length
        point3 = rs.GetPoint("Pick third point", point2, distance)
        if point3: rs.AddPoint(point3)
```

See also: GetPointOnCurve, GetPointOnSurface, GetPoints, GetRectangle

## GetPointOnCurve

```python
rs.GetPointOnCurve(curve_id, message=None)
```

Pauses for user input of a point constrainted to a curve object

Arguments:

    curve_id (guid): identifier of the curve to get a point on
    message (str, optional): a prompt of message

Returns: point: 3d point if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject("Pick a curve")
if rs.IsCurve(obj):
    point = rs.GetPointOnCurve(obj, "Point on curve")
    if point: rs.AddPoint(point)
```

See also: GetPoint, GetPointOnMesh, GetPointOnSurface, GetPoints

## GetPointOnMesh

```python
rs.GetPointOnMesh(mesh_id, message=None)
```

Pauses for user input of a point constrained to a mesh object

Arguments:

    mesh_id (guid): identifier of the mesh to get a point on
    message (str, optional): a prompt or message

Returns: point: 3d point if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
mesh = rs.GetObject("Pick a mesh", rs.filter.mesh)
if mesh:
    point = rs.GetPointOnMesh(mesh, "Point on mesh")
    if point: rs.AddPoint( point )
```

See also: GetPoint, GetPointOnCurve, GetPointOnSurface, GetPoints

## GetPointOnSurface

```python
rs.GetPointOnSurface(surface_id, message=None)
```

Pauses for user input of a point constrained to a surface or polysurface
    object

Arguments:

    surface_id (guid): identifier of the surface to get a point on
    message (str, optional): a prompt or message

Returns: point: 3d point if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
surface = rs.GetObject("Pick a surface")
if surface:
    point = rs.GetPointOnSurface(surface, "Point on surface")
    if point: rs.AddPoint(point)
```

See also: GetPoint, GetPointOnCurve, GetPointOnMesh, GetPoints

## GetPoints

```python
rs.GetPoints(draw_lines=False, in_plane=False, message1=None, message2=None, max_points=None, base_point=None)
```

Pauses for user input of one or more points

Arguments:

    draw_lines (bool, optional): Draw lines between points
    in_plane (bool, optional): Constrain point selection to the active construction plane
    message1 (str, optional): A prompt or message for the first point
    message2 (str, optional): A prompt or message for the next points
    max_points (number, optional): maximum number of points to pick. If not specified, an
                      unlimited number of points can be picked.
    base_point (point, optional): a starting or base point

Returns: list(point, ...): of 3d points if successful
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
points = rs.GetPoints(True)
if points: rs.AddPointCloud(points)
```

See also: GetPoint, GetPointOnCurve, GetPointOnSurface, GetRectangle

## GetPolyline

```python
rs.GetPolyline(flags=3, message1=None, message2=None, message3=None, message4=None, min=2, max=0)
```

Prompts the user to pick points that define a polyline.

Arguments:

    flags (number, optional) The options are bit coded flags. Values can be added together to specify more than one option. The default is 3.
      value description
      1     Permit close option. If specified, then after 3 points have been picked, the user can type "Close" and a closed polyline will be returned.
      2     Permit close snap. If specified, then after 3 points have been picked, the user can pick near the start point and a closed polyline will be returned.
      4     Force close. If specified, then the returned polyline is always closed. If specified, then intMax must be 0 or >= 4.
      Note: the default is 3, or "Permit close option = True", "Permit close snap = True", and "Force close = False".
    message1 (str, optional): A prompt or message for the first point.
    message2 (str, optional): A prompt or message for the second point.
    message3 (str, optional): A prompt or message for the third point.
    message4 (str, optional): A prompt or message for the 'next' point.
    min (number, optional): The minimum number of points to require. The default is 2.
    max (number, optional): The maximum number of points to require; 0 for no limit.  The default is 0.

Returns: list(point, ...): A list of 3-D points that define the polyline if successful.
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
from scriptcontext import doc
arr = rs.GetPolyline()
if arr is not None:
    doc.AddPolyline(arr)
```

See also: GetBox, GetLine, GetRectangle

## GetReal

```python
rs.GetReal(message="Number", number=None, minimum=None, maximum=None)
```

Pauses for user input of a number.

Arguments:

    message (str, optional): A prompt or message.
    number (number, optional): A default number value.
    minimum (number, optional): A minimum allowable value.
    maximum (number, optional): A maximum allowable value.

Returns: number: The number input by the user if successful.
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
radius = rs.GetReal("Radius of new circle", 3.14, 1.0)
if radius: rs.AddCircle( (0,0,0), radius )
```

See also: RealBox

## GetRectangle

```python
rs.GetRectangle(mode=0, base_point=None, prompt1=None, prompt2=None, prompt3=None)
```

Pauses for user input of a rectangle

Arguments:

    mode (number, optional): The rectangle selection mode. The modes are as follows
        0 = All modes
        1 = Corner - a rectangle is created by picking two corner points
        2 = 3Point - a rectangle is created by picking three points
        3 = Vertical - a vertical rectangle is created by picking three points
        4 = Center - a rectangle is created by picking a center point and a corner point
    base_point (point, optional): a 3d base point
    prompt1, prompt2, prompt3 (str, optional): optional prompts

Returns: tuple(point, point, point, point): four 3d points that define the corners of the rectangle
None: on error

Example:

```python
import rhinoscriptsyntax as rs
rect = rs.GetRectangle()
if rect:
    for i, corner in enumerate(rect):
        rs.AddTextDot( i, corner )
```

See also: GetPoint, GetPoints

## GetString

```python
rs.GetString(message=None, defaultString=None, strings=None)
```

Pauses for user input of a string value

Arguments:

    message (str, optional): a prompt or message
    defaultString (str, optional): a default value
    strings ([str, ...], optional): list of strings to be displayed as a click-able command options.
                                    Note, strings cannot begin with a numeric character

Returns: str: The string either input or selected by the user if successful.
     If the user presses the Enter key without typing in a string, an empty string "" is returned.
None: if not successful, on error, or if the user pressed cancel.

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.CurrentLayer()
layer = rs.GetString("Layer to set current", layer)
if layer: rs.CurrentLayer(layer)
```

See also: GetBoolean, StringBox

## ListBox

```python
rs.ListBox(items, message=None, title=None, default=None)
```

Display a list of items in a list box dialog.

Arguments:

    items ([str, ...]): a list of values to select
    message (str, optional): a prompt of message
    title (str, optional): a dialog box title
    default (str, optional): selected item in the list

Returns: str: he selected item if successful
None: if not successful or on error

Example:

```python
import rhinoscriptsyntax as rs
layers = rs.LayerNames()
if layers:
    result = rs.ListBox(layers, "Layer to set current")
    if result: rs.CurrentLayer( result )
```

See also: CheckListBox, ComboListBox, MultiListBox, PropertyListBox

## MessageBox

```python
rs.MessageBox(message, buttons=0, title="")
```

Displays a message box. A message box contains a message and
    title, plus any combination of predefined icons and push buttons.

Arguments:

    message (str): A prompt or message.
    buttons (number, optional): buttons and icon to display as a bit coded flag. Can be a combination of the
      following flags. If omitted, an OK button and no icon is displayed
      0      Display OK button only.
      1      Display OK and Cancel buttons.
      2      Display Abort, Retry, and Ignore buttons.
      3      Display Yes, No, and Cancel buttons.
      4      Display Yes and No buttons.
      5      Display Retry and Cancel buttons.
      16     Display Critical Message icon.
      32     Display Warning Query icon.
      48     Display Warning Message icon.
      64     Display Information Message icon.
      0      First button is the default.
      256    Second button is the default.
      512    Third button is the default.
      768    Fourth button is the default.
      0      Application modal. The user must respond to the message box
             before continuing work in the current application.
      4096   System modal. The user must respond to the message box
             before continuing work in any application.
    title(str, optional): the dialog box title

Returns: number: indicating which button was clicked:
  1      OK button was clicked.
  2      Cancel button was clicked.
  3      Abort button was clicked.
  4      Retry button was clicked.
  5      Ignore button was clicked.
  6      Yes button was clicked.
  7      No button was clicked.

Example:

```python
import rhinoscriptsyntax as rs
rs.MessageBox("Hello Rhino!")
rs.MessageBox("Hello Rhino!", 4 | 32)
rs.MessageBox("Hello Rhino!", 2 | 48)
```

## MultiListBox

```python
rs.MultiListBox(items, message=None, title=None, defaults=None)
```

Displays a list of items in a multiple-selection list box dialog

Arguments:

    items ([str, ...]) a zero-based list of string items
    message (str, optional): a prompt or message
    title (str, optional): a dialog box title
    defaults (str|[str,...], optional): either a string representing the pre-selected item in the list
                                        or a list if multiple items are pre-selected

Returns: list(str, ...): containing the selected items if successful
None: on error

Example:

```python
import rhinoscriptsyntax as  rs
layers = rs.LayerNames()
if layers:
    layers  = rs.MultiListBox(layers, "Layers to lock")
if layers:
    for  layer in layers:
        rs.LayerLocked(layer,  True)
```

See also: CheckListBox, ComboListBox, ListBox, PropertyListBox

## OpenFileName

```python
rs.OpenFileName(title=None, filter=None, folder=None, filename=None, extension=None)
```

Displays file open dialog box allowing the user to enter a file name.
    Note, this function does not open the file.

Arguments:

    title (str, optional): A dialog box title.
    filter (str, optional): A filter string. The filter must be in the following form:
      "Description1|Filter1|Description2|Filter2||", where "||" terminates filter string.
      If omitted, the filter (*.*) is used.
    folder (str, optional): A default folder.
    filename (str, optional): a default file name
    extension (str, optional): a default file extension

Returns: str: file name is successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
filename = rs.OpenFileName()
if filename: rs.MessageBox(filename)
filename = rs.OpenFileName("Open", "Text Files (*.txt)|*.txt||")
if filename: rs.MessageBox(filename)
filename = rs.OpenFileName("Open", "Text Files (*.txt)|*.txt|All Files (*.*)|*.*||")
if filename: rs.MessageBox(filename)
```

See also: BrowseForFolder, OpenFileNames, SaveFileName

## OpenFileNames

```python
rs.OpenFileNames(title=None, filter=None, folder=None, filename=None, extension=None)
```

Displays file open dialog box allowing the user to select one or more file names.
    Note, this function does not open the file.

Arguments:

    title (str, optional): A dialog box title.
    filter (str, optional): A filter string. The filter must be in the following form:
      "Description1|Filter1|Description2|Filter2||", where "||" terminates filter string.
      If omitted, the filter (*.*) is used.
    folder (str, optional): A default folder.
    filename (str, optional): a default file name
    extension (str, optional): a default file extension

Returns: list(str, ...): of selected file names

Example:

```python
import rhinoscriptsyntax as rs
filenames = rs.OpenFileNames("Open", "Text Files (*.txt)|*.txt|All Files (*.*)|*.*||")
for filename in filenames: print(filename)
```

See also: BrowseForFolder, OpenFileName, SaveFileName

## PopupMenu

```python
rs.PopupMenu(items, modes=None, point=None, view=None)
```

Display a context-style popup menu. The popup menu can appear almost
    anywhere, and can be dismissed by clicking the left or right mouse buttons

Arguments:

    items ([str, ...]): list of strings representing the menu items. An empty string or None
      will create a separator
    modes ([number, ...]): List of numbers identifying the display modes. If omitted, all
      modes are enabled.
        0 = menu item is enabled
        1 = menu item is disabled
        2 = menu item is checked
        3 = menu item is disabled and checked
    point (point, optional): a 3D point where the menu item will appear. If omitted, the menu
      will appear at the current cursor position
    view (str, optional): if point is specified, the view in which the point is computed.
      If omitted, the active view is used

Returns: number: index of the menu item picked or -1 if no menu item was picked

Example:

```python
import rhinoscriptsyntax as rs
items = "Line", "", "Circle", "Arc"
modes = 2,0,0,0
result = rs.PopupMenu(items, modes)
if result>=0: rs.MessageBox(items[result])
```

## PropertyListBox

```python
rs.PropertyListBox(items, values, message=None, title=None)
```

Displays list of items and their values in a property-style list box dialog

Arguments:

    items, values ([str, ...]): list of string items and their corresponding values
    message (str, optional): a prompt or message
    title (str, optional): a dialog box title

Returns: list(str, ..): of new values on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
objs = rs.GetObjects("Select Objects")
if objs:
    names = []
    for obj in objs:
        name = rs.ObjectName(obj)
        if name is None: name=""
        names.append(name)
    results = rs.PropertyListBox(objs, names, "Modify object name(s)")
    if results:
        for i in compat.RANGE(len(objs)):
            rs.ObjectName( objs[i], results[i] )
```

See also: CheckListBox, ComboListBox, ListBox, MultiListBox

## RealBox

```python
rs.RealBox(message="", default_number=None, title="", minimum=None, maximum=None)
```

Display a dialog box prompting the user to enter a number

Arguments:

    message (str, optional): a prompt message.
    default_number (number, optional):  a default number.
    title (str, optional):  a dialog box title.
    minimum (number, optional):  a minimum allowable value.
    maximum (number, optional):  a maximum allowable value.

Returns: number: The newly entered number on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
radius = rs.RealBox("Enter a radius value", 5.0 )
if radius:
    point = (0,0,0)
    rs.AddCircle( point, radius )
```

See also: GetReal

## SaveFileName

```python
rs.SaveFileName(title=None, filter=None, folder=None, filename=None, extension=None)
```

Display a save dialog box allowing the user to enter a file name.
    Note, this function does not save the file.

Arguments:

    title (str, optional): A dialog box title.
    filter(str, optional): A filter string. The filter must be in the following form:
      "Description1|Filter1|Description2|Filter2||", where "||" terminates filter string.
      If omitted, the filter (*.*) is used.
    folder (str, optional): A default folder.
    filename (str, optional): a default file name
    extension (str, optional):  a default file extension

Returns: str: the file name is successful
None: if not successful, or on error

Example:

```python
import rhinoscriptsyntax as rs
filename = rs.SaveFileName()
if filename: rs.MessageBox(filename)
filename = rs.SaveFileName ("Save", "Text Files (*.txt)|*.txt||")
if filename: rs.MessageBox(filename)
filename = rrshui.SaveFileName ("Save", "Text Files (*.txt)|*.txt|All Files (*.*)|*.*||")
if filename: rs.MessageBox(filename)
```

See also: BrowseForFolder, OpenFileName

## StringBox

```python
rs.StringBox(message=None, default_value=None, title=None)
```

Display a dialog box prompting the user to enter a string value.

Arguments:

    message (str, optional): a prompt message
    default_value (str, optional): a default string value
    title (str, optional): a dialog box title

Returns: str: the newly entered string value if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
layer = rs.StringBox("New layer name" )
if layer: rs.AddLayer( layer )
```

See also: GetString

## TextOut

```python
rs.TextOut(message=None, title=None)
```

Display a text dialog box similar to the one used by the _What command.

Arguments:

    message (str): a message
    title (str, optional): the message title

Returns: None: in any case

Example:

```python
import rhinoscriptsyntax as rs
rs.TextOut("This is a long string..." )
```

See also: MessagBox
