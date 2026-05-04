#!/usr/bin/env python3
"""
Simple SVG to PDC converter for Pebble smartwatches.
Scales coordinates by a given factor.
"""

import sys
import re
import struct
import xml.etree.ElementTree as ET

DRAW_COMMAND_TYPE_PATH = 1
DRAW_COMMAND_TYPE_PRECISE_PATH = 3

# Use PRECISE_PATH for better accuracy (coordinates scaled by 8)
USE_PRECISE_PATH = True
COORDINATE_SCALE = 8  # For precise paths

def convert_to_pebble_coords(point, scale=1.0):
    """Convert SVG coordinates to Pebble coordinates.

    For precise paths: translate by (-0.5, -0.5), then scale by 8.
    """
    x, y = point
    # Apply scale
    x = x * scale
    y = y * scale
    # Translate by -0.5, -0.5 (Pebble coordinate system)
    x = x - 0.5
    y = y - 0.5
    if USE_PRECISE_PATH:
        x = x * COORDINATE_SCALE
        y = y * COORDINATE_SCALE
    return (round(x), round(y))


def parse_svg_path(d):
    """Parse SVG path 'd' attribute into list of (x, y) points."""
    points = []
    d = d.strip()

    # Handle cases like "22-7.3333" where there's no space between numbers
    d = re.sub(r'(\d)(-)', r'\1 \2', d)
    tokens = re.findall(r'[MLHVCSQTAZmlhvcsqtaz]|-?\d+\.?\d*', d)

    i = 0
    current_x, current_y = 0, 0

    while i < len(tokens):
        cmd = tokens[i]

        if cmd in ('M', 'L'):
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                x = float(tokens[i])
                y = float(tokens[i+1])
                points.append((x, y))
                current_x, current_y = x, y
                i += 2
        elif cmd == 'm':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                dx = float(tokens[i])
                dy = float(tokens[i+1])
                current_x += dx
                current_y += dy
                points.append((current_x, current_y))
                i += 2
        elif cmd == 'l':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                dx = float(tokens[i])
                dy = float(tokens[i+1])
                current_x += dx
                current_y += dy
                points.append((current_x, current_y))
                i += 2
        elif cmd == 'v':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                dy = float(tokens[i])
                current_y += dy
                points.append((current_x, current_y))
                i += 1
        elif cmd == 'V':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                current_y = float(tokens[i])
                points.append((current_x, current_y))
                i += 1
        elif cmd == 'h':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                dx = float(tokens[i])
                current_x += dx
                points.append((current_x, current_y))
                i += 1
        elif cmd == 'H':
            i += 1
            while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                current_x = float(tokens[i])
                points.append((current_x, current_y))
                i += 1
        elif cmd in ('Z', 'z'):
            i += 1
        elif cmd in ('C', 'c', 'S', 's', 'Q', 'q', 'T', 't', 'A', 'a'):
            # Skip curve commands (not fully supported)
            i += 1
            if cmd in ('C', 'c'):
                while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                    i += 6
            else:
                while i < len(tokens) and tokens[i] not in 'MLHVCSQTAZmlhvcsqtaz':
                    i += 4
        else:
            i += 1

    return points


def parse_color(color_str):
    """Parse hex color to Pebble 8-bit ARGB color value.

    Pebble color format (8-bit): aarrggbb
    - Bits 7-6 (a): Alpha (11 = fully opaque)
    - Bits 5-4 (r): Red (2-bit)
    - Bits 3-2 (g): Green (2-bit)
    - Bits 1-0 (b): Blue (2-bit)
    """
    if color_str is None or color_str == 'none':
        return 0

    if color_str.startswith('#'):
        hex_val = color_str.lstrip('#')
        if len(hex_val) == 3:
            r = int(hex_val[0] * 2, 16)
            g = int(hex_val[1] * 2, 16)
            b = int(hex_val[2] * 2, 16)
        else:
            r = int(hex_val[0:2], 16)
            g = int(hex_val[2:4], 16)
            b = int(hex_val[4:6], 16)

        # Convert to 2-bit each, with full alpha (a=3 = opaque)
        # Format: aarrggbb where each field is 2 bits
        a = 0b11  # Full alpha
        return (a << 6) | ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6)

    return 0


def serialize_path_command(points, stroke_color, stroke_width, fill_color, is_open):
    """Serialize a path command to PDC binary format."""
    # Command type
    cmd_type = DRAW_COMMAND_TYPE_PRECISE_PATH if USE_PRECISE_PATH else DRAW_COMMAND_TYPE_PATH
    data = struct.pack('B', cmd_type)
    # Reserved byte, stroke color, stroke width, fill color
    data += struct.pack('<BBBB', 0, stroke_color, stroke_width, fill_color)
    # Open path flag
    data += struct.pack('<BB', int(is_open), 0)
    # Number of points
    data += struct.pack('<H', len(points))
    # Points
    for x, y in points:
        data += struct.pack('<hh', int(x), int(y))
    return data


def svg_to_pdc(svg_path, pdc_path, scale=1.0, target_size=None):
    """Convert SVG to PDC with optional scaling.

    Args:
        svg_path: Path to input SVG file
        pdc_path: Path to output PDC file
        scale: Scale factor (ignored if target_size is provided)
        target_size: Tuple of (width, height) for target size, or None to use scale
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()

    # Get viewBox dimensions
    viewbox = root.get('viewBox')
    if viewbox:
        parts = viewbox.split()
        vb_width = float(parts[2])
        vb_height = float(parts[3])
    else:
        vb_width = float(root.get('width', 100))
        vb_height = float(root.get('height', 100))

    # Calculate scale from target size if provided
    if target_size:
        target_width, target_height = target_size
        scale_x = target_width / vb_width
        scale_y = target_height / vb_height
        # Use the smaller scale to maintain aspect ratio
        scale = min(scale_x, scale_y)

    commands = []

    def process_element(elem, inherited_stroke='#000', inherited_fill='#fff', inherited_stroke_width=4):
        """Recursively process SVG elements."""
        nonlocal commands

        # Skip elements with display:none
        style = elem.get('style', '')
        if 'display:none' in style or elem.get('display') == 'none':
            return

        # Parse CSS style declarations
        style_map = {}
        if style:
            for declaration in style.split(';'):
                declaration = declaration.strip()
                if ':' in declaration:
                    prop, val = declaration.split(':', 1)
                    style_map[prop.strip()] = val.strip()

        stroke = elem.get('stroke', style_map.get('stroke', inherited_stroke))
        fill = elem.get('fill', style_map.get('fill', inherited_fill))
        stroke_width = int(float(elem.get('stroke-width', style_map.get('stroke-width', inherited_stroke_width))))

        tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag

        if tag == 'path':
            d = elem.get('d')
            if d:
                points = parse_svg_path(d)
                if points:
                    # Convert to Pebble coordinates with scale
                    points = [convert_to_pebble_coords(p, scale) for p in points]

                    stroke_color = parse_color(stroke)
                    fill_color = parse_color(fill)
                    is_open = 'z' not in d.lower()

                    cmd = serialize_path_command(points, stroke_color, stroke_width, fill_color, is_open)
                    commands.append(cmd)

        # Process children
        for child in elem:
            process_element(child, stroke, fill, stroke_width)

    process_element(root)

    # Build PDC file
    # Header: version, reserved, width, height
    width = int(round(vb_width * scale))
    height = int(round(vb_height * scale))
    if target_size:
        width, height = target_size

    header = struct.pack('<BBhh', 1, 0, width, height)

    # Number of commands
    cmd_data = struct.pack('<H', len(commands))
    for cmd in commands:
        cmd_data += cmd

    # Full image data
    image_data = header + cmd_data

    # PDCI header
    pdc = b'PDCI'
    pdc += struct.pack('<I', len(image_data))
    pdc += image_data

    with open(pdc_path, 'wb') as f:
        f.write(pdc)

    print(f"Created {pdc_path}: {len(commands)} commands, size {width}x{height}")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Convert SVG to PDC (Pebble Draw Commands)')
    parser.add_argument('input', help='Input SVG file')
    parser.add_argument('output', help='Output PDC file')
    parser.add_argument('-s', '--scale', type=float, default=1.0,
                        help='Scale factor (default: 1.0)')
    parser.add_argument('-W', '--width', type=int,
                        help='Target width in pixels (calculates scale automatically)')
    parser.add_argument('-H', '--height', type=int,
                        help='Target height in pixels (calculates scale automatically)')

    args = parser.parse_args()

    # Get SVG dimensions to calculate scale if width/height specified
    if args.width or args.height:
        tree = ET.parse(args.input)
        root = tree.getroot()
        viewbox = root.get('viewBox')
        if viewbox:
            parts = viewbox.split()
            vb_width = float(parts[2])
            vb_height = float(parts[3])
        else:
            vb_width = float(root.get('width', 100))
            vb_height = float(root.get('height', 100))

        if args.width and args.height:
            # Use the smaller scale to fit within both dimensions
            scale_w = args.width / vb_width
            scale_h = args.height / vb_height
            scale = min(scale_w, scale_h)
        elif args.width:
            scale = args.width / vb_width
        else:
            scale = args.height / vb_height
    else:
        scale = args.scale

    svg_to_pdc(args.input, args.output, scale)