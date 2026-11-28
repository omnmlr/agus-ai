import bpy
import math
import os
import sys
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(arguments) != 2:
    raise SystemExit('Usage: blender -b --python render-orbital-stage.py -- /path/to/mascot.png /path/to/stage.png')
mascot_path, stage_path = [os.path.abspath(argument) for argument in arguments]

def finish(name, color, metallic=0, roughness=.4, coat=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Coat Weight'].default_value = coat
    return mat

def apply(obj, name, mat, parent=None):
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    obj.parent = parent
    return obj

def rounded(name, xyz, size, radius, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    obj = apply(bpy.context.object, name, mat, parent)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Machined edge', 'BEVEL')
    bevel.width = radius
    bevel.segments = 5
    bevel.use_clamp_overlap = False
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return obj

def slab(name, yz, width, length, radius, thick, bevel, mat, parent):
    x0, z0, y0 = yz
    coords = []
    for angle, x, z in [(0,width/2-radius,length/2-radius),(90,-width/2+radius,length/2-radius),(180,-width/2+radius,-length/2+radius),(270,width/2-radius,-length/2+radius)]:
        for step in range(12):
            a = math.radians(angle + step*90/11)
            coords.append((x0+x+radius*math.cos(a), z0+z+radius*math.sin(a)))
    n=len(coords)
    vertices = [(x, y, z) for y in (y0-thick/2,y0+thick/2) for x,z in coords]
    faces=[tuple(range(n)),tuple(reversed(range(n,n*2)))]
    faces.extend((j,j+n,(j+1)%n+n,(j+1)%n) for j in range(n))
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    apply(obj,name,mat,parent)
    mod=obj.modifiers.new('Edge highlight','BEVEL')
    mod.width=bevel
    mod.segments=3
    obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    return obj

def cylinder(name, xyz, radius, depth, mat, parent=None, camera_axis=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=radius, depth=depth, location=xyz, rotation=(math.pi/2,0,0) if camera_axis else (0,0,0))
    obj=apply(bpy.context.object,name,mat,parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth=len(polygon.vertices)==4
    bevel=obj.modifiers.new('Bevel','BEVEL')
    bevel.width=min(.026,depth*.23)
    bevel.segments=4
    obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    return obj

metal=finish('Satin titanium',(.19,.193,.2),.83,.27,.2)
edge=finish('Polished bevel',(.39,.40,.42),.91,.18)
back=finish('Graphite ceramic',(.082,.084,.09),.52,.28,.32)
back_low=finish('Dark lower panel',(.036,.037,.041),.5,.31,.21)
glass=finish('Smoke optical glass',(.018,.019,.023),.53,.17,.48)
pupil=finish('Recessed lens',(.004,.005,.007),.36,.115,.6)
flash=finish('Diffused flash',(.415,.42,.42),.3,.38)
stage_metal=finish('Bead-blasted aluminum',(.13,.132,.138),.75,.36)
stage_top=finish('PVD graphite',(.049,.05,.052),.71,.32)
engraving=finish('Platinum mark',(.45,.455,.47),.71,.36)
floor=finish('Studio cyclorama',(.027,.028,.031),.15,.39)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.13))
apply(bpy.context.object,'Studio floor',floor)
cylinder('Base',(.0,0,-.005),2.83,.20,stage_metal)
cylinder('Polished seam',(.0,0,.08),2.84,.030,edge)
cylinder('Turntable',(.0,0,.14),2.76,.115,stage_top)
cylinder('Recessed top line',(.0,0,.202),2.36,.013,stage_metal)
cylinder('Top surface',(.0,0,.211),2.33,.014,stage_top)

for i in range(64):
    angle=math.tau*i/64
    r=2.53
    mark=rounded('Turntable index',(r*math.cos(angle),r*math.sin(angle),.199),(.085 if i%8==0 else .036,.009,.003),.001,engraving)
    mark.rotation_euler.z=angle

def rig(name, location, rotation):
    obj=bpy.data.objects.new(name,None)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=tuple(math.radians(a) for a in rotation)
    return obj

phone=rig('Seeker handset',(.77,.35,1.98),(3,17,-20))
slab('Titanium unibody',(0,0,0),1.67,3.63,.217,.182,.05,metal,phone)
slab('Rear cover',(0,0,-.093),1.62,3.58,.20,.041,.019,back,phone)
slab('Dark chin',(0,-1.20,-.116),1.45,1.02,.156,.012,.005,back_low,phone)
slab('Front glass',(0,0,.09),1.61,3.56,.20,.038,.015,glass,phone)
slab('Side rocker',(.837,.54,-.008),.065,.47,.031,.081,.012,edge,phone)
slab('Side key',(.837,-.025,-.008),.065,.28,.031,.081,.012,edge,phone)
slab('Camera pill',(-.501,.729,-.133),.382,.78,.184,.115,.041,metal,phone)
slab('Camera glass',(-.501,.729,-.199),.325,.718,.159,.039,.016,glass,phone)
for x,z,h,radius in [(-.514,1.395,-.17,.227),(-.50,.914,-.219,.117),(-.50,.56,-.219,.114)]:
    if radius>.2:
        cylinder('Main lens alloy mount',(x,h,z),radius,.13,metal,phone,True)
    cylinder('Lens rim',(x,h-.063,z),radius*.81,.052,edge,phone,True)
    cylinder('Optical cover',(x,h-.099,z),radius*.73,.026,glass,phone,True)
    cylinder('Inner lens',(x,h-.117,z),radius*.43,.019,pupil,phone,True)
    cylinder('Lens glint',(x-.019,h-.130,z+.022),radius*.18,.008,glass,phone,True)
cylinder('Flash',(-.091,-.126,1.02),.068,.022,flash,phone,True)

def text(name, body, size, loc, rotation, mat, parent=None):
    data=bpy.data.curves.new(name,'FONT')
    data.body=body
    data.size=size
    data.space_character=1.22
    data.align_x='CENTER'
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=rotation
    return apply(obj,name,mat,parent)
text('Handset model','S E E K E R',.082,(0,-.124,-1.40),(math.pi/2,0,0),engraving,phone)

camera_data=bpy.data.cameras.new('Stage camera')
camera=bpy.data.objects.new('Stage camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(.10,-10.7,4.6)
camera.rotation_euler=(Vector((0,0,1.54))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=7.65
scene.camera=camera

ghost_mat=bpy.data.materials.new('Approved orbital ghost render')
ghost_mat.use_nodes=True
nodes=ghost_mat.node_tree.nodes
links=ghost_mat.node_tree.links
nodes.clear()
photo=nodes.new('ShaderNodeTexImage')
photo.image=bpy.data.images.load(mascot_path)
emission=nodes.new('ShaderNodeEmission')
emission.inputs['Strength'].default_value=.89
links.new(photo.outputs['Color'],emission.inputs[0])
transparent=nodes.new('ShaderNodeBsdfTransparent')
mix=nodes.new('ShaderNodeMixShader')
links.new(photo.outputs['Alpha'],mix.inputs[0])
links.new(transparent.outputs[0],mix.inputs[1])
links.new(emission.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],nodes.new('ShaderNodeOutputMaterial').inputs[0])
bpy.ops.mesh.primitive_plane_add(size=2,location=(-1.12,-.63,1.63))
ghost=apply(bpy.context.object,'Original AGUS mascot',ghost_mat)
ghost.rotation_euler=camera.rotation_euler
ratio=photo.image.size[0]/photo.image.size[1]
ghost.scale=(1.18,1.18/ratio,1)

def light(name, loc, target, energy, size, length):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='RECTANGLE'
    data.size=size
    data.size_y=length
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

light('Large north softbox',(-3.0,-2.8,7.4),(0,0,1),680,5.0,2.1)
light('Right rear strip',(4.4,1.2,4.1),(.0,0,1.4),1000,1.7,5.8)
light('Lens pass',(-.8,-4.2,3.5),(.8,0,2),130,2.4,1.0)
light('Floor bounce',(-4,3,2),(0,0,.05),150,4,1)
scene.world=bpy.data.worlds.new('Dark studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.18

scene.render.engine='CYCLES'
scene.cycles.samples=int(os.environ.get('ORBITAL_SAMPLES', '78'))
scene.cycles.use_denoising=False
scene.render.threads_mode='FIXED'
scene.render.threads=12
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.render.resolution_x=1440
scene.render.resolution_y=1060
scene.render.resolution_percentage=int(os.environ.get('ORBITAL_SCALE','100'))
scene.render.image_settings.file_format='PNG'
scene.render.filepath=stage_path
bpy.ops.render.render(write_still=True)
