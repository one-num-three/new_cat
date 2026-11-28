"""Shared PCB geometry in the Strap-Halo mechanical datum, in millimetres."""

from math import pi, sqrt

PCB_WIDTH = 28.4
PCB_LENGTH = 35.4
PCB_CORNER_RADIUS = 6.2
PCB_BOTTOM_Z = 29.65
PCB_THICKNESS = 1.0
PCB_TOP_Z = PCB_BOTTOM_Z + PCB_THICKNESS
M2_NOTCH_X = (-12.6, 12.6)
M2_NOTCH_Y = 11.0
M2_NOTCH_RADIUS = 2.1

# The lip preserves 0.35 mm to the nominal closest MINI-1 land. The side rails
# preserve the 35.4 mm bounding length and the rear cable corridor.
RF_CUT_X = (-8.9, 5.5)
RF_CUT_Y = (-20.0, -12.15)
RF_CUT_RADIUS = 0.6
RF_COPPER_KEEP_OUT = (-8.9, 8.3, -17.7, -11.83)

MINI_CENTER = (-1.7, -9.2)
MINI_NOMINAL = (13.2, 16.6, 2.4)
MINI_MAX_HEIGHT = 2.55
MINI_SOLDER_ALLOWANCE = 0.10
NFC_STACK_LIFT = 0.35
FERRITE_BOTTOM_Z = 33.75 + NFC_STACK_LIFT

BUZZER_CENTER = (10.13, -6.30)
BUZZER_HEIGHT = 1.90
BUTTON_CENTER = (12.25, 1.50)
NFC_CRYSTAL_CENTER = (-12.30, 6.20)

POGO_X = (-3.81, -1.27, 1.27, 3.81)
POGO_Y = 14.8
POGO_SIGNALS = ("+5V", "GND", "USB_DN_EXT", "USB_DP_EXT")
POGO_FLEX_WIDTH = 9.60
POGO_FLEX_THICKNESS = 0.12
POGO_FLEX_RADIUS = 1.20
POGO_FLEX_END_Y = 13.80
POGO_FLEX_RISER_Y = 18.55
POGO_FLEX_BOTTOM_Z = 24.96
POGO_FLEX_TOP_Z = PCB_BOTTOM_Z - POGO_FLEX_THICKNESS / 2 - 0.01
POGO_FLEX_TANGENT_Y = POGO_FLEX_RISER_Y - POGO_FLEX_RADIUS
POGO_FLEX_FLAT_LENGTH = (
    2 * (POGO_FLEX_TANGENT_Y - POGO_FLEX_END_Y)
    + POGO_FLEX_TOP_Z - POGO_FLEX_BOTTOM_Z - 2 * POGO_FLEX_RADIUS
    + pi * POGO_FLEX_RADIUS
)


def pogo_flex_envelope():
    """Sweep the flex through two tangent static bends outside the motor rim."""
    from build123d import Edge, Face, Plane, Vector, Wire, sweep

    r = POGO_FLEX_RADIUS
    tangent = POGO_FLEX_TANGENT_Y
    riser = POGO_FLEX_RISER_Y
    low = POGO_FLEX_BOTTOM_Z
    high = POGO_FLEX_TOP_Z
    end = POGO_FLEX_END_Y
    legs = (
        Edge.make_line((0, end, low), (0, tangent, low)),
        Edge.make_three_point_arc(
            (0, tangent, low), (0, tangent + r / sqrt(2), low + r - r / sqrt(2)), (0, riser, low + r),
        ),
        Edge.make_line((0, riser, low + r), (0, riser, high - r)),
        Edge.make_three_point_arc(
            (0, riser, high - r), (0, tangent + r / sqrt(2), high - r + r / sqrt(2)), (0, tangent, high),
        ),
        Edge.make_line((0, tangent, high), (0, end, high)),
    )
    section = Face.make_rect(
        POGO_FLEX_WIDTH, POGO_FLEX_THICKNESS,
        Plane(origin=Vector(0, end, low), x_dir=(1, 0, 0), z_dir=(0, 1, 0)),
    )
    return sweep(section, Wire(legs), is_frenet=False)


def board_substrate():
    from build123d import BuildPart, BuildSketch, Cylinder, Locations, Mode, Plane, RectangleRounded, extrude

    with BuildPart() as board:
        with BuildSketch(Plane.XY.offset(PCB_BOTTOM_Z)):
            RectangleRounded(PCB_WIDTH, PCB_LENGTH, PCB_CORNER_RADIUS)
        extrude(amount=PCB_THICKNESS)
        for x in M2_NOTCH_X:
            with Locations((x, M2_NOTCH_Y, PCB_BOTTOM_Z + PCB_THICKNESS / 2)):
                Cylinder(M2_NOTCH_RADIUS, PCB_THICKNESS + 0.4, mode=Mode.SUBTRACT)
        left, right = RF_CUT_X
        bottom, top = RF_CUT_Y
        with BuildSketch(Plane.XY.offset(PCB_BOTTOM_Z - 0.2)):
            with Locations(((left + right) / 2, (bottom + top) / 2)):
                RectangleRounded(right - left, top - bottom, RF_CUT_RADIUS)
        extrude(amount=PCB_THICKNESS + 0.4, mode=Mode.SUBTRACT)
    return board.part


def board_outline():
    """Translate the exact B-Rep perimeter into KiCad line/three-point arc geometry."""
    from build123d import Axis, GeomType

    top = board_substrate().faces().sort_by(Axis.Z)[-1]
    segments = []
    for edge in top.outer_wire().order_edges():
        if edge.geom_type == GeomType.LINE:
            parameters = (0, 1)
        elif edge.geom_type == GeomType.CIRCLE:
            parameters = (0, 0.5, 1)
        else:
            raise ValueError(f"Unexpected PCB outline curve: {edge.geom_type}")
        points = [edge.position_at(fraction) for fraction in parameters]
        segments.append([(round(point.X, 6), round(point.Y, 6)) for point in points])
    return segments
