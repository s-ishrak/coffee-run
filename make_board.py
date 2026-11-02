from pathlib import Path
from PIL import Image, ImageDraw

root = Path('asset-source/ModernOffice2DProps_v1.0/Tiles')
im = Image.new('RGBA', (1200, 720), '#f0e7d8')
d = ImageDraw.Draw(im)

# Draw the office architecture into a single scene. The five workstations align
# with the collision rectangles on the server; edge decorations leave routes open.
for y in range(0, 720, 72):
    d.line((0, y, 1200, y), fill='#e1d5c4', width=2)
    for x in range(-80 if y // 72 % 2 else 0, 1200, 160):
        d.line((x, y, x, y + 72), fill='#e5daca', width=1)
d.rectangle((0, 0, 1200, 17), fill='#cbd6c3')
d.line((0, 17, 1200, 17), fill='#9aad98', width=3)
d.rounded_rectangle((399, 206, 801, 446), radius=38, fill='#d9e4d0', outline='#c1d0ba', width=3)
for x in [205, 760]:
    for y in [110, 445]:
        d.rounded_rectangle((x, y, x + 225, y + 160), radius=18, fill='#e9ddd0', outline='#d8cabb', width=2)

def asset(name, box, flip=False):
    files = list(root.rglob(name))
    if not files:
        raise FileNotFoundError(name)
    sprite = Image.open(files[0]).convert('RGBA')
    if flip:
        sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    sprite.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
    im.alpha_composite(sprite, (box[0] + (box[2] - sprite.width) // 2, box[1] + (box[3] - sprite.height) // 2))

# Each workstation has its own mix of office equipment, files and plants.
workstations = [(260, 155, 125, 75), (815, 155, 125, 75), (260, 490, 125, 75), (815, 490, 125, 75)]
for i, (x, y, w, h) in enumerate(workstations):
    asset('office_furniture_chair_task_01.png', (x + 43, y + 42, 45, 55))
    asset('office_furniture_desk_straight_01.png', (x - 2, y - 13, w + 4, h + 24))
    asset('office_electronics_laptop_open_off_01.png', (x + 37, y - 1, 43, 38))
    asset('office_props_pen_cup_01.png', (x + 9, y + 9, 18, 20))
    asset(('office_props_notebook_closed_01.png' if i % 2 else 'office_props_papers_stack_01.png'), (x + 87, y + 8, 25, 19))
    asset('office_props_succulent_small_01.png', (x + 103, y - 3, 20, 22))
    asset('office_electronics_lamp_desk_01.png', (x + 4, y - 4, 27, 30))
    asset('office_props_mug_01.png', (x + 73, y + 6, 15, 16))

# A meeting table in the centre, furnished only inside its collision area.
x, y, w, h = 485, 262, 230, 120
asset('office_furniture_desk_straight_01.png', (x, y - 8, w, h + 20))
asset('office_electronics_laptop_open_off_01.png', (x + 85, y + 3, 52, 44))
asset('office_props_clipboard_blank_01.png', (x + 35, y + 14, 30, 28))
asset('office_props_mug_01.png', (x + 156, y + 12, 21, 23))
asset('office_props_papers_stack_01.png', (x + 174, y + 18, 28, 22))
asset('office_props_water_bottle_01.png', (x + 59, y + 10, 18, 25))
asset('office_props_headphones_01.png', (x + 132, y + 20, 25, 20))

# The outer edge reads as an office perimeter without blocking player routes.
for x, y in [(10, 230), (1130, 230), (10, 420), (1130, 420)]:
    asset('office_decor_plant_broadleaf_01.png', (x, y, 58, 75))
for x in [380, 760]:
    asset('office_furniture_cabinet_filing_tall_01.png', (x, 13, 55, 65))
asset('office_electronics_copier_multifunction_01.png', (455, 12, 54, 62))
asset('office_decor_refrigerator_compact_01.png', (700, 13, 45, 62))
asset('office_decor_bin_recycling_01.png', (355, 622, 40, 46))
asset('office_decor_bin_waste_01.png', (795, 622, 40, 46))
asset('office_decor_plant_snake_01.png', (460, 618, 44, 65))
asset('office_decor_plant_snake_01.png', (696, 618, 44, 65))
asset('office_electronics_printer_small_01.png', (529, 16, 48, 36))
asset('office_props_archive_box_01.png', (620, 19, 43, 36))
for x, name in [(292, 'office_decor_artwork_abstract_01.png'), (847, 'office_decor_artwork_abstract_01.png'),
                (232, 'office_electronics_clock_wall_01.png'), (905, 'office_electronics_clock_wall_01.png')]:
    asset(name, (x, 17, 38, 40))
for x, y, name in [(95, 240, 'office_decor_stand_umbrella_01.png'),
                    (1057, 240, 'office_electronics_shredder_01.png'),
                    (100, 441, 'office_furniture_cabinet_filing_tall_01.png'),
                    (1055, 441, 'office_electronics_copier_multifunction_01.png')]:
    asset(name, (x, y, 46, 60))
for x, y in [(215, 113), (379, 113), (770, 113), (934, 113),
             (215, 451), (379, 451), (770, 451), (934, 451)]:
    asset('office_decor_partition_fabric_01.png', (x, y, 40, 37))
im.convert('RGB').save('public/office.jpg', quality=89, optimize=True)

# Pack the free character samples into the game's compact animated atlas.
characters = ['office_m_b', 'office_f_c', 'casual_f_b', 'teen_m_a', 'teen_f_a']
atlas = Image.new('RGBA', (9 * 64, 15 * 64))
for index, character in enumerate(characters):
    folder = next(Path('asset-source/characters').rglob('char_citizens_' + character))
    for direction, name in enumerate(['down', 'up', 'side']):
        for frame in range(9):
            filename = f'walk_{name}_{frame:02}.png' if frame < 8 else f'stand_{name}.png'
            sprite = Image.open(folder / filename).convert('RGBA').resize((64, 64), Image.Resampling.LANCZOS)
            atlas.alpha_composite(sprite, (frame * 64, (index * 3 + direction) * 64))
atlas.save('public/players.png', optimize=True)
