# Blender icon batch renderer for Xingyu.
# Usage:
#   blender --background --python tools/blender_icons.py -- --input assets/icons3d/svg --output assets/icons3d
#
# It imports each SVG as a curve, adds a glass-like material, centers and renders
# a transparent 512x512 PNG. The web app keeps an SVG fallback when renders are absent.
import argparse
import os
import sys

import bpy
from math import radians
from mathutils import Vector


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def setup_scene(output_path, name):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.filepath = os.path.join(output_path, f"{name}.png")
    return scene


def add_environment():
    world = bpy.data.worlds.get("XingyuIconWorld") or bpy.data.worlds.new("XingyuIconWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.04, 0.06, 0.09, 1.0)
        bg.inputs[1].default_value = 0.7

    key = bpy.data.lights.new("Key", type="AREA")
    key.energy = 900
    key.size = 6
    key_obj = bpy.data.objects.new("Key", key)
    key_obj.location = (4, -5, 6)
    key_obj.rotation_euler = (radians(45), 0, radians(35))
    bpy.context.collection.objects.link(key_obj)

    rim = bpy.data.lights.new("Rim", type="AREA")
    rim.energy = 450
    rim.size = 4
    rim_obj = bpy.data.objects.new("Rim", rim)
    rim_obj.location = (-5, 3, 4)
    rim_obj.rotation_euler = (radians(50), 0, radians(-120))
    bpy.context.collection.objects.link(rim_obj)


def add_glass_material():
    mat = bpy.data.materials.new("XingyuGlass")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    glass = nodes.new("ShaderNodeBsdfGlass")
    glass.inputs[0].default_value = (0.86, 0.95, 1.0, 1.0)
    glass.inputs[1].default_value = 0.08
    glass.inputs[2].default_value = 1.45
    gloss = nodes.new("ShaderNodeBsdfGlossy")
    gloss.inputs[0].default_value = (0.9, 0.96, 1.0, 1.0)
    gloss.inputs[1].default_value = 0.12
    mix = nodes.new("ShaderNodeMixShader")
    fresnel = nodes.new("ShaderNodeFresnel")
    fresnel.inputs[1].default_value = 1.45
    links.new(fresnel.outputs[0], mix.inputs[0])
    links.new(glass.outputs[0], mix.inputs[1])
    links.new(gloss.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])
    return mat


def center_and_scale(targets):
    minv = Vector((1e9, 1e9, 1e9))
    maxv = Vector((-1e9, -1e9, -1e9))
    for ob in targets:
        for corner in ob.bound_box:
            wc = ob.matrix_world @ Vector(corner)
            minv = Vector(map(min, minv, wc))
            maxv = Vector(map(max, maxv, wc))
    center = (minv + maxv) / 2
    dims = maxv - minv
    scale = 1.7 / max(0.001, max(dims))
    for ob in targets:
        ob.location -= center
        ob.scale = (ob.scale[0] * scale, ob.scale[1] * scale, ob.scale[2] * scale)
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def render_one(svg_path, output_path, mat):
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=svg_path)
    imported = list(set(bpy.data.objects) - before)
    curves = [ob for ob in imported if ob.type == "CURVE"]
    if not curves:
        for ob in imported:
            bpy.data.objects.remove(ob)
        return False
    bpy.ops.object.select_all(action="DESELECT")
    for ob in curves:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target="MESH")
    meshes = [ob for ob in bpy.data.objects if ob.type == "MESH" and ob.select_get()]
    if not meshes:
        return False
    for ob in meshes:
        solid = ob.modifiers.new("Depth", type="SOLIDIFY")
        solid.thickness = 0.12
        bevel = ob.modifiers.new("Soft", type="BEVEL")
        bevel.width = 0.015
        bevel.segments = 3
        ob.data.materials.append(mat)
    center_and_scale(meshes)

    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    cam.location = (0, -3.6, 0.2)
    cam.rotation_euler = (radians(88), 0, 0)
    cam.data.lens = 55
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    bpy.context.scene.render.filepath = os.path.join(
        output_path, os.path.splitext(os.path.basename(svg_path))[0] + ".png"
    )
    bpy.ops.render.render(write_still=True)
    for ob in meshes + [cam]:
        bpy.data.objects.remove(ob)
    return True


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    os.makedirs(args.output, exist_ok=True)
    clean_scene()
    add_environment()
    mat = add_glass_material()
    done, failed = 0, []
    for file in sorted(os.listdir(args.input)):
        if file.lower().endswith(".svg"):
            clean_scene()
            add_environment()
            mat = add_glass_material()
            try:
                if render_one(os.path.join(args.input, file), args.output, mat):
                    done += 1
                else:
                    failed.append(file)
            except Exception as exc:
                failed.append(f"{file}: {exc}")
    print(f"Rendered {done} icons. Failed: {failed or 'none'}")


if __name__ == "__main__":
    main()
