# Plain ring band
# This is RhinoScript (Python 2.7) that Rhino runs; millimetres, Z up. Every run replaces what the previous run made.
# Parameters: the top-level "name = number" lines. The slider range is the [min:step:max] in the comment.
import rhinoscriptsyntax as rs

ring_size_mm = 17.3   # inner diameter (EU 54) [14:0.1:24]
band_width   = 2.4    # [1.2:0.1:6]
band_thick   = 1.6    # [1.2:0.1:3]

# Finger axis along Y: the band is a tube around the Y axis
r_in = ring_size_mm / 2.0
r_out = r_in + band_thick
outer = rs.AddCylinder(rs.PlaneFromNormal((0, -band_width / 2.0, 0), (0, 1, 0)), band_width, r_out)
bore = rs.AddCylinder(rs.PlaneFromNormal((0, -band_width, 0), (0, 1, 0)), band_width * 2, r_in)
band = rs.BooleanDifference([outer], [bore])[0]
rs.ObjectName(band, "band")
