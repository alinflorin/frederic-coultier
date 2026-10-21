# rhinoscriptsyntax: application

## AddAlias

```python
rs.AddAlias(alias, macro)
```

Add new command alias to Rhino. Command aliases can be added manually by
    using Rhino's Options command and modifying the contents of the Aliases tab.

Arguments:

    alias (str): Name of new command alias. Cannot match command names or existing
            aliases.
    macro (str): The macro to run when the alias is executed.

Returns: bool: True or False indicating success or failure.

Example:

```python
import rhinoscriptsyntax as  rs
rs.AddAlias("OriginLine",  "!_Line 0,0,0")
```

See also: AliasCount, AliasMacro, AliasNames, DeleteAlias, IsAlias

## AddSearchPath

```python
rs.AddSearchPath(folder, index=-1)
```

Add new path to Rhino's search path list. Search paths can be added by
    using Rhino's Options command and modifying the contents of the files tab.

Arguments:

    folder (str): A valid folder, or path, to add.
    index (number, optional): Zero-based position in the search path list to insert.
                           If omitted, path will be appended to the end of the
                           search path list.

Returns: number: The index where the item was inserted if success.
     -1 on failure.

Example:

```python
import rhinoscriptsyntax as rs
rs.AddSearchPath("C:\\My Python Scripts")
```

See also: DeleteSearchPath, SearchPathCount, SearchPathList

## AliasCount

```python
rs.AliasCount()
```

Returns number of command aliases in Rhino.

Returns: number: the number of command aliases in Rhino.

Example:

```python
import rhinoscriptsyntax as rs
print("alias count = {}".format(rs.AliasCount()))
```

See also: AddAlias, AliasMacro, AliasNames, DeleteAlias, IsAlias

## AliasMacro

```python
rs.AliasMacro(alias, macro=None)
```

Returns or modifies the macro of a command alias.

Arguments:

    alias (str): The name of an existing command alias.
    macro (str, optional): The new macro to run when the alias is executed. If omitted, the current alias macro is returned.

Returns: str:  If a new macro is not specified, the existing macro if successful.
str:  If a new macro is specified, the previous macro if successful.
null:  None on error

Example:

```python
import rhinoscriptsyntax as rs
aliases = rs.AliasNames()
for alias in aliases:
    print("{} -> {}".format(alias, rs.AliasMacro(alias)))
```

See also: AddAlias, AliasCount, AliasNames, DeleteAlias, IsAlias

## AliasNames

```python
rs.AliasNames()
```

Returns a list of command alias names.

Returns: str: a list of command alias names.

Example:

```python
import rhinoscriptsyntax as rs
aliases = rs.AliasNames()
for alias in aliases: print(alias)
```

See also: AddAlias, AliasCount, AliasMacro, DeleteAlias, IsAlias

## AppearanceColor

```python
rs.AppearanceColor(item, color=None)
```

Returns or modifies an application interface item's color.

Arguments:

    item (number): Item number to either query or modify
           0  = View background
           1  = Major grid line
           2  = Minor grid line
           3  = X-Axis line
           4  = Y-Axis line
           5  = Selected Objects
           6  = Locked Objects
           7  = New layers
           8  = Feedback
           9  = Tracking
           10 = Crosshair
           11 = Text
           12 = Text Background
           13 = Text hover
    color ([r255,g255,b255], optional): The new color value in (r255,g255,b255). If omitted, the current item color is returned.

Returns: tuple (r255,g255,b255): if color is not specified, the current item color.
tuple (r255,g255,b255): if color is specified, the previous item color.

Example:

```python
import rhinoscriptsyntax as rs
oldColor = rs.AppearanceColor(0)
newColor = rs.GetColor(oldColor)
if newColor is not None:
    rs.AppearanceColor(0, newColor)
    rs.Redraw()
```

See also: GetColor

## AutosaveFile

```python
rs.AutosaveFile(filename=None)
```

Returns or changes the file name used by Rhino's automatic file saving

Arguments:

    filename (str, optional): Name of the new autosave file

Returns: str: if filename is not specified, the name of the current autosave file
str: if filename is specified, the name of the previous autosave file

Example:

```python
import rhinoscriptsyntax as rs
file = rs.AutosaveFile()
print("The current autosave file is {}".format(file))
```

See also: AutosaveInterval, EnableAutosave

## AutosaveInterval

```python
rs.AutosaveInterval(minutes=None)
```

Returns or changes how often the document will be saved when Rhino's
    automatic file saving mechanism is enabled

Arguments:

    minutes (number, optional): The number of minutes between saves

Returns: number: if minutes is not specified, the current interval in minutes
number: if minutes is specified, the previous interval in minutes

Example:

```python
import rhinoscriptsyntax as rs
minutes = rs.AutosaveInterval()
if minutes>20: rs.AutosaveInterval(20)
```

See also: AutosaveFile, EnableAutosave

## BuildDate

```python
rs.BuildDate()
```

Returns the build date of Rhino

Returns: Datetime.date: the build date of Rhino. Will be converted to a string by most functions.

Example:

```python
import rhinoscriptsyntax as rs
build = rs.BuildDate()
print("Rhino Build:{}".format(build)
```

## ClearCommandHistory

```python
rs.ClearCommandHistory()
```

Clears contents of Rhino's command history window. You can view the
    command history window by using the CommandHistory command in Rhino.

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.ClearCommandHistory()
```

See also: CommandHistory

## Command

```python
rs.Command(commandString, echo=True)
```

Runs a Rhino command script. All Rhino commands can be used in command
    scripts. The command can be a built-in Rhino command or one provided by a
    3rd party plug-in.

Arguments:

    commandString (str): A Rhino command including any arguments
    echo (bool, optional): The command echo mode True will display the commands on the commandline. If omitted, command prompts are echoed (True)

Returns: bool: True or False indicating success or failure

Write command scripts just as you would type the command sequence at the
command line. A space or a new line acts like pressing <Enter> at the
command line. For more information, see "Scripting" in Rhino help.

Note, this function is designed to run one command and one command only.
Do not combine multiple Rhino commands into a single call to this method.
  WRONG:
    rs.Command("_Line _SelLast _Invert")
  CORRECT:
    rs.Command("_Line")
    rs.Command("_SelLast")
    rs.Command("_Invert")

Also, the exclamation point and space character ( ! ) combination used by
button macros and batch-driven scripts to cancel the previous command is
not valid.
  WRONG:
    rs.Command("! _Line _Pause _Pause")
  CORRECT:
    rs.Command("_Line _Pause _Pause")
After the command script has run, you can obtain the identifiers of most
recently created or changed object by calling LastCreatedObjects.

Example:

```python
import rhinoscriptsyntax as rs
rs.Command("_Line 0,0,0 2,2,2")
rs.Command("_Line _Pause _Pause")
```

See also: IsCommand, LastCommandName, LastCommandResult, LastCreatedObjects, Prompt

## CommandHistory

```python
rs.CommandHistory()
```

Returns the contents of Rhino's command history window

Returns: str: the contents of Rhino's command history window

Example:

```python
import rhinoscriptsyntax as rs
print(rs.CommandHistory())
```

See also: ClearCommandHistory

## DefaultRenderer

```python
rs.DefaultRenderer(renderer=None)
```

Returns or changes the default render plug-in

Arguments:

    renderer (str, optional): The name of the renderer to set as default renderer.  If omitted the Guid of the current renderer is returned.

Returns: guid: Unique identifier of default renderer

Example:

```python
import rhinoscriptsyntax as rs
rs.DefaultRenderer("MyRenderPlugIn")
```

See also: PlugIns

## DeleteAlias

```python
rs.DeleteAlias(alias)
```

Delete an existing alias from Rhino.

Arguments:

    alias (str): The name of an existing alias.

Returns: bool: True or False indicating success

Example:

```python
import rhinoscriptsyntax as rs
print(rs.DeleteAlias("Hello"))
```

See also: AddAlias, AliasCount, AliasMacro, AliasNames, IsAlias

## DeleteSearchPath

```python
rs.DeleteSearchPath(folder)
```

Removes existing path from Rhino's search path list. Search path items
    can be removed manually by using Rhino's options command and modifying the
    contents of the files tab

Arguments:

    folder (str): A folder to remove

Returns: bool: True or False indicating success

Example:

```python
import rhinoscriptsyntax as rs
rs.DeleteSearchPath("C:\\My RhinoScripts")
```

See also: AddSearchPath, SearchPathCount, SearchPathList

## DisplayOleAlerts

```python
rs.DisplayOleAlerts(enable)
```

Enables/disables OLE Server Busy/Not Responding dialog boxes

Arguments:

    enable (bool): Whether alerts should be visible (True or False)

Returns: none

Example:

```python
import System
import rhinoscriptsyntax as rs
rs.DisplayOleAlerts( False )
t = System.Type.GetTypeFromProgID("Excel.Application")
objExcel = System.Activator.CreateObject(t)
...
```

## EdgeAnalysisColor

```python
rs.EdgeAnalysisColor(color=None)
```

Returns or modifies edge analysis color displayed by the ShowEdges command

Arguments:

    color (tuple (r255,g255,b255), optional): The new color for the analysis.

Returns: tuple (r255,g255,b255): if color is not specified, the current edge analysis color
tuple (r255,g255,b255): if color is specified, the previous edge analysis color

Example:

```python
import rhinoscriptsyntax as rs
oldcolor = rs.EdgeAnalysisColor()
newcolor = rs.GetColor(oldcolor)
if newcolor is not None:
    rs.EdgeAnalysisColor(newcolor)
```

See also: EdgeAnalysisMode

## EdgeAnalysisMode

```python
rs.EdgeAnalysisMode(mode=None)
```

Returns or modifies edge analysis mode displayed by the ShowEdges command

Arguments:

    mode (number, optional): The new display mode. The available modes are
                 0 - display all edges
                 1 - display naked edges

Returns: number: if mode is not specified, the current edge analysis mode
number: if mode is specified, the previous edge analysis mode

Example:

```python
import rhinoscriptsyntax as rs
previous_mode = rs.EdgeAnalysisMode(1)
```

See also: EdgeAnalysisColor

## EnableAutosave

```python
rs.EnableAutosave(enable=True)
```

Enables or disables Rhino's automatic file saving mechanism

Arguments:

    enable (bool, optional): The autosave state. If omitted automatic saving is enabled (True)

Returns: bool: the previous autosave state

Example:

```python
import rhinoscriptsyntax as rs
prevstate = rs.EnableAutosave()
```

See also: AutosaveFile, AutosaveInterval

## EnablePlugIn

```python
rs.EnablePlugIn(plugin, enable=None)
```

Enables or disables a Rhino plug-in

Arguments:

    plugin (guid): The unique Guid id of the plugin.
    enable (bool, optional): Load silently if True. If omitted Load silently is False.

Returns: bool: True if set to load silently otherwise False

Example:

```python
import rhinoscriptsyntax as rs
print(rs.EnablePlugIn("RhinoCrasher", False))
```

See also: IsPlugIn, PlugInId, PlugIns

## ExeFolder

```python
rs.ExeFolder()
```

Returns the full path to Rhino's executable folder.

Returns: str: the full path to Rhino's executable folder.

Example:

```python
import rhinoscriptsyntax as rs
folder = rs.ExeFolder()
print(folder)
```

See also: InstallFolder

## ExePlatform

```python
rs.ExePlatform()
```

Returns the platform of the Rhino executable

Returns: str: the platform of the Rhino executable

Example:

```python
import rhinoscriptsyntax as rs
if rs.ExePlatform() == 1:
    print("You are using a 64-bit version of Rhino.")
else:
    print("You are using a 32-bit version of Rhino.")
```

See also: BuildDate, ExeVersion, SdkVersion

## ExeServiceRelease

```python
rs.ExeServiceRelease()
```

Returns the service release number of the Rhino executable

Returns: str: the service release number of the Rhino executable

Example:

```python
import rhinoscriptsyntax as rs
print("Build date:{}".format(rs.BuildDate())
print("SDK Version:{}".format(rs.SdkVersion())
print("SDK Service Release:{}".format(rs.SdkServiceRelease())
print("Executable Version:{}".format(rs.ExeVersion())
print("Executable Service Release:{}".format(rs.ExeServiceRelease())
print("Serial Number:{}".format(rs.SerialNumber())
print("Node Type:{}".format(rs.NodeType())
print("Install Type:{}".format(rs.InstallType())
```

See also: BuildDate, ExeVersion, SdkVersion

## ExeVersion

```python
rs.ExeVersion()
```

Returns the major version number of the Rhino executable

Returns: str: the major version number of the Rhino executable

Example:

```python
import rhinoscriptsyntax as rs
print("Build date:{}".format(rs.BuildDate()))
print("SDK Version:{}".format(rs.SdkVersion()))
print("SDK Service Release:{}".format(rs.SdkServiceRelease()))
print("Executable Version:{}".format(rs.ExeVersion()))
print("Executable Service Release:{}".format(rs.ExeServiceRelease()))
print("Serial Number:{}".format(rs.SerialNumber()))
print("Node Type:{}".format(rs.NodeType()))
print("Install Type:{}".format(rs.InstallType()))
```

See also: BuildDate, ExeServiceRelease, SdkVersion

## Exit

```python
rs.Exit()
```

Closes the rhino application

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.Exit()
```

## FindFile

```python
rs.FindFile(filename)
```

Searches for a file using Rhino's search path. Rhino will look for a
    file in the following locations:
      1. The current document's folder.
      2. Folder's specified in Options dialog, File tab.
      3. Rhino's System folders

Arguments:

    filename (str): A short file name to search for

Returns: str: full path on success

Example:

```python
import rhinoscriptsyntax as rs
path = rs.FindFile("Rhino.exe")
print(path)
```

## GetPlugInObject

```python
rs.GetPlugInObject(plug_in)
```

Returns a scriptable object from a specified plug-in. Not all plug-ins
    contain scriptable objects. Check with the manufacturer of your plug-in
    to see if they support this capability.

Arguments:

    plug_in (str or guid): The name or Id of a registered plug-in that supports scripting.
                           If the plug-in is registered but not loaded, it will be loaded

Returns: guid: scriptable object if successful
null: None on error

Example:

```python
import rhinoscriptsyntax as rs
objPlugIn = rs.GetPlugInObject("SomePlugIn")
if objPlugIn is not None:
    print(objPlugIn.About())
```

## InCommand

```python
rs.InCommand(ignore_runners=True)
```

Determines if Rhino is currently running a command. Because Rhino allows
    for transparent commands (commands run from inside of other commands), this
    method returns the total number of active commands.

Arguments:

    ignore_runners (bool, optional): If True, script running commands, such as
                                     LoadScript, RunScript, and ReadCommandFile will not counted.
                                     If omitted the default is not to count script running command (True).

Returns: number: the number of active commands

Example:

```python
import rhinoscriptsyntax as rs
commands = rs.InCommand()
if commands > 0:
    print("Rhino is running", commands, "command(s).")
else:
    print("Rhino is not running any command(s).")
```

See also: Command, IsCommand

## InstallFolder

```python
rs.InstallFolder()
```

The full path to Rhino's installation folder

Returns: str: the full path to Rhino's installation folder

Example:

```python
import rhinoscriptsyntax as rs
print(rs.InstallFolder())
```

See also: ExeFolder

## IsAlias

```python
rs.IsAlias(alias)
```

Verifies that a command alias exists in Rhino

Arguments:

    alias (str): The name of an existing command alias

Returns: bool: True if exists or False if the alias does not exist.

Example:

```python
import rhinoscriptsyntax as rs
print(rs.IsAlias("Hello"))
```

See also: AddAlias, AliasCount, AliasMacro, AliasNames, DeleteAlias

## IsCommand

```python
rs.IsCommand(command_name)
```

Verifies that a command exists in Rhino. Useful when scripting commands
    found in 3rd party plug-ins.

Arguments:

    command_name (str): The command name to test

Returns: bool: True if the string is a command or False if it is not a command.

Example:

```python
import rhinoscriptsyntax as rs
cmdname = rs.GetString("Command name to test")
if cmdname is not None:
    iscmd = rs.IsCommand(cmdname)
    if iscmd:
        print("The", cmdname, "command exists.")
    else:
        print("The", cmdname, "command does not exist.")
```

See also: Command, InCommand

## IsPlugIn

```python
rs.IsPlugIn(plugin)
```

Verifies that a plug-in is registered

Arguments:

    plugin (guid): The unique id of the plug-in

Returns: bool: True if the Guid is registered or False if it is not.

Example:

```python
import rhinoscriptsyntax as rs
plugin = rs.GetString("Plug-in name")
if rs.IsPlugIn(plugin): print("The  plug-in is registered.")
else: print("The  plug-in is not registered.")
```

See also: EnablePlugIn, PlugInId, PlugIns

## IsRunningOnWindows

```python
rs.IsRunningOnWindows()
```

Returns True if this script is being executed on a Windows platform

Returns: bool: True if currently running on the Widows platform. False if it is not Windows.

Example:

```python
import rhinoscriptsyntax as rs
if rs.IsRunngingOnWindows():
    print("Running on Windows")
else:
    print("Running on Mac")
```

## LastCommandName

```python
rs.LastCommandName()
```

Returns the name of the last executed command

Returns: str: the name of the last executed command

Example:

```python
import rhinoscriptsyntax as rs
rs.Command( "Line" )
print("The last command was the {} {}".format(rs.LastCommandName(), "command."))
```

See also: Command, IsCommand, LastCommandResult

## LastCommandResult

```python
rs.LastCommandResult()
```

Returns the result code for the last executed command

Returns: number: the result code for the last executed command.
          0 = success (command successfully completed)
          1 = cancel (command was cancelled by the user)
          2 = nothing (command did nothing, but was not cancelled)
          3 = failure (command failed due to bad input, computational problem...)
          4 = unknown command (the command was not found)

Example:

```python
import rhinoscriptsyntax as rs
rs.Command( "Line" )
result = rs.LastCommandResult()
if result==0:
    print("The command completed.")
else:
    print("The command did not complete.")
```

See also: Command, IsCommand, LastCommandName

## LocaleID

```python
rs.LocaleID()
```

Returns the current language used for the Rhino interface.  The current
    language is returned as a locale ID, or LCID, value.

Returns: number: the current language used for the Rhino interface as a locale ID, or LCID.
          1029  Czech
          1031  German-Germany
          1033  English-United States
          1034  Spanish-Spain
          1036  French-France
          1040  Italian-Italy
          1041  Japanese
          1042  Korean
          1045  Polish

Example:

```python
import rhinoscriptsyntax as rs
lcid = rs.LocaleID()
if lcid==1029:
    print("message in Czech")
elif lcid==1031:
    print("message in German")
elif lcid==1033:
    print("message in English")
elif lcid==1034:
    print("message in Spanish")
elif lcid==1036:
    print("message in Italian")
elif lcid==1040:
    print("message in Japanese")
elif lcid==1042:
    print("message in Korean")
elif lcid==1045:
    print("message in Polish")
```

## Ortho

```python
rs.Ortho(enable=None)
```

Enables or disables Rhino's ortho modeling aid.

Arguments:

    enable (bool, optional): The new enabled status (True or False). If omitted the current state is returned.

Returns: bool: if enable is not specified, then the current ortho status
bool: if enable is specified, then the previous ortho status

Example:

```python
import rhinoscriptsyntax as rs
if not rs.Ortho(): rs.Ortho(True)
```

See also: Osnap, Planar, Snap

## Osnap

```python
rs.Osnap(enable=None)
```

Enables or disables Rhino's object snap modeling aid.
    Object snaps are tools for specifying points on existing objects.

Arguments:

    enable (bool, optional): The new enabled status.

Returns: bool: if enable is not specified, then the current osnap status
bool: if enable is specified, then the previous osnap status

Example:

```python
import rhinoscriptsyntax as rs
if not rs.Osnap(): rs.Osnap(True)
```

See also: Ortho, OsnapMode, Planar, Snap

## OsnapDialog

```python
rs.OsnapDialog(visible=None)
```

Shows or hides Rhino's dockable object snap bar

Arguments:

    visible (bool, optional): The new visibility state. If omitted then the current state is returned.

Returns: bool: if visible is not specified, then the current visible state
bool: if visible is specified, then the previous visible state

Example:

```python
import rhinoscriptsyntax as rs
if not rs.OsnapDialog(): rs.OsnapDialog(True)
```

See also: Osnap, OsnapMode, ProjectOsnaps

## OsnapMode

```python
rs.OsnapMode(mode=None)
```

Returns or sets the object snap mode. Object snaps are tools for
    specifying points on existing objects

Arguments:

    mode (number, optional): The object snap mode or modes to set. Object snap modes
                   can be added together to set multiple modes
                   0          None
                   2          Near
                   8          Focus
                   32         Center
                   64         Vertex
                   128        Knot
                   512        Quadrant
                   2048       Midpoint
                   8192       Intersection
                   131072     End
                   524288     Perpendicular
                   2097152    Tangent
                   134217728  Point

Returns: number: if mode is not specified, then the current object snap mode(s)
number: if mode is specified, then the previous object snap mode(s)

Example:

```python
import rhinoscriptsyntax as rs
rhOsnapModeEnd = 131072
#add 'End' mode while keeping the ones that are already set
mode = rs.OsnapMode()
rs.OsnapMode(mode + rhOsnapModeEnd)
#add 'End' mode while clearing the others
rs.OsnapMode(rhOsnapModeEnd)
```

See also: Osnap, OsnapDialog, ProjectOsnaps

## Planar

```python
rs.Planar(enable=None)
```

Enables or disables Rhino's planar modeling aid

Arguments:

    enable (bool, optional): The new enable status.  If omitted the current state is returned.

Returns: bool: if enable is not specified, then the current planar status
bool: if enable is secified, then the previous planar status

Example:

```python
import rhinoscriptsyntax as rs
if not rs.Planar(): rs.Planar(True)
```

See also: Ortho, Osnap, Snap

## PlugInId

```python
rs.PlugInId(plugin)
```

Returns the identifier of a plug-in given the plug-in name

Arguments:

    plugin (guid): Unique id of the plug-in

Returns: guid: the id of the plug-in
None: None if the plug-in isn't valid

Example:

```python
import rhinoscriptsyntax as rs
plugins = rs.PlugIns(0, 1)
if plugins:
    for plugin in plugins: print(rs.PlugInId(plugin))
```

See also: EnablePlugIn, IsPlugIn, PlugIns

## PlugIns

```python
rs.PlugIns(types=0, status=0)
```

Returns a list of registered Rhino plug-ins

Arguments:

    types (number, optional): The type of plug-ins to return.
                              0=all
                              1=render
                              2=file export
                              4=file import
                              8=digitizer
                              16=utility.
                              If omitted, all are returned.
    status (number, optional): 0=both loaded and unloaded, 1=loaded, 2=unloaded.  If omitted both status is returned.

Returns: list of str: list of registered Rhino plug-ins

Example:

```python
import rhinoscriptsyntax as rs
plugins = rs.PlugIns(0, 1)
for plugin in plugins: print(plugin)
```

## ProjectOsnaps

```python
rs.ProjectOsnaps(enable=None)
```

Enables or disables object snap projection

Arguments:

    enable (bool, optional): The new enabled status.  If omitted the current status is returned.

Returns: bool: the current object snap projection status

Example:

```python
import rhinoscriptsyntax as rs
if not rs.ProjectOsnaps(): rs.ProjectOsnaps(True)
```

See also: Osnap, OsnapDialog, OsnapMode

## Prompt

```python
rs.Prompt(message=None)
```

Change Rhino's command window prompt

Arguments:

    message (str, optional): The new prompt on the commandline.  If omitted the prompt will be blank.

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.Prompt("Hello Rhino!")
```

See also: Command

## ScreenSize

```python
rs.ScreenSize()
```

Returns current width and height, of the screen of the primary monitor.

Returns: tuple (width, height): containing two numbers identifying the width and height in pixels

Example:

```python
import rhinoscriptsyntax as rs
size = rs.ScreenSize()
print("Screen Width: {} pixels".format(size[0]))
print("Screen Height: {} pixels".format(size[1]))
```

## SdkVersion

```python
rs.SdkVersion()
```

Returns version of the Rhino SDK supported by the executing Rhino.

Returns: str: the version of the Rhino SDK supported by the executing Rhino. Rhino SDK versions are 9 digit numbers in the form of YYYYMMDDn.

Example:

```python
import rhinoscriptsyntax as rs
print("Required SDK Version: {}".format(rs.SdkVersion()))
```

## SearchPathCount

```python
rs.SearchPathCount()
```

Returns the number of path items in Rhino's search path list.
    See "Options Files settings" in the Rhino help file for more details.

Returns: number: the number of path items in Rhino's search path list

Example:

```python
import rhinoscriptsyntax as rs
count = rs.SearchPathCount()
if count>0:
    paths = rs.SearchPathList()
    for path in paths: print(path)
```

See also: AddSearchPath, DeleteSearchPath, SearchPathList

## SearchPathList

```python
rs.SearchPathList()
```

Returns all of the path items in Rhino's search path list.
    See "Options Files settings" in the Rhino help file for more details.

Returns: list of str: list of search paths

Example:

```python
import rhinoscriptsyntax as rs
count = rs.SearchPathCount()
if count>0:
    paths = rs.SearchPathList()
    for path in paths: print(path)
```

See also: AddSearchPath, DeleteSearchPath, SearchPathCount

## SendKeystrokes

```python
rs.SendKeystrokes(keys=None, add_return=True)
```

Sends a string of printable characters to Rhino's command line

Arguments:

    keys (str, optional): A string of characters to send to the command line.
    add_return (bool, optional): Append a return character to the end of the string. If omitted an return character will be added (True)

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.SendKeystroke( "Hello Rhino!" )
rs.SendKeystrokes( 25/4 )
```

See also: Command

## Snap

```python
rs.Snap(enable=None)
```

Enables or disables Rhino's grid snap modeling aid

Arguments:

    enable (bool, optional): The new enabled status. If omitted the current status is returned.

Returns: bool: the current grid snap status

Example:

```python
import rhinoscriptsyntax as rs
if not rs.Snap(): rs.Snap(True)
```

See also: Ortho, Osnap, Planar

## StatusBarDistance

```python
rs.StatusBarDistance(distance=0)
```

Sets Rhino's status bar distance pane

Arguments:

    distance (number, optional): The distance to set the status bar.  If omitted the distance will be set to 0.

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.StatusBarDistance(3.14159)
```

See also: StatusBarMessage, StatusBarPoint

## StatusBarMessage

```python
rs.StatusBarMessage(message=None)
```

Sets Rhino's status bar message pane

Arguments:

    message (str, optional): The message to display.

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
rs.StatusBarMessage("Hello Rhino!")
```

See also: StatusBarDistance, StatusBarPoint

## StatusBarPoint

```python
rs.StatusBarPoint(point=None)
```

Sets Rhino's status bar point coordinate pane

Arguments:

    point (point3d, optional): The 3d coordinates of the status bar.  If omitted the current poition is set to (0,0,0).

Returns: none

Example:

```python
import rhinoscriptsyntax as rs
pt = (1.1, 2.2, 3.3)
rs.StatusBarPoint(pt)
```

See also: StatusBarDistance, StatusBarMessage

## StatusBarProgressMeterHide

```python
rs.StatusBarProgressMeterHide()
```

Hide the progress meter

Returns: none

## StatusBarProgressMeterShow

```python
rs.StatusBarProgressMeterShow(label, lower, upper, embed_label=True, show_percent=True)
```

Start the Rhino status bar progress meter

Arguments:

    label (str): Short description of the progesss
    lower (str): Lower limit of the progress meter's range
    upper (str): Upper limit of the progress meter's range
    embed_label (bool, optional): If True, the label will show inside the meter.
                                  If false, the label will show to the left of the meter.
                                  If omitted the label will show inside the meter (True)
    show_percent (bool): Show the percent complete if True. If omitted the percnetage will be shown (True)

Returns: bool: True or False indicating success or failure

## StatusBarProgressMeterUpdate

```python
rs.StatusBarProgressMeterUpdate(position, absolute=True)
```

Set the current position of the progress meter

Arguments:

    position (number): The new position in the progress meter
    absolute (bool, optional): The position is set absolute (True) or relative (False) to its current position. If omitted the absolute (True) is used.

Returns: number: previous position setting.

## TemplateFile

```python
rs.TemplateFile(filename=None)
```

Returns or sets Rhino's default template file. This is the file used
    when Rhino starts.

Arguments:

    filename (str, optional): The name of the new default template file. If omitted the current default template name is returned.

Returns: str: if filename is not specified, then the current default template file
str: if filename is specified, then the previous default template file

Example:

```python
import rhinoscriptsyntax as rs
folder = rs.TemplateFolder()
filename = folder + "\\Millimeters.3dm"
rs.TemplateFile(filename)
```

See also: TemplateFolder

## TemplateFolder

```python
rs.TemplateFolder(folder=None)
```

Returns or sets the location of Rhino's template folder

Arguments:

    folder (str, optional): The location of Rhino's template files. Note, the location must exist.

Returns: str: if folder is not specified, then the current template file folder
str: if folder is specified, then the previous template file folder

Example:

```python
import rhinoscriptsyntax as rs
folder = rs.TemplateFolder()
filename = folder + "\\Millimeters.3dm"
rs.TemplateFile(filename)
```

See also: TemplateFile

## WindowHandle

```python
rs.WindowHandle()
```

Returns the windows handle of Rhino's main window

Returns: IntPt: the Window's handle of Rhino's main window. IntPtr is a platform-specific type that is used to represent a pointer or a handle.

Example:

```python
import rhinoscriptsyntax as rs
handle = rs.WindowHandle()
print(handle)
```

## WorkingFolder

```python
rs.WorkingFolder(folder=None)
```

Returns or sets Rhino's working folder (directory).
    The working folder is the default folder for all file operations.

Arguments:

    folder (str, optional): The new working folder for the current Rhino session.

Returns: str: if folder is not specified, then the current working folder
str: if folder is specified, then the previous working folder

Example:

```python
import rhinoscriptsyntax as  rs
folder = rs.WorkingFolder()
folder = rs.BrowseForFolder(folder,  "Directory", "Select Directory")
if folder is not None:
    rs.WorkingFolder(folder)
```

See also: BrowseForFolder
