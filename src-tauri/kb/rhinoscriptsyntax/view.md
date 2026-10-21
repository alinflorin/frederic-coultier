# rhinoscriptsyntax: view

## AddDetail

```python
rs.AddDetail(layout_id, corner1, corner2, title=None, projection=1)
```

Add new detail view to an existing layout view

Arguments:

    layout_id (guid): identifier of an existing layout
    corner1, corner2 (point): 2d corners of the detail in the layout's unit system
    title (str, optional): title of the new detail
    projection (number, optional): type of initial view projection for the detail
        1 = parallel top view
        2 = parallel bottom view
        3 = parallel left view
        4 = parallel right view
        5 = parallel front view
        6 = parallel back view
        7 = perspective view

Returns: guid: identifier of the newly created detail on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
layout = rs.AddLayout("Portrait", (8.5,11))
if layout:
    rs.AddDetail(layout, (0.5,0.5), (8,10.5), None, 7)
```

See also: DeleteNamedView, NamedViews, RestoreNamedView

## AddLayout

```python
rs.AddLayout(title=None, size=None)
```

Adds a new page layout view

Arguments:

    title (str, optional): title of new layout
    size ([number, number], optional): width and height of paper for the new layout

Returns: guid: id of new layout

Example:

```python
import rhinoscriptsyntax as rs
rs.AddLayout("Portrait")
```

See also: DeleteNamedView, NamedViews, RestoreNamedView

## AddNamedCPlane

```python
rs.AddNamedCPlane(cplane_name, view=None)
```

Adds new named construction plane to the document

Arguments:

    cplane_name (str): the name of the new named construction plane
    view (guid|str): Title or identifier of the view from which to save
             the construction plane. If omitted, the current active view is used.

Returns: atr: name of the newly created construction plane if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
views = rs.ViewNames()
if views:
    for view in views:
        name = view + "_cplane"
        rs.AddNamedCPlane( name, view )
```

See also: DeleteNamedCPlane, NamedCPlane, NamedCPlanes, RestoreNamedCPlane

## AddNamedView

```python
rs.AddNamedView(name, view=None)
```

Adds a new named view to the document

Arguments:

    name (str): the name of the new named view
    view: (guid|str): the title or identifier of the view to save. If omitted, the current
          active view is saved

Returns: str: name fo the newly created named view if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
views = rs.ViewNames()
if views:
    for view in views:
        name = view + "_view"
        rs.AddNamedView( name, view )
```

See also: DeleteNamedView, NamedViews, RestoreNamedView

## CurrentDetail

```python
rs.CurrentDetail(layout, detail=None, return_name=True)
```

Returns or changes the current detail view in a page layout view

Arguments:

    layout (str|guid): title or identifier of an existing page layout view
    detail (str|guid, optional): title or identifier the the detail view to set
    return_name (bool, optional): return title if True, else return identifier

Returns: str: if detail is not specified, the title or id of the current detail view
str: if detail is specified, the title or id of the previous detail view
None: on error

Example:

```python
import rhinoscriptsyntax as rs
layout = rs.CurrentView(return_name=False)
if rs.IsLayout(layout):
    rs.CurrentDetail( layout, layout )
```

See also: IsDetail, IsLayout

## CurrentView

```python
rs.CurrentView(view=None, return_name=True)
```

Returns or sets the currently active view

Arguments:

    view (str|guid): Title or id of the view to set current.
      If omitted, only the title or identifier of the current view is returned
    return_name (bool, optional): If True, then the name, or title, of the view is returned.
      If False, then the identifier of the view is returned

Returns: str: if the title is not specified, the title or id of the current view
str: if the title is specified, the title or id of the previous current view
None: on error

Example:

```python
import rhinoscriptsyntax as rs
previous = rs.CurrentView("Perspective")
print("The previous current view was {}".format(previous))
viewId = rs.CurrentView( return_name=False )
print("The identifier of the current view is {}".format(viewId))
```

See also: IsViewCurrent, ViewNames

## DeleteNamedCPlane

```python
rs.DeleteNamedCPlane(name)
```

Removes a named construction plane from the document

Arguments:

    name (str): name of the construction plane to remove

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
cplanes = rs.NamedCplanes()
if cplanes:
    for cplane in cplanes: rs.DeleteNamedCPlane(cplane)
```

See also: AddNamedCPlane, NamedCPlane, NamedCPlanes, RestoreNamedCPlane

## DeleteNamedView

```python
rs.DeleteNamedView(name)
```

Removes a named view from the document

Arguments:

    name (str): name of the named view to remove

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
views = rs.NamedViews()
if views:
    for view in views: rs.DeleteNamedView(view)
```

See also: AddNamedView, NamedViews, RestoreNamedView

## DetailLock

```python
rs.DetailLock(detail_id, lock=None)
```

Returns or modifies the projection locked state of a detail

Arguments:

    detail_id (guid): identifier of a detail object
    lock (bool, optional) the new lock state

Returns: bool: if lock==None, the current detail projection locked state
bool: if lock is True or False, the previous detail projection locked state
None: on error

Example:

```python
import rhinoscriptsyntax as rs
detail = rs.GetObject("select a detail", rs.filter.detail)
if detail: rs.DetailLock(detail,True)
```

See also: IsDetail, IsLayout

## DetailScale

```python
rs.DetailScale(detail_id, model_length=None, page_length=None)
```

Returns or modifies the scale of a detail object

Arguments:

    detail_id (guid): identifier of a detail object
    model_length (number, optional): a length in the current model units
    page_length (number, optional): a length in the current page units

Returns: number: current page to model scale ratio if model_length and page_length are both None
number: previous page to model scale ratio if model_length and page_length are values
None: on error

Example:

```python
import rhinoscriptsyntax as rs
detail = rs.GetObject("select a detail", rs.filter.detail)
if detail: rs.DetailScale(detail,1,1)
```

See also: IsDetail, IsLayout

## IsDetail

```python
rs.IsDetail(layout, detail)
```

Verifies that a detail view exists on a page layout view

Arguments:

    layout (str|guid): title or identifier of an existing page layout
    detail (str|guid): title or identifier of an existing detail view

Returns: bool: True if detail is a detail view
bool: False if detail is not a detail view
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.IsLayout(view):
    isdetail = rs.IsDetail(view, "Top")
    if isdetail:
        print("Top is a detail view.")
    else:
        print("Top is not a detail view.")
```

See also: IsLayout, CurrentDetail

## IsLayout

```python
rs.IsLayout(layout)
```

Verifies that a view is a page layout view

Arguments:

    layout (guid|str): title or identifier of an existing page layout view

Returns: bool: True if layout is a page layout view
bool: False is layout is a standard, model view
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.IsLayout(view):
    print("The current view is a page layout view.")
else:
    print("The current view is standard, model view.")
```

See also: IsLayout, CurrentDetail

## IsView

```python
rs.IsView(view)
```

Verifies that the specified view exists

Arguments:

    view (str|guid): title or identifier of the view

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
title = "Perspective"
result = rs.IsView(title)
if result:
    print("The {} view exists.".format(title))
else:
    print("The {} view does not exist.".format(title))
```

See also: ViewNames

## IsViewCurrent

```python
rs.IsViewCurrent(view)
```

Verifies that the specified view is the current, or active view

Arguments:

    view (str|guid): title or identifier of the view

Returns: bool: True of False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
title = "Perspective"
result = rs.IsViewCurrent(title)
if result:
    print("The {} view is current".format(title))
else:
    print("The {} view is not current".format(title))
```

See also: CurrentView

## IsViewMaximized

```python
rs.IsViewMaximized(view=None)
```

Verifies that the specified view is maximized (enlarged so as to fill
    the entire Rhino window)

Arguments:

    view: (str|guid): title or identifier of the view. If omitted, the current
          view is used

Returns: bool: True of False

Example:

```python
import rhinoscriptsyntax as rs
title = rs.CurrentView()
result = rs.IsViewMaximized(title)
if result:
    print("The {} view is maximized".format(title))
else:
    print("The {} view is not maximized".format(title))
```

See also: MaximizeRestoreView

## IsViewPerspective

```python
rs.IsViewPerspective(view)
```

Verifies that the specified view's projection is set to perspective

Arguments:

    view (str|guid): title or identifier of the view

Returns: bool: True of False

Example:

```python
import rhinoscriptsyntax as rs
title = rs.CurrentView()
result = rs.IsViewPerspective(title)
if result:
    print("The {} view is set to perspective projection".format(title))
else:
    print("The {} view is set to parallel projection".format(title))
```

See also: ViewProjection

## IsViewTitleVisible

```python
rs.IsViewTitleVisible(view=None)
```

Verifies that the specified view's title window is visible

Arguments:

    view: (str|guid, optional): The title or identifier of the view. If omitted, the current
          active view is used

Returns: bool: True of False

Example:

```python
import rhinoscriptsyntax as rs
title = rs.CurrentView()
vis = rs.IsViewTitleVisible(title)
if vis:
    print("The {} view's title is visible".format(title))
else:
    print("The {} view's title is not visible".format(title))
```

See also: ShowViewTitle

## IsWallpaper

```python
rs.IsWallpaper(view)
```

Verifies that the specified view contains a wallpaper image

Arguments:

    view (str|guid): view to verify

Returns: bool: True or False

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
filename = rs.OpenFileName()
if filename and not rs.IsWallpaper(view):
    rs.Wallpaper(view, filename)
```

See also: Wallpaper

## MaximizeRestoreView

```python
rs.MaximizeRestoreView(view=None)
```

Toggles a view's maximized/restore window state of the specified view

Arguments:

    view: (str|guid, optional): the title or identifier of the view. If omitted, the current
          active view is used

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
title = rs.CurrentView()
if rs.IsViewMaximized(title):
    rs.MaximizeRestoreView( title )
```

See also: IsViewMaximized

## NamedCPlane

```python
rs.NamedCPlane(name)
```

Returns the plane geometry of the specified named construction plane

Arguments:

    name (str): the name of the construction plane

Returns: plane: a plane on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
names = rs.NamedCPlanes()
if names:
    for name in names:
        plane = rs.NamedCPlane(name)
        print("CPlane name:" + name)
        print("CPlane origin:" + plane.Origin)
        print("CPlane x-axis:" + plane.Xaxis)
        print("CPlane y-axis:" + plane.Yaxis)
        print("CPlane z-axis:" + plane.Zaxis)
```

See also: AddNamedCPlane, DeleteNamedCPlane, NamedCPlanes, RestoreNamedCPlane

## NamedCPlanes

```python
rs.NamedCPlanes()
```

Returns the names of all named construction planes in the document

Returns: list(str, ...): the names of all named construction planes in the document

Example:

```python
import rhinoscriptsyntax as rs
cplanes = rs.NamedCPlanes()
if cplanes:
    for cplane in cplanes: print(cplane)
```

See also: AddNamedCPlane, DeleteNamedCPlane, NamedCPlane, RestoreNamedCPlane

## NamedViews

```python
rs.NamedViews()
```

Returns the names of all named views in the document

Returns: list(str, ...): the names of all named views in the document

Example:

```python
import rhinoscriptsyntax as rs
views = rs.NamedViews()
if views:
    for view in views: print(view)
```

See also: AddNamedView, DeleteNamedView, RestoreNamedView

## RenameView

```python
rs.RenameView(old_title, new_title)
```

Changes the title of the specified view

Arguments:

    old_title (str|guid): the title or identifier of the view to rename
    new_title (str): the new title of the view

Returns: str: the view's previous title if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
oldtitle = rs.CurrentView()
rs.renameview( oldtitle, "Current" )
```

See also: ViewNames

## RestoreNamedCPlane

```python
rs.RestoreNamedCPlane(cplane_name, view=None)
```

Restores a named construction plane to the specified view.

Arguments:

    cplane_name (str): name of the construction plane to restore
    view: (str|guid, optional): the title or identifier of the view. If omitted, the current
          active view is used

Returns: str: name of the restored named construction plane if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
cplanes = rs.NamedCplanes()
if cplanes: rs.RestoreNamedCPlane( cplanes[0] )
```

See also: AddNamedCPlane, DeleteNamedCPlane, NamedCPlane, NamedCPlanes

## RestoreNamedView

```python
rs.RestoreNamedView(named_view, view=None, restore_bitmap=False)
```

Restores a named view to the specified view

Arguments:

    named_view (str): name of the named view to restore
    view (str|guid, optional):  title or id of the view to restore the named view.
         If omitted, the current active view is used
    restore_bitmap: (bool, optional): restore the named view's background bitmap

Returns: str: name of the restored view if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
views = rs.NamedViews()
if views: rs.RestoreNamedView(views[0])
```

See also: AddNamedView, DeleteNamedView, NamedViews

## RotateCamera

```python
rs.RotateCamera(view=None, direction=0, angle=None)
```

Rotates a perspective-projection view's camera. See the RotateCamera
    command in the Rhino help file for more details

Arguments:

    view (str|guid, optional):  title or id of the view. If omitted, current active view is used
    direction(number, optional): the direction to rotate the camera where
      0=right
      1=left
      2=down
      3=up
    angle: (number, optional): the angle to rotate. If omitted, the angle of rotation
          is specified by the "Increment in divisions of a circle" parameter
          specified in Options command's View tab

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
rs.RotateCamera( angle=15 )
```

See also: RotateView, TiltView

## RotateView

```python
rs.RotateView(view=None, direction=0, angle=None)
```

Rotates a view. See RotateView command in Rhino help for more information

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    direction (number, optional): the direction to rotate the view where
          0=right
          1=left
          2=down
          3=up
    angle (number): angle to rotate. If omitted, the angle of rotation is specified
          by the "Increment in divisions of a circle" parameter specified in
          Options command's View tab

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
rs.RotateView( angle=90.0 )
```

See also: RotateCamera, TiltView

## ShowGrid

```python
rs.ShowGrid(view=None, show=None)
```

Shows or hides a view's construction plane grid

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    show (bool, optional): The grid state to set. If omitted, the current grid display state is returned

Returns: bool: If show is not specified, then the grid display state if successful
bool: If show is specified, then the previous grid display state if successful

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.ShowGrid(view)==False:
    rs.ShowGrid( view, True )
```

See also: ShowGridAxes, ShowWorldAxes

## ShowGridAxes

```python
rs.ShowGridAxes(view=None, show=None)
```

Shows or hides a view's construction plane grid axes.

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    show (bool, optional): The state to set. If omitted, the current grid axes display state is returned

Returns: bool: If show is not specified, then the grid axes display state
bool: If show is specified, then the previous grid axes display state

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.ShowGridAxes(view)==False:
    rs.ShowGridAxes( view, True )
```

See also: ShowGrid, ShowWorldAxes

## ShowViewTitle

```python
rs.ShowViewTitle(view=None, show=True)
```

Shows or hides the title window of a view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    show (bool, optional): The state to set.

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.IsViewTitleVisible(view)==False:
    rs.ShowViewTitle( view, True )
```

See also: IsViewTitleVisible

## ShowWorldAxes

```python
rs.ShowWorldAxes(view=None, show=None)
```

Shows or hides a view's world axis icon

Arguments:

    view (str|guid, optional):  title or id of the view. If omitted, the current active view is used
    show: (bool, optional): The state to set.

Returns: bool: If show is not specified, then the world axes display state
bool: If show is specified, then the previous world axes display state

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.ShowWorldAxes(view)==False:
    rs.ShowWorldAxes( view, True )
```

See also: ShowGrid, ShowGridAxes

## TiltView

```python
rs.TiltView(view=None, direction=0, angle=None)
```

Tilts a view by rotating the camera up vector. See the TiltView command in
    the Rhino help file for more details.

Arguments:

    view (str|guid, optional):  title or id of the view. If omitted, the current active view is used
    direction (number, optional): the direction to rotate the view where
      0=right
      1=left
    angle (number, optional): the angle to rotate. If omitted, the angle of rotation is
      specified by the "Increment in divisions of a circle" parameter specified
      in Options command's View tab

Returns: bool: True or False indicating success or failure

Example:

```python
import rhinoscriptsyntax as rs
rs.TiltView( angle=15 )
```

See also: RotateCamera

## ViewCPlane

```python
rs.ViewCPlane(view=None, plane=None)
```

Return or set a view's construction plane

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used.
    plane (plane): the new construction plane if setting

Returns: plane: If a construction plane is not specified, the current construction plane
plane: If a construction plane is specified, the previous construction plane

Example:

```python
import rhinoscriptsyntax as rs
origin = rs.GetPoint("CPlane origin")
if origin:
    plane = rs.ViewCPlane()
    plane = rs.MovePlane(plane,origin)
    rs.ViewCPlane(None, plane)
```

See also: ViewCameraLens, ViewCameraTarget, ViewDisplayModes, ViewProjection, ViewSize

## ViewCamera

```python
rs.ViewCamera(view=None, camera_location=None)
```

Returns or sets the camera location of the specified view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    camera_location (point, optional): a 3D point identifying the new camera location.
      If omitted, the current camera location is returned

Returns: point: If camera_location is not specified, the current camera location
point: If camera_location is specified, the previous camera location
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
camera = rs.GetPoint("Select new camera location")
if camera: rs.ViewCamera(view,camera)
```

See also: ViewCameraTarget, ViewTarget

## ViewCameraLens

```python
rs.ViewCameraLens(view=None, length=None)
```

Returns or sets the 35mm camera lens length of the specified perspective
    projection view.

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    length (number, optional): the new 35mm camera lens length. If omitted, the previous
      35mm camera lens length is returned

Returns: number: If lens length is not specified, the current lens length
number: If lens length is specified, the previous lens length

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.IsViewPerspective(view):
    length = rs.ViewCameraLens(view, 100)
```

See also: ViewCameraTarget, ViewCPlane, ViewDisplayModes, ViewProjection, ViewSize

## ViewCameraPlane

```python
rs.ViewCameraPlane(view=None)
```

Returns the orientation of a view's camera.

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used

Returns: plane: the view's camera plane if successful
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
target = rs.ViewTarget(view)
camplane = rs.ViewCameraPlane(view)
plane = rs.MovePlane(camplane, target)
rs.ViewCPlane( view, plane )
```

See also: ViewCamera, ViewTarget

## ViewCameraTarget

```python
rs.ViewCameraTarget(view=None, camera=None, target=None)
```

Returns or sets the camera and target positions of the specified view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used
    camera (point): 3d point identifying the new camera location. If camera and
       target are not specified, current camera and target locations are returned
    target (point): 3d point identifying the new target location. If camera and
       target are not specified, current camera and target locations are returned

Returns: list(point, point): if both camera and target are not specified, then the 3d points containing
  the current camera and target locations is returned
point: if either camera or target are specified, then the 3d points containing the
  previous camera and target locations is returned

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
camera = rs.GetPoint("Select new camera location")
target = rs.GetPoint("Select new target location")
if camera and target:
    rs.ViewCameraTarget( view, camera, target )
```

See also: ViewCamera, ViewTarget

## ViewCameraUp

```python
rs.ViewCameraUp(view=None, up_vector=None)
```

Returns or sets the camera up direction of a specified

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, the current active view is used
    up_vector (vector): 3D vector identifying the new camera up direction

Returns: vector: if up_vector is not specified, then the current camera up direction
vector: if up_vector is specified, then the previous camera up direction

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
upVector = rs.ViewCameraUp(view)
print(up_vector)
```

See also: ViewCamera, ViewTarget

## ViewDisplayMode

```python
rs.ViewDisplayMode(view=None, mode=None, return_name=True)
```

Return or set a view display mode

Arguments:

    view (str|guid, optional): Title or id of a view. If omitted, active view is used
    mode (str|guid, optional): Name or id of a display mode
    return_name (bool, optional): If true, return display mode name. If False, display mode id

Returns: str: If mode is specified, the previous mode
str: If mode is not specified, the current mode

Example:

```python
import rhinoscriptsyntax as rs
views = rs.ViewNames()
for view in views:
    rs.ViewDisplayMode(view, 'Ghosted')
```

See also: CurrentView, ViewNames

## ViewDisplayModeId

```python
rs.ViewDisplayModeId(name)
```

Return id of a display mode given it's name

Arguments:

    name (str): name of the display mode

Returns: guid: The id of the display mode if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
modes = rs.ViewDisplayModes(True)
for mode in modes: print("{} = {}".format(mode, rs.ViewDisplayModeId(mode)))
```

See also: ViewDisplayMode, ViewDisplayModes

## ViewDisplayModeName

```python
rs.ViewDisplayModeName(mode_id)
```

Return name of a display mode given it's id

Arguments:

    mode_id (guid): The identifier of the display mode obtained from the ViewDisplayModes method.

Returns: str: The name of the display mode if successful, otherwise None

Example:

```python
import rhinoscriptsyntax as rs
modes = rs.ViewDisplayModes(False)
for mode in modes: print("{} = {}".format(mode, rs.ViewDisplayModeName(mode)))
```

See also: ViewDisplayMode, ViewDisplayModes

## ViewDisplayModes

```python
rs.ViewDisplayModes(return_names=True)
```

Return list of display modes

Arguments:

    return_name (bool, otpional): If True, return mode names. If False, return ids

Returns: list(str|guid, ...): strings identifying the display mode names or identifiers if successful

Example:

```python
import rhinoscriptsyntax as rs
modes = rs.ViewDisplayModes(False)
for mode in modes: print("{} = {}".format(mode, rs.ViewDisplayModeName(mode)))
```

See also: ViewDisplayMode, ViewDisplayModeName

## ViewNames

```python
rs.ViewNames(return_names=True, view_type=0)
```

Return the names, titles, or identifiers of all views in the document

Arguments:

    return_names (bool, optional): if True then the names of the views are returned.
      If False, then the identifiers of the views are returned
    view_type: (number, optional): the type of view to return
                     0 = standard model views
                     1 = page layout views
                     2 = both standard and page layout views

Returns: list(str|guid, ...): of the view names or identifiers on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
# Print view names
views = rs.ViewNames()
if views:
    for view in views: print(view)
# Print view identifiers
view_ids = rs.ViewNames(False)
if view_ids:
    for id in view_ids:
        print("{} = {}".format(id, rs.ViewTitle(id)))
```

See also: IsView, ViewTitle

## ViewNearCorners

```python
rs.ViewNearCorners(view=None)
```

Return 3d corners of a view's near clipping plane rectangle. Useful
    in determining the "real world" size of a parallel-projected view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used

Returns: list(point, point, point, point): Four Point3d that define the corners of the rectangle (counter-clockwise order)

Example:

```python
import rhinoscriptsyntax as rs
rect = rs.ViewNearCorners()
if rect:
    for i in range(4): rs.AddTextDot( i, rect[i] )
```

See also: CurrentView

## ViewProjection

```python
rs.ViewProjection(view=None, mode=None)
```

Return or set a view's projection mode.

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used
    mode (number, optional): the projection mode
      1 = parallel
      2 = perspective
      3 = two point perspective

Returns: number: if mode is not specified, the current projection mode for the specified view
number: if mode is specified, the previous projection mode for the specified view

Example:

```python
import rhinoscriptsyntax as rs
views = rs.ViewNames()
if views:
    for view in views: rs.ViewProjection(view,1)
```

See also: IsViewPerspective

## ViewRadius

```python
rs.ViewRadius(view=None, radius=None, mode=False)
```

Returns or sets the radius of a parallel-projected view. Useful
    when you need an absolute zoom factor for a parallel-projected view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used
    radius (number): the view radius
    mode (bool, optional): perform a "dolly" magnification by moving the camera
      towards/away from the target so that the amount of the screen 
      subtended by an object changes.  true = perform a "zoom" 
      magnification by adjusting the "lens" angle

Returns: number: if radius is not specified, the current view radius for the specified view
number: if radius is specified, the previous view radius for the specified view

Example:

```python
import rhinoscriptsyntax as rs
rhParallelView = 1
views = rs.ViewNames()
if views:
    for view in views:
        if rs.ViewProjection(view)==rhParallelView:
            rs.ViewRadius(view, 10.0)
```

See also: IsViewPerspective, ViewProjection

## ViewSize

```python
rs.ViewSize(view=None)
```

Returns the width and height in pixels of the specified view

Arguments:

    view (str|guid): title or id of the view. If omitted, current active view is used

Returns: tuple(number, number): of two numbers identifying width and height

Example:

```python
import rhinoscriptsyntax as rs
size = rs.ViewSize()
if size:
    print("Width: {} pixels".format(size[0]))
    print("Height: {} pixels".format(size[1]))
```

See also: ViewCameraLens, ViewCameraTarget, ViewCPlane, ViewDisplayModes, ViewProjection

## ViewSpeedTest

```python
rs.ViewSpeedTest(view=None, frames=100, freeze=True, direction=0, angle_degrees=5)
```

Test's Rhino's display performance

Arguments:

    view (str|guid, optional): The title or identifier of the view.  If omitted, the current active view is used
    frames (number, optional): The number of frames, or times to regenerate the view. If omitted, the view will be regenerated 100 times.
    freeze (bool, optional): If True (Default), then Rhino's display list will not be updated with every frame redraw. If False, then Rhino's display list will be updated with every frame redraw.
    direction (number, optional): The direction to rotate the view. The default direction is Right (0). Modes:
      0 = Right
      1 = Left
      2 = Down
      3 = Up.
    angle_degrees (number, optional): The angle to rotate. If omitted, the rotation angle of 5.0 degrees will be used.

Returns: number: The number of seconds it took to regenerate the view frames number of times, if successful
None: if not successful

Example:

```python
import rhinoscriptsyntax as rs
view = "Perspective"
seconds = rs.ViewSpeedTest(view, 100)
if seconds:
    print("Time to regen viewport 100 times = {} secords".format(seconds))
```

## ViewTarget

```python
rs.ViewTarget(view=None, target=None)
```

Returns or sets the target location of the specified view

Arguments:

    view (str|guid, optional): title or id of the view. If omitted, current active view is used
    target (point, optional): 3d point identifying the new target location. If omitted,
      the current target location is returned

Returns: point: is target is not specified, then the current target location
point: is target is specified, then the previous target location
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
target = rs.GetPoint("Select new target location")
if target: rs.ViewTarget( view, target )
```

See also: ViewCamera, ViewCameraTarget

## ViewTitle

```python
rs.ViewTitle(view_id)
```

Returns the name, or title, of a given view's identifier

Arguments:

    view_id (str|guid): The identifier of the view

Returns: str: name or title of the view on success
None: on error

Example:

```python
import rhinoscriptsyntax as rs
view_ids = rs.ViewNames(False)
for id in view_ids:
    print(id + " = " + rs.ViewTitle(id))
```

See also: CurrentView, ViewNames

## Wallpaper

```python
rs.Wallpaper(view=None, filename=None)
```

Returns or sets the wallpaper bitmap of the specified view. To remove a
    wallpaper bitmap, pass an empty string ""

Arguments:

    view (str|guid, optional): The identifier of the view. If omitted, the
      active view is used
    filename (str): Name of the bitmap file to set as wallpaper

Returns: str: If filename is not specified, the current wallpaper bitmap filename
str: If filename is specified, the previous wallpaper bitmap filename

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
filename = rs.OpenFileName()
if filename and not rs.IsWallpaper(view):
    rs.Wallpaper(view, filename)
```

See also: IsWallpaper, WallpaperGrayScale, WallpaperHidden

## WallpaperGrayScale

```python
rs.WallpaperGrayScale(view=None, grayscale=None)
```

Returns or sets the grayscale display option of the wallpaper bitmap in a
    specified view

Arguments:

    view (str|guid, optional):  The identifier of the view. If omitted, the
      active view is used
    grayscale (bool, optional): Display the wallpaper in gray(True) or color (False)

Returns: bool: If grayscale is not specified, the current grayscale display option
bool: If grayscale is specified, the previous grayscale display option

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.WallpaperGrayScale(view)==False: rs.WallpaperGrayScale(view, True)
```

See also: Wallpaper, WallpaperHidden

## WallpaperHidden

```python
rs.WallpaperHidden(view=None, hidden=None)
```

Returns or sets the visibility of the wallpaper bitmap in a specified view

Arguments:

    view (str|guid, optional): The identifier of the view. If omitted, the
      active view is used
    hidden (bool, optional): Show or hide the wallpaper

Returns: bool: If hidden is not specified, the current hidden state
bool: If hidden is specified, the previous hidden state

Example:

```python
import rhinoscriptsyntax as rs
view = rs.CurrentView()
if rs.WallpaperHidden(view) == False: rs.WallpaperHidden(view, True)
```

See also: Wallpaper, WallpaperGrayScale

## ZoomBoundingBox

```python
rs.ZoomBoundingBox(bounding_box, view=None, all=False)
```

Zooms to the extents of a specified bounding box in the specified view

Arguments:

    bounding_box ([point, point, point ,point, point, point, point, point]): eight points that define the corners
      of a bounding box or a BoundingBox class instance
    view  (str|guid, optional): title or id of the view. If omitted, current active view is used
    all (bool, optional): zoom extents in all views

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
obj = rs.GetObject()
if obj:
    bbox = rs.BoundingBox(obj)
    rs.ZoomBoundingBox( bbox )
```

See also: ZoomExtents, ZoomSelected

## ZoomExtents

```python
rs.ZoomExtents(view=None, all=False)
```

Zooms to extents of visible objects in the specified view

Arguments:

    view  (str|guid, optional): title or id of the view. If omitted, current active view is used
    all (bool, optional): zoom extents in all views

Returns: None

Example:

```python
import rhinoscriptsyntax as rs
rs.ZoomExtents()
```

See also: ZoomBoundingBox, ZoomSelected

## ZoomSelected

```python
rs.ZoomSelected(view=None, all=False)
```

Zoom to extents of selected objects in a view

Arguments:

    view  (str|guid, optional): title or id of the view. If omitted, active view is used
    all (bool, optional): zoom extents in all views

Returns: None

Example:

```python
import rhinocriptsyntax as rs
obj = rs.GetObject("Select object", select=True)
if obj: rs.ZoomSelected()
```

See also: ZoomBoundingBox, ZoomExtents
