"""Reproduce the pilot figure from the published, password-free observation table.

Optional analysis dependency: matplotlib. Not used by the npm package or CI.
Run: python3 research/mobile-input/results/plot-pilot.py
"""
import csv
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

root = Path(__file__).resolve().parent
with (root / 'pilot-p1-observations.csv').open() as source:
    rows = list(csv.DictReader(source))
assert len(rows) == 9
conditions = ['random62', 'lower25', 'eff10']
colors = ['#2463a5', '#16876c', '#7a54a2']
fig, ax = plt.subplots(figsize=(10.5, 5.2), layout='constrained')
for row in rows:
    block = int(row['block'])
    y = conditions.index(row['condition']) + (block - 2) * .17
    seconds = float(row['elapsedMs']) / 1000
    skipped = row['status'] == 'skipped'
    ax.scatter(seconds, y, color='#b3261e' if skipped else colors[block - 1],
               marker='x' if skipped else 'o', s=85, linewidths=2, zorder=3)
    ax.annotate(f'{seconds:.2f}' + (' skipped' if skipped else ''), (seconds, y),
                xytext=(7, 0), textcoords='offset points', va='center', fontsize=10)
ax.set(yticks=range(3), yticklabels=['Random 62 · 22 characters', 'Lowercase 25 · 28 characters', 'EFF · 10 words'],
       xlim=(0, 115), ylim=(2.5, -.5), xlabel='Seconds from target reveal to correct submit or skip')
ax.grid(axis='x', color='#e0e4e8', zorder=0)
for side in ['top', 'right', 'left']:
    ax.spines[side].set_visible(False)
ax.tick_params(axis='y', length=0, pad=10)
ax.legend(handles=[Line2D([], [], color=color, marker='o', linestyle='', label=f'Block {i+1}')
                   for i, color in enumerate(colors)], loc='lower right', frameon=False)
fig.suptitle('P1 pilot: individual trial times', fontsize=17, weight='bold')
ax.set_title('Exploratory only: one person; gestures used for meaningful words; composition in every trial', fontsize=10, pad=20)
fig.supxlabel('Completed: random62 2/3, lower25 3/3, EFF 3/3. Strict v1 eligibility: 0/9.\n'
              'The skipped attempt is shown separately and is excluded from completion-time medians.', fontsize=10)
fig.savefig(root / 'pilot-p1-times.png', dpi=160)
plt.close(fig)
