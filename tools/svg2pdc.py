#!/usr/bin/env python3
"""
Simple SVG to PDC converter for Pebble Draw Commands.
Converts SVG images to PDC binary format.
"""

import xml.etree.ElementTree as ET
import struct
import sys
import re

try:
    import svg.path
except ImportError:
    print("Error: svg.path module required. Install with: pip install svg.path")
    sys.exit(1)

DRAW_COMMAND_TYPE_PATH = 1
DRAW_COMMAND_TYPE_CIRCLE = 2
DRAW_COMMAND_TYPE_PRECISE_PATH = 3

xmlns = '{http://www.w3.org/2000/svg}'


def sum_points(p1, p2):
    return p1[0] + p2[0], p1[1] + p2[1]


def round_point(p):
    return round(p[0]), round(p[1])


def find_nearest_valid_point(p):
    return round(p[0] * 2.0) / 2.0, round(p[1] * 2.0) / 2.0


def convert_to_pebble_coordinates(point):
    nearest = find_nearest_valid_point(point)
    translated = sum_points(point, (-0.5, -0.5))
    rounded = round_point(translated)
    return rounded


def parse_color(color, opacity):
    if color is None or color[0] != '#':
        return 0

    rgb = int(color[1:7], 16)
    a = int(opacity * 255)

    # Convert to ARGB8 format (Pebble color)
    r = (rgb >> 16) & 0xFF
    g = (rgb >> 8) & 0xFF
    b = rgb & 0xFF

    # Map to Pebble's 64-color palette
    r = (r * 3) // 255
    g = (g * 3) // 255
    b = (b * 3) // 255
    a_val = 1 if a > 127 else 0

    return (a_val << 7) | (r << 4) | (g << 2) | b


def get_points_from_str(point_str):
    points = []
    for p in point_str.split():
        pair = p.split(',')
        try:
            points.append((float(pair[0]), float(pair[1])))
        except (ValueError, TypeError):
            return None
    return points


class PathCommand:
    def __init__(self, points, path_open, translate, stroke_width=0, stroke_color=0, fill_color=0):
        self.open = path_open
        self.type = DRAW_COMMAND_TYPE_PATH
        self.points = [convert_to_pebble_coordinates(sum_points(p, translate)) for p in points]
        self.stroke_width = stroke_width
        self.stroke_color = stroke_color
        self.fill_color = fill_color

    def serialize(self):
        s = struct.pack('B', self.type)
        s += struct.pack('<BBBB', 0, self.stroke_color, self.stroke_width, self.fill_color)
        s += struct.pack('<BB', int(self.open), 0)
        s += struct.pack('H', len(self.points))
        for p in self.points:
            s += struct.pack('<hh', int(p[0]), int(p[1]))
        return s


class CircleCommand:
    def __init__(self, center, radius, translate, stroke_width=0, stroke_color=0, fill_color=0):
        points = [(center[0], center[1])]
        self.points = [convert_to_pebble_coordinates(sum_points(p, translate)) for p in points]
        self.radius = int(radius)
        self.stroke_width = stroke_width
        self.stroke_color = stroke_color
        self.fill_color = fill_color

    def serialize(self):
        s = struct.pack('B', DRAW_COMMAND_TYPE_CIRCLE)
        s += struct.pack('<BBBB', 0, self.stroke_color, self.stroke_width, self.fill_color)
        s += struct.pack('H', self.radius)
        s += struct.pack('H', len(self.points))
        for p in self.points:
            s += struct.pack('<hh', int(p[0]), int(p[1]))
        return s


def parse_path(element, translate, stroke_width, stroke_color, fill_color):
    d = element.get('d')
    if d is not None:
        path = svg.path.parse_path(d)
        points = [(line.start.real, line.start.imag) for line in path]
        if not points:
            return None

        path_open = path[-1].end != path[0].start
        if path_open:
            points.append((path[-1].end.real, path[-1].end.imag))

        if points[0] == points[-1]:
            points = points[:-1]

        return PathCommand(points, path_open, translate, stroke_width, stroke_color, fill_color)
    return None


def parse_circle(element, translate, stroke_width, stroke_color, fill_color):
    cx = element.get('cx')
    cy = element.get('cy')
    radius = element.get('r') or element.get('z')

    if cx is not None and cy is not None and radius is not None:
        try:
            center = (float(cx), float(cy))
            radius = float(radius)
            return CircleCommand(center, radius, translate, stroke_width, stroke_color, fill_color)
        except ValueError:
            return None
    return None


def parse_polyline(element, translate, stroke_width, stroke_color, fill_color):
    points = get_points_from_str(element.get('points'))
    if not points:
        return None
    return PathCommand(points, True, translate, stroke_width, stroke_color, fill_color)


def parse_polygon(element, translate, stroke_width, stroke_color, fill_color):
    points = get_points_from_str(element.get('points'))
    if not points:
        return None
    return PathCommand(points, False, translate, stroke_width, stroke_color, fill_color)


def parse_line(element, translate, stroke_width, stroke_color, fill_color):
    try:
        points = [
            (float(element.get('x1')), float(element.get('y1'))),
            (float(element.get('x2')), float(element.get('y2')))
        ]
    except (TypeError, ValueError):
        return None
    return PathCommand(points, True, translate, stroke_width, stroke_color, fill_color)


def parse_rect(element, translate, stroke_width, stroke_color, fill_color):
    try:
        origin = (float(element.get('x') or 0), float(element.get('y') or 0))
        width = float(element.get('width'))
        height = float(element.get('height'))
    except (ValueError, TypeError):
        return None

    points = [
        origin,
        sum_points(origin, (width, 0)),
        sum_points(origin, (width, height)),
        sum_points(origin, (0, height))
    ]
    return PathCommand(points, False, translate, stroke_width, stroke_color, fill_color)


svg_parsers = {
    'path': parse_path,
    'circle': parse_circle,
    'polyline': parse_polyline,
    'polygon': parse_polygon,
    'line': parse_line,
    'rect': parse_rect,
}


def get_viewbox(root):
    viewBox = root.get('viewBox')
    if viewBox:
        coords = viewBox.split()
        return (float(coords[0]), float(coords[1])), (float(coords[2]), float(coords[3]))
    else:
        width = float(root.get('width', 0))
        height = float(root.get('height', 0))
        return (0, 0), (width, height)


def parse_style(style):
    attrs = {}
    if style:
        for item in style.split(';'):
            if ':' in item:
                key, val = item.split(':', 1)
                attrs[key.strip()] = val.strip()
    return attrs


def create_command(element, translate):
    # Get style attributes
    style = parse_style(element.get('style', ''))

    # Get colors and stroke width
    stroke = style.get('stroke', element.get('stroke', '#000'))
    stroke_opacity = float(style.get('stroke-opacity', element.get('stroke-opacity', 1)))
    fill = style.get('fill', element.get('fill'))
    fill_opacity = float(style.get('fill-opacity', element.get('fill-opacity', 1)))
    opacity = float(element.get('opacity', 1))

    try:
        stroke_width = int(float(style.get('stroke-width', element.get('stroke-width', 1))))
    except (TypeError, ValueError):
        stroke_width = 1

    stroke_color = parse_color(stroke, stroke_opacity * opacity)
    fill_color = parse_color(fill, fill_opacity * opacity)

    if stroke_color == 0 and fill_color == 0:
        return None
    if stroke_color == 0:
        stroke_width = 0
    elif stroke_width == 0:
        stroke_color = 0

    tag = element.tag
    if tag.startswith(xmlns):
        tag = tag[len(xmlns):]

    parser = svg_parsers.get(tag)
    if parser:
        return parser(element, translate, stroke_width, stroke_color, fill_color)
    return None


def get_commands(translate, element):
    commands = []

    tag = element.tag
    if tag.startswith(xmlns):
        tag = tag[len(xmlns):]

    if tag in ('g', 'layer'):
        # Process children
        for child in element:
            child_commands = get_commands(translate, child)
            commands.extend(child_commands)
    else:
        cmd = create_command(element, translate)
        if cmd:
            commands.append(cmd)

    return commands


def parse_svg(filename):
    tree = ET.parse(filename)
    root = tree.getroot()

    viewbox_origin, viewbox_size = get_viewbox(root)
    translate = (-viewbox_origin[0], -viewbox_origin[1])

    commands = get_commands(translate, root)
    return viewbox_size, commands


def serialize_image(commands, size):
    # Header
    s = struct.pack('<BBhh', 1, 0, int(round(size[0])), int(round(size[1])))
    # Number of commands
    s += struct.pack('H', len(commands))
    # Serialize each command
    for cmd in commands:
        s += cmd.serialize()

    # PDC file format
    output = b'PDCI'
    output += struct.pack('I', len(s))
    output += s
    return output


def convert_svg_to_pdc(svg_path, pdc_path):
    size, commands = parse_svg(svg_path)
    output = serialize_image(commands, size)

    with open(pdc_path, 'wb') as f:
        f.write(output)

    print(f"Converted {svg_path} -> {pdc_path} (size: {int(size[0])}x{int(size[1])})")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: svg2pdc.py <input.svg> [output.pdc]")
        sys.exit(1)

    svg_path = sys.argv[1]
    if len(sys.argv) >= 3:
        pdc_path = sys.argv[2]
    else:
        pdc_path = svg_path.rsplit('.', 1)[0] + '.pdc'

    convert_svg_to_pdc(svg_path, pdc_path)