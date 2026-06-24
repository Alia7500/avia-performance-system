# ГОСТ-подобная отрисовка алгоритмов для ВКР Жердевой В.
# Запуск:
#   pip install matplotlib
#   python gost_algorithms_python.py
# Результат появится в папке ./gost_algorithms_out: PNG, SVG и файл .drawio.

from __future__ import annotations

import html
import math
import os
import textwrap
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Polygon, Ellipse, FancyArrowPatch, Arc

BASE = Path('gost_algorithms_out')
PY_OUT = BASE / 'python_output'
DX_OUT = BASE / 'drawio_pages_xml'
for p in [BASE, PY_OUT, DX_OUT]:
    p.mkdir(parents=True, exist_ok=True)

PAGE_W = 210.0
PAGE_H = 297.0
MARGIN = 5.0
STAMP_H = 30.0
STAMP_TOP_Y = PAGE_H - MARGIN - STAMP_H  # y from top coordinate
DRAWIO_SCALE = 4.0

@dataclass
class Block:
    id: str
    kind: str
    text: str
    x: float
    y: float
    w: float
    h: float
    fs: float = 6.7

@dataclass
class Edge:
    points: List[Tuple[float, float]]
    label: str = ''
    fs: float = 6.2

@dataclass
class Diagram:
    key: str
    title: str
    doc_code: str
    sheet_no: int
    blocks: List[Block] = field(default_factory=list)
    edges: List[Edge] = field(default_factory=list)
    note: str = ''


def anchor(blocks: Dict[str, Block], block_id: str, side: str) -> Tuple[float, float]:
    b = blocks[block_id]
    if side == 'top':
        return b.x, b.y - b.h / 2
    if side == 'bottom':
        return b.x, b.y + b.h / 2
    if side == 'left':
        return b.x - b.w / 2, b.y
    if side == 'right':
        return b.x + b.w / 2, b.y
    if side == 'center':
        return b.x, b.y
    raise ValueError(side)


def edge_between(blocks: Dict[str, Block], a: str, b: str, label: str = '',
                 from_side: str = 'bottom', to_side: str = 'top') -> Edge:
    return Edge([anchor(blocks, a, from_side), anchor(blocks, b, to_side)], label=label)


def mm_y_to_plot(y_from_top: float) -> float:
    return PAGE_H - y_from_top


def wrap_text(text: str, max_chars: int) -> str:
    parts = []
    for raw_line in str(text).split('\n'):
        if not raw_line:
            parts.append('')
        else:
            parts.extend(textwrap.wrap(raw_line, width=max_chars, break_long_words=False))
    return '\n'.join(parts)


def draw_frame_and_stamp(ax, diagram: Diagram, total_sheets: int):
    # Outer frame
    ax.add_patch(Rectangle((MARGIN, MARGIN), PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN,
                           fill=False, lw=1.05, ec='black'))
    # Sheet number top center
    ax.text(PAGE_W / 2, PAGE_H - 2.5, str(diagram.sheet_no), ha='center', va='top', fontsize=8.5,
            family='DejaVu Serif')

    y0 = MARGIN
    h = STAMP_H
    x0 = MARGIN
    full_w = PAGE_W - 2 * MARGIN
    left_w = 75
    mid_w = 80
    right_w = full_w - left_w - mid_w
    # Main title block rectangles
    ax.add_patch(Rectangle((x0, y0), left_w, h, fill=False, lw=0.85, ec='black'))
    ax.add_patch(Rectangle((x0 + left_w, y0), mid_w, h, fill=False, lw=0.85, ec='black'))
    ax.add_patch(Rectangle((x0 + left_w + mid_w, y0), right_w, h, fill=False, lw=0.85, ec='black'))

    # Left revision table
    headers = ['Изм.', 'Лист', '№ докум.', 'Подпись', 'Дата']
    col_ws = [11, 11, 28, 16, 9]
    xx = x0
    for w in col_ws[:-1]:
        xx += w
        ax.plot([xx, xx], [y0, y0 + h], color='black', lw=0.55)
    for yy in [y0 + h - 5, y0 + h - 10, y0 + h - 15, y0 + h - 20, y0 + h - 25]:
        ax.plot([x0, x0 + left_w], [yy, yy], color='black', lw=0.55)
    cx = x0
    for head, w in zip(headers, col_ws):
        ax.text(cx + w / 2, y0 + h - 2.6, head, ha='center', va='center', fontsize=4.8,
                family='DejaVu Serif', style='italic')
        cx += w
    rows = [('Разраб.', 'Жердева В.'), ('Пров.', 'Романчева Н.И.'), ('Н. Контр.', ''), ('Утв.', 'Феоктистова О.Г.')]
    for i, (role, name) in enumerate(rows):
        yy = y0 + h - 7.5 - i * 5
        ax.text(x0 + 2, yy, role, ha='left', va='center', fontsize=5.0, family='DejaVu Serif')
        ax.text(x0 + 30, yy, name, ha='left', va='center', fontsize=4.6, family='DejaVu Serif')

    # Middle block
    xm = x0 + left_w
    ax.plot([xm, xm + mid_w], [y0 + h - 9, y0 + h - 9], color='black', lw=0.55)
    ax.text(xm + mid_w / 2, y0 + h - 4.5, diagram.doc_code, ha='center', va='center', fontsize=6.3,
            family='DejaVu Serif')
    ax.text(xm + mid_w / 2, y0 + 10.5, wrap_text(diagram.title, 28), ha='center', va='center', fontsize=6.6,
            family='DejaVu Serif', style='italic')

    # Right block: lit, sheet, sheets + org
    xr = x0 + left_w + mid_w
    ax.plot([xr, xr + right_w], [y0 + h - 14, y0 + h - 14], color='black', lw=0.55)
    ax.plot([xr, xr + right_w], [y0 + h - 7, y0 + h - 7], color='black', lw=0.55)
    ax.plot([xr + right_w / 3, xr + right_w / 3], [y0 + h - 14, y0 + h], color='black', lw=0.55)
    ax.plot([xr + 2 * right_w / 3, xr + 2 * right_w / 3], [y0 + h - 14, y0 + h], color='black', lw=0.55)
    ax.text(xr + right_w / 6, y0 + h - 3.5, 'Лит.', ha='center', va='center', fontsize=5.2, family='DejaVu Serif')
    ax.text(xr + right_w / 2, y0 + h - 3.5, 'Лист', ha='center', va='center', fontsize=5.2, family='DejaVu Serif')
    ax.text(xr + 5 * right_w / 6, y0 + h - 3.5, 'Листов', ha='center', va='center', fontsize=5.2, family='DejaVu Serif')
    ax.text(xr + right_w / 6, y0 + h - 10.5, 'П', ha='center', va='center', fontsize=6, family='DejaVu Serif')
    ax.text(xr + right_w / 2, y0 + h - 10.5, str(diagram.sheet_no), ha='center', va='center', fontsize=6, family='DejaVu Serif')
    ax.text(xr + 5 * right_w / 6, y0 + h - 10.5, str(total_sheets), ha='center', va='center', fontsize=6, family='DejaVu Serif')
    ax.text(xr + right_w / 2, y0 + 6.5, 'МГТУ ГА ФПМВТ\nЭВМ 221 090301', ha='center', va='center', fontsize=5.8,
            family='DejaVu Serif')


def draw_block(ax, block: Block):
    x, y, w, h = block.x, mm_y_to_plot(block.y), block.w, block.h
    fs = block.fs
    max_chars = max(8, int(w / 2.4))
    text = wrap_text(block.text, max_chars)

    if block.kind == 'terminator':
        patch = FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                               boxstyle='round,pad=0.02,rounding_size=3.2',
                               fill=False, lw=1.05, ec='black')
        ax.add_patch(patch)
    elif block.kind == 'process':
        ax.add_patch(Rectangle((x - w / 2, y - h / 2), w, h, fill=False, lw=1.0, ec='black'))
    elif block.kind == 'io':
        s = min(6, w * 0.12)
        pts = [(x - w/2 + s, y - h/2), (x + w/2, y - h/2), (x + w/2 - s, y + h/2), (x - w/2, y + h/2)]
        ax.add_patch(Polygon(pts, fill=False, lw=1.0, ec='black'))
    elif block.kind == 'decision':
        pts = [(x, y - h/2), (x + w/2, y), (x, y + h/2), (x - w/2, y)]
        ax.add_patch(Polygon(pts, fill=False, lw=1.0, ec='black'))
        fs = min(fs, 6.0)
    elif block.kind == 'db':
        # cylinder: body + top/bottom ellipses
        ax.add_patch(Rectangle((x - w/2, y - h/2 + 3), w, h - 6, fill=False, lw=1.0, ec='black'))
        ax.add_patch(Ellipse((x, y - h/2 + 3), w, 6, fill=False, lw=1.0, ec='black'))
        ax.add_patch(Arc((x, y + h/2 - 3), w, 6, theta1=0, theta2=180, lw=1.0, ec='black'))
        ax.add_patch(Arc((x, y + h/2 - 3), w, 6, theta1=180, theta2=360, lw=0.55, ec='black', linestyle='dashed'))
    elif block.kind == 'document':
        # document with wavy bottom
        top = y + h/2
        bottom = y - h/2
        left = x - w/2
        right = x + w/2
        ax.plot([left, right, right], [top, top, bottom+3], color='black', lw=1.0)
        xs = [left + i * w / 30 for i in range(31)]
        ys = [bottom + 2 + math.sin(i / 30 * 2 * math.pi) * 1.0 for i in range(31)]
        ax.plot(xs, ys, color='black', lw=1.0)
        ax.plot([left, left], [top, bottom+2], color='black', lw=1.0)
    else:
        raise ValueError(block.kind)

    ax.text(x, y, text, ha='center', va='center', fontsize=fs, family='DejaVu Serif')


def draw_edge(ax, edge: Edge):
    pts = [(x, mm_y_to_plot(y)) for x, y in edge.points]
    if len(pts) < 2:
        return
    # Lines except final segment
    for p1, p2 in zip(pts[:-2], pts[1:-1]):
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color='black', lw=0.85)
    # final arrow
    start, end = pts[-2], pts[-1]
    arr = FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=7.5, lw=0.85, color='black',
                          shrinkA=0, shrinkB=0)
    ax.add_patch(arr)
    if edge.label:
        # label at middle of first meaningful segment in original top coordinate
        idx = 0 if len(edge.points) == 2 else min(1, len(edge.points) - 2)
        x1, y1 = edge.points[idx]
        x2, y2 = edge.points[idx + 1]
        lx, ly = (x1 + x2)/2, (y1 + y2)/2
        ax.text(lx + 1.2, mm_y_to_plot(ly), edge.label, ha='left', va='center', fontsize=edge.fs,
                family='DejaVu Serif', bbox=dict(fc='white', ec='none', pad=0.5))


def render_diagram(diagram: Diagram, total_sheets: int, out_dir: Path = PY_OUT):
    fig = plt.figure(figsize=(8.27, 11.69), dpi=170)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, PAGE_W)
    ax.set_ylim(0, PAGE_H)
    ax.set_aspect('equal')
    ax.axis('off')
    draw_frame_and_stamp(ax, diagram, total_sheets)
    for b in diagram.blocks:
        draw_block(ax, b)
    for e in diagram.edges:
        draw_edge(ax, e)
    if diagram.note:
        ax.text(12, 46, wrap_text(diagram.note, 80), ha='left', va='bottom', fontsize=5.3, family='DejaVu Serif')
    stem = f"{diagram.key}_{slug(diagram.title)}"
    fig.savefig(out_dir / f"{stem}.png", dpi=170, bbox_inches=None, pad_inches=0)
    fig.savefig(out_dir / f"{stem}.svg", format='svg', bbox_inches=None, pad_inches=0)
    plt.close(fig)


def slug(s: str) -> str:
    repl = {
        ' ': '_', '—': '-', '/': '_', '\\': '_', ':': '', '«': '', '»': '', '№': 'N', ',': '', '.': '', '(': '', ')': '',
    }
    for k, v in repl.items():
        s = s.replace(k, v)
    # transliterate minimal Russian to Latin-ish filenames
    table = str.maketrans({
        'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'C','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ы':'Y','Э':'E','Ю':'Yu','Я':'Ya','Ь':'','Ъ':'',
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ы':'y','э':'e','ю':'yu','я':'ya','ь':'','ъ':'',
    })
    return ''.join(ch for ch in s.translate(table) if ch.isalnum() or ch in ['_', '-'])[:80]


def build_diagrams() -> List[Diagram]:
    diagrams: List[Diagram] = []

    def D(key, title, sheet):
        return Diagram(key=key, title=title, doc_code=f"ЭВМ-221042.ВКР.1511.{sheet:02d}.АЛГ", sheet_no=sheet)

    # A1 trusted device access
    d = D('A1', 'Алгоритм авторизации и проверки доверенного устройства', 1)
    B = []
    def b(id, kind, text, x, y, w, h, fs=6.7):
        B.append(Block(id, kind, text, x, y, w, h, fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('in','io','Ввод логина, пароля и отпечатка устройства',105,35,70,14)
    b('userdb','db','Поиск пользователя в БД users, roles',105,54,65,16)
    b('found','decision','Пользователь найден и активен?',105,77,60,18,5.8)
    b('pwd','process','Проверка пароля BCrypt',105,101,56,13)
    b('pwdok','decision','Пароль верен?',105,123,48,17,5.8)
    b('role','process','Определение роли пользователя',105,145,56,12)
    b('crew','decision','Роль = crew_member?',105,165,52,17,5.8)
    b('device','db','Проверка trusted_devices',148,191,55,15,6.2)
    b('devok','decision','Устройство доверенное и активно?',148,216,58,18,5.6)
    b('jwt','process','Создать JWT, открыть рабочее пространство',64,229,58,15,6.0)
    b('deny','document','Отказ во входе. Записать событие аудита',148,243,58,17,5.8)
    b('e','terminator','Конец',105,256,38,10)
    d.blocks = B; blocks = {x.id: x for x in B}
    d.edges = [
        edge_between(blocks,'s','in'), edge_between(blocks,'in','userdb'), edge_between(blocks,'userdb','found'),
        edge_between(blocks,'found','pwd','Да'), edge_between(blocks,'pwd','pwdok'), edge_between(blocks,'pwdok','role','Да'),
        edge_between(blocks,'role','crew'),
        Edge([anchor(blocks,'found','right'),(170,77),(170,235),anchor(blocks,'deny','right')],'Нет'),
        Edge([anchor(blocks,'pwdok','right'),(170,123),(170,235),anchor(blocks,'deny','right')],'Нет'),
        Edge([anchor(blocks,'crew','left'),(64,165),anchor(blocks,'jwt','top')],'Да'),
        Edge([anchor(blocks,'crew','right'),anchor(blocks,'device','left')],'Нет'),
        edge_between(blocks,'device','devok'),
        Edge([anchor(blocks,'devok','left'),(64,216),anchor(blocks,'jwt','right')],'Да'),
        edge_between(blocks,'devok','deny','Нет'),
        Edge([anchor(blocks,'jwt','bottom'),(64,256),anchor(blocks,'e','left')]),
        edge_between(blocks,'deny','e')
    ]
    diagrams.append(d)

    # A2 WearOS ADB ACARS bridge
    d = D('A2', 'Алгоритм приема телеметрии Wear OS через ADB/ACARS', 2)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7):
        B.append(Block(id, kind, text, x, y, w, h, fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('svc','process','Запуск TelemetryService на часах',105,34,64,13)
    b('perm','process','Запрос разрешений на датчики',105,52,58,13)
    b('permok','decision','Разрешение на пульс получено?',105,74,60,18,5.7)
    b('read','io','Считать ЧСС, SpO2 и стресс',72,101,58,14)
    b('beacon','process','Тестовый маяк / диагностика',147,101,55,14,6.1)
    b('fmt','process','Сформировать строку hr;spo2;stress',105,126,68,14)
    b('log','document','Вывести Log.d("MC21_ACARS", строка)',105,151,72,15,5.7)
    b('bridge','process','Python ADB-шлюз читает logcat',105,176,66,14)
    b('regex','decision','Строка соответствует шаблону?',105,201,60,18,5.7)
    b('post','io','POST /crew/upload-telemetry-direct',72,228,68,14,5.9)
    b('retry','process','Повторить отправку до 3 раз',150,228,55,14,5.9)
    b('ok','decision','Ответ сервера 2xx?',72,247,48,15,5.5)
    b('e','terminator','Конец',105,258,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges = [edge_between(blocks,'s','svc'), edge_between(blocks,'svc','perm'), edge_between(blocks,'perm','permok'),
               Edge([anchor(blocks,'permok','left'),(72,74),anchor(blocks,'read','top')],'Да'),
               Edge([anchor(blocks,'permok','right'),(147,74),anchor(blocks,'beacon','top')],'Нет'),
               Edge([anchor(blocks,'read','bottom'),(72,116),(105,116),anchor(blocks,'fmt','top')]),
               Edge([anchor(blocks,'beacon','bottom'),(147,116),(105,116),anchor(blocks,'fmt','top')]),
               edge_between(blocks,'fmt','log'), edge_between(blocks,'log','bridge'), edge_between(blocks,'bridge','regex'),
               Edge([anchor(blocks,'regex','left'),(72,201),anchor(blocks,'post','top')],'Да'),
               Edge([anchor(blocks,'regex','right'),(170,201),(170,176),anchor(blocks,'bridge','right')],'Нет'),
               edge_between(blocks,'post','ok'),
               Edge([anchor(blocks,'ok','right'),(150,247),anchor(blocks,'retry','bottom')],'Нет'),
               Edge([anchor(blocks,'retry','left'),(104,228),anchor(blocks,'post','right')]),
               Edge([anchor(blocks,'ok','bottom'),(72,258),anchor(blocks,'e','left')],'Да')]
    diagrams.append(d)

    # A3 server receive telemetry
    d = D('A3', 'Алгоритм привязки телеметрии к рейсу и сохранения', 3)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('post','io','Получить JSON: heart_rate, spo2, stress',105,36,70,14)
    b('valid','decision','Показатели в допустимых диапазонах?',105,60,64,18,5.6)
    b('select','db','Поиск активного рейса и назначения экипажа',105,88,72,17,5.9)
    b('found','decision','Рейс и сотрудник найдены?',105,114,58,18,5.7)
    b('calc','process','Рассчитать performance_score',105,140,60,14)
    b('insert','db','INSERT в flight_telemetry',105,165,55,16)
    b('commit','process','Фиксация транзакции db.commit()',105,190,62,13)
    b('return','io','Вернуть JSON: status, flight_number, score',105,214,72,14,5.8)
    b('bad','document','Вернуть 400 / записать ошибку',165,80,48,14,5.8)
    b('notfound','document','Вернуть 404 / нет активного рейса',165,132,50,16,5.7)
    b('e','terminator','Конец',105,238,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','post'), edge_between(blocks,'post','valid'), edge_between(blocks,'valid','select','Да'),
             Edge([anchor(blocks,'valid','right'),anchor(blocks,'bad','left')],'Нет'), Edge([anchor(blocks,'bad','bottom'),(165,238),anchor(blocks,'e','right')]),
             edge_between(blocks,'select','found'), edge_between(blocks,'found','calc','Да'),
             Edge([anchor(blocks,'found','right'),anchor(blocks,'notfound','left')],'Нет'), Edge([anchor(blocks,'notfound','bottom'),(165,238),anchor(blocks,'e','right')]),
             edge_between(blocks,'calc','insert'), edge_between(blocks,'insert','commit'), edge_between(blocks,'commit','return'), edge_between(blocks,'return','e')]
    diagrams.append(d)

    # A4 performance score
    d = D('A4', 'Алгоритм расчета индекса работоспособности', 4)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('input','io','Ввод: ЧСС, SpO2, стресс, baseline_hr',105,36,70,14)
    b('clean','process','Фильтрация выбросов и пропусков',105,59,62,13)
    b('base','db','Получить индивидуальный базис пользователя',105,81,70,16,6.0)
    b('pen','process','Штрафы: |ЧСС-baseline|, стресс, низкий SpO2',105,107,75,15,5.8)
    b('score','process','score = max(0, min(100, 100 - penalties))',105,132,75,14,5.8)
    b('hi','decision','score ≥ 85 и стресс < 25?',105,157,60,18,5.6)
    b('mid','decision','score ≥ 70?',105,191,48,17,5.7)
    b('opt','process','Статус: высокая готовность',45,184,52,14,5.9)
    b('norm','process','Статус: норма',105,220,43,13,6.1)
    b('warn','process','Статус: риск / усталость',162,220,50,14,5.9)
    b('save','db','Сохранить/вернуть результат анализа',105,243,63,15,5.9)
    b('e','terminator','Конец',105,258,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','input'), edge_between(blocks,'input','clean'), edge_between(blocks,'clean','base'), edge_between(blocks,'base','pen'), edge_between(blocks,'pen','score'), edge_between(blocks,'score','hi'),
             Edge([anchor(blocks,'hi','left'),(45,157),anchor(blocks,'opt','top')],'Да'), Edge([anchor(blocks,'hi','bottom'),anchor(blocks,'mid','top')],'Нет'),
             Edge([anchor(blocks,'mid','bottom'),anchor(blocks,'norm','top')],'Да'), Edge([anchor(blocks,'mid','right'),(162,191),anchor(blocks,'warn','top')],'Нет'),
             Edge([anchor(blocks,'opt','bottom'),(45,243),anchor(blocks,'save','left')]), edge_between(blocks,'norm','save'), Edge([anchor(blocks,'warn','bottom'),(162,243),anchor(blocks,'save','right')]), edge_between(blocks,'save','e')]
    diagrams.append(d)

    # A5 medical check
    d = D('A5', 'Алгоритм предрейсового медицинского контроля', 5)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('sel','io','Выбор сотрудника, рейса и даты осмотра',105,36,70,14)
    b('input','io','Ввод ЧСС, АД, температуры, алкоголя, жалоб',105,60,76,15,5.9)
    b('norm','decision','Показатели в норме и жалоб нет?',105,88,64,18,5.6)
    b('admit','process','Установить is_admitted = true',60,119,55,14,6.0)
    b('save2','db','Сохранить осмотр в preflight_medical_checks',60,145,70,16,5.8)
    b('reason','io','Выбор стандартной причины отстранения',150,119,62,14,5.9)
    b('deny','process','Установить is_admitted = false',150,145,55,14,6.0)
    b('docs','document','Сформировать справку №5 и направление №1',150,172,65,17,5.7)
    b('journal','db','Обновить журналы Прил. №2 и №4',105,200,65,16,5.8)
    b('audit','process','Записать audit_logs: medical_check',105,225,63,13,5.8)
    b('e','terminator','Конец',105,248,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','sel'), edge_between(blocks,'sel','input'), edge_between(blocks,'input','norm'),
             Edge([anchor(blocks,'norm','left'),(60,88),anchor(blocks,'admit','top')],'Да'), edge_between(blocks,'admit','save2'), Edge([anchor(blocks,'save2','bottom'),(60,200),anchor(blocks,'journal','left')]),
             Edge([anchor(blocks,'norm','right'),(150,88),anchor(blocks,'reason','top')],'Нет'), edge_between(blocks,'reason','deny'), edge_between(blocks,'deny','docs'), Edge([anchor(blocks,'docs','bottom'),(150,200),anchor(blocks,'journal','right')]),
             edge_between(blocks,'journal','audit'), edge_between(blocks,'audit','e')]
    diagrams.append(d)

    # A6 audit logging
    d = D('A6', 'Алгоритм аудита действий пользователей', 6)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('event','io','Получено значимое действие пользователя',105,36,70,14)
    b('fields','process','Сформировать action_type, description, result, target_id',105,62,82,16,5.8)
    b('orm','db','Создать запись AuditLog через ORM',105,90,65,16,5.9)
    b('commit','decision','db.commit() выполнен?',105,116,54,18,5.7)
    b('done','process','Событие аудита сохранено',58,148,50,13,6.0)
    b('rollback','process','db.rollback(), запись ошибки logger',150,145,62,14,5.8)
    b('sql','db','Резервный INSERT INTO audit_logs',150,171,60,16,5.8)
    b('sqlok','decision','Резервная запись успешна?',150,198,56,18,5.7)
    b('error','document','Зафиксировать ошибку аудита, бизнес-операцию не ломать',150,227,66,18,5.5)
    b('e','terminator','Конец',105,251,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','event'), edge_between(blocks,'event','fields'), edge_between(blocks,'fields','orm'), edge_between(blocks,'orm','commit'),
             Edge([anchor(blocks,'commit','left'),(58,116),anchor(blocks,'done','top')],'Да'), Edge([anchor(blocks,'done','bottom'),(58,251),anchor(blocks,'e','left')]),
             Edge([anchor(blocks,'commit','right'),(150,116),anchor(blocks,'rollback','top')],'Нет'), edge_between(blocks,'rollback','sql'), edge_between(blocks,'sql','sqlok'),
             Edge([anchor(blocks,'sqlok','left'),(105,198),(105,251),anchor(blocks,'e','top')],'Да'), edge_between(blocks,'sqlok','error','Нет'), Edge([anchor(blocks,'error','bottom'),(150,251),anchor(blocks,'e','right')])]
    diagrams.append(d)

    # A7 personal analytics
    d = D('A7', 'Алгоритм персональной аналитики по истории рейсов', 7)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('req','io','Запрос /crew/stats-detailed',105,36,58,14)
    b('hist','db','Получить telemetryHistory по последним рейсам',105,61,70,16,5.9)
    b('empty','decision','История пуста?',105,88,48,17,5.7)
    b('sync','document','Сообщение: ожидание синхронизации данных',155,113,58,17,5.6)
    b('few','decision','Записей меньше 3?',105,122,48,17,5.7)
    b('pre','document','Предварительный медицинский профиль',155,149,55,16,5.7)
    b('avg','process','Рассчитать avgScore и avgStress',105,149,58,14,5.9)
    b('hi','decision','avgScore > 85 и avgStress < 25?',105,177,60,18,5.5)
    b('mid','decision','avgScore > 70?',105,209,48,17,5.7)
    b('text1','document','Заключение: высокая готовность',45,209,50,15,5.7)
    b('text2','document','Заключение: состояние в норме',105,236,50,15,5.7)
    b('text3','document','Предупреждение: нисходящий тренд',165,236,52,15,5.6)
    b('e','terminator','Конец',105,258,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','req'), edge_between(blocks,'req','hist'), edge_between(blocks,'hist','empty'),
             Edge([anchor(blocks,'empty','right'),anchor(blocks,'sync','left')],'Да'), Edge([anchor(blocks,'sync','bottom'),(155,258),anchor(blocks,'e','right')]),
             edge_between(blocks,'empty','few','Нет'), Edge([anchor(blocks,'few','right'),anchor(blocks,'pre','left')],'Да'), Edge([anchor(blocks,'pre','bottom'),(155,258),anchor(blocks,'e','right')]),
             edge_between(blocks,'few','avg','Нет'), edge_between(blocks,'avg','hi'), Edge([anchor(blocks,'hi','left'),(45,177),anchor(blocks,'text1','top')],'Да'), edge_between(blocks,'hi','mid','Нет'),
             edge_between(blocks,'mid','text2','Да'), Edge([anchor(blocks,'mid','right'),(165,209),anchor(blocks,'text3','top')],'Нет'),
             Edge([anchor(blocks,'text1','bottom'),(45,258),anchor(blocks,'e','left')]), edge_between(blocks,'text2','e'), Edge([anchor(blocks,'text3','bottom'),(165,258),anchor(blocks,'e','right')])]
    diagrams.append(d)

    # A8 report generation
    d = D('A8', 'Алгоритм формирования отчетов и журналов', 8)
    B=[]
    def b(id, kind, text, x, y, w, h, fs=6.7): B.append(Block(id,kind,text,x,y,w,h,fs)); return B[-1]
    b('s','terminator','Начало',105,17,38,11)
    b('choose','io','Выбор типа отчета, даты или периода',105,36,68,14)
    b('auth','process','Проверка роли и прав доступа',105,59,58,13,6.1)
    b('query','db','SQL-запрос к flights, telemetry, medical_checks',105,84,78,17,5.7)
    b('data','decision','Данные найдены?',105,111,48,17,5.7)
    b('empty','document','Показать пустой отчет / уведомление',160,137,54,16,5.7)
    b('agg','process','Агрегация показателей и расчет итогов',105,139,66,14,5.9)
    b('tmpl','document','Заполнение таблиц и PDF-шаблонов',105,165,64,16,5.8)
    b('print','io','Скачать PDF или вывести журнал на печать',105,191,70,14,5.8)
    b('audit','process','log_action: report_generation',105,216,58,13,5.9)
    b('e','terminator','Конец',105,242,38,10)
    d.blocks=B; blocks={x.id:x for x in B}
    d.edges=[edge_between(blocks,'s','choose'), edge_between(blocks,'choose','auth'), edge_between(blocks,'auth','query'), edge_between(blocks,'query','data'),
             edge_between(blocks,'data','agg','Да'), Edge([anchor(blocks,'data','right'),anchor(blocks,'empty','left')],'Нет'), Edge([anchor(blocks,'empty','bottom'),(160,242),anchor(blocks,'e','right')]),
             edge_between(blocks,'agg','tmpl'), edge_between(blocks,'tmpl','print'), edge_between(blocks,'print','audit'), edge_between(blocks,'audit','e')]
    diagrams.append(d)

    return diagrams


# Draw.io generation

def dx(v: float) -> str:
    return f"{v * DRAWIO_SCALE:.1f}"


def esc(s: str) -> str:
    return html.escape(str(s), quote=True).replace('\n', '<br>')


def drawio_style(kind: str) -> str:
    common = 'whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#ffffff;fontFamily=Times New Roman;fontSize=13;strokeWidth=2;'
    if kind == 'terminator':
        return common + 'rounded=1;arcSize=25;'
    if kind == 'process':
        return common + 'rounded=0;'
    if kind == 'io':
        return common + 'shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;'
    if kind == 'decision':
        return common + 'rhombus;'
    if kind == 'db':
        return common + 'shape=cylinder3d;boundedLbl=1;backgroundOutline=1;size=15;'
    if kind == 'document':
        return common + 'shape=document;boundedLbl=1;'
    return common


def rect_cell(cell_id: str, value: str, x: float, y: float, w: float, h: float, style: str, parent='1') -> str:
    return (f'<mxCell id="{cell_id}" value="{esc(value)}" style="{style}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{dx(x)}" y="{dx(y)}" width="{dx(w)}" height="{dx(h)}" as="geometry" />'
            f'</mxCell>')


def edge_cell(cell_id: str, e: Edge, parent='1') -> str:
    pts = e.points
    style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;strokeColor=#000000;strokeWidth=2;fontFamily=Times New Roman;fontSize=12;'
    out = [f'<mxCell id="{cell_id}" value="{esc(e.label)}" style="{style}" edge="1" parent="{parent}">', '<mxGeometry relative="1" as="geometry">']
    out.append(f'<mxPoint x="{dx(pts[0][0])}" y="{dx(pts[0][1])}" as="sourcePoint" />')
    if len(pts) > 2:
        out.append('<Array as="points">')
        for x, y in pts[1:-1]:
            out.append(f'<mxPoint x="{dx(x)}" y="{dx(y)}" />')
        out.append('</Array>')
    out.append(f'<mxPoint x="{dx(pts[-1][0])}" y="{dx(pts[-1][1])}" as="targetPoint" />')
    out.append('</mxGeometry></mxCell>')
    return ''.join(out)


def stamp_drawio_cells(diagram: Diagram, total_sheets: int) -> List[str]:
    cells=[]; cid=10000
    def add(value, x, y, w, h, fs=12, extra=''):
        nonlocal cid
        style=f'rounded=0;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#ffffff;fontFamily=Times New Roman;fontSize={fs};strokeWidth=1;{extra}'
        cells.append(rect_cell(f'stamp_{diagram.key}_{cid}', value, x, y, w, h, style)); cid+=1
    # frame
    add('', MARGIN, MARGIN, PAGE_W-2*MARGIN, PAGE_H-2*MARGIN, 8)
    add(str(diagram.sheet_no), PAGE_W/2-5, 1, 10, 5, 10, 'strokeColor=none;fillColor=none;')
    y0=STAMP_TOP_Y; x0=MARGIN; h=STAMP_H; full=PAGE_W-2*MARGIN; left=75; mid=80; right=full-left-mid
    add('',x0,y0,left,h,8); add('',x0+left,y0,mid,h,8); add('',x0+left+mid,y0,right,h,8)
    add('Изм.',x0,y0,11,5,7); add('Лист',x0+11,y0,11,5,7); add('№ докум.',x0+22,y0,28,5,7); add('Подпись',x0+50,y0,16,5,7); add('Дата',x0+66,y0,9,5,7)
    rows=[('Разраб.','Жердева В.'),('Пров.','Романчева Н.И.'),('Н. Контр.',''),('Утв.','Феоктистова О.Г.')]
    for i,(r,n) in enumerate(rows):
        add(r,x0,y0+5+i*5,22,5,7); add(n,x0+22,y0+5+i*5,28,5,7); add('',x0+50,y0+5+i*5,16,5,7); add('',x0+66,y0+5+i*5,9,5,7)
    add(diagram.doc_code,x0+left,y0,mid,9,10)
    add(diagram.title,x0+left,y0+9,mid,h-9,11,'fontStyle=2;')
    add('Лит.',x0+left+mid,y0,right/3,7,8); add('Лист',x0+left+mid+right/3,y0,right/3,7,8); add('Листов',x0+left+mid+2*right/3,y0,right/3,7,8)
    add('П',x0+left+mid,y0+7,right/3,7,9); add(str(diagram.sheet_no),x0+left+mid+right/3,y0+7,right/3,7,9); add(str(total_sheets),x0+left+mid+2*right/3,y0+7,right/3,7,9)
    add('МГТУ ГА ФПМВТ<br>ЭВМ 221 090301',x0+left+mid,y0+14,right,h-14,10)
    return cells


def diagram_to_drawio_graph_model(diagram: Diagram, total_sheets: int) -> str:
    cells = ['<mxCell id="0" />', '<mxCell id="1" parent="0" />']
    cells += stamp_drawio_cells(diagram, total_sheets)
    # Blocks
    for idx, b in enumerate(diagram.blocks, 1):
        style=drawio_style(b.kind)
        cells.append(rect_cell(f'{diagram.key}_b_{b.id}', b.text, b.x-b.w/2, b.y-b.h/2, b.w, b.h, style))
    # Edges
    for idx, e in enumerate(diagram.edges, 1):
        cells.append(edge_cell(f'{diagram.key}_e_{idx}', e))
    root = '<root>' + ''.join(cells) + '</root>'
    return f'<mxGraphModel dx="1200" dy="1600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{int(PAGE_W*DRAWIO_SCALE)}" pageHeight="{int(PAGE_H*DRAWIO_SCALE)}" math="0" shadow="0">{root}</mxGraphModel>'


def render_drawio(diagrams: List[Diagram], out_file: Path):
    pages=[]
    total=len(diagrams)
    for d in diagrams:
        model=diagram_to_drawio_graph_model(d,total)
        pages.append(f'<diagram id="{esc(d.key)}" name="{esc(d.key + " — " + d.title)}">{model}</diagram>')
        # individual XML page for Insert Advanced XML (mxGraphModel)
        (DX_OUT / f'{d.key}_{slug(d.title)}.xml').write_text(model, encoding='utf-8')
    mxfile = '<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" modified="2026-06-14T00:00:00.000Z" agent="GPT" version="24.7.17" type="device">' + ''.join(pages) + '</mxfile>'
    out_file.write_text(mxfile, encoding='utf-8')

if __name__ == '__main__':
    diagrams = build_diagrams()
    for d in diagrams:
        render_diagram(d, total_sheets=len(diagrams))
    render_drawio(diagrams, BASE / 'gost_algorithms_drawio.drawio')
    print(f'Готово. Файлы сохранены в: {BASE.resolve()}')
    print('PNG/SVG: ', (PY_OUT).resolve())
    print('Draw.io: ', (BASE / 'gost_algorithms_drawio.drawio').resolve())
