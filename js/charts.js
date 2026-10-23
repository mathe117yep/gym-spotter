// Thin wrapper around Chart.js (loaded globally from the CDN in index.html).
import { toTime } from './stats.js';

export const COLORS = {
  squat: '#e0e0e0',
  bench: '#d4af37',
  weight: '#f3d77a',
  muted: '#6e6e6e',
  grid: 'rgba(255,255,255,0.06)',
  text: '#9e9e9e',
};

const live = [];
const shortDate = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const longDate = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function destroyAll() {
  while (live.length) live.pop().destroy();
}

function make(canvas, config) {
  const chart = new window.Chart(canvas, config);
  live.push(chart);
  return chart;
}

function baseOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: { labels: { color: COLORS.text, boxWidth: 12, boxHeight: 2 } },
      tooltip: {
        callbacks: {
          title: items => longDate(items[0].parsed.x),
          label: item => `${item.dataset.label}: ${Math.round(item.parsed.y * 10) / 10}${unit}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        bounds: 'data',
        ticks: { color: COLORS.text, maxTicksLimit: 5, callback: v => shortDate(v) },
        grid: { color: COLORS.grid },
      },
      y: { ticks: { color: COLORS.text, maxTicksLimit: 6 }, grid: { color: COLORS.grid } },
    },
  };
}

// series: [{ label, color, points: [{ date: 'YYYY-MM-DD', value }], dots?: boolean, faint?: boolean }]
export function lineChart(canvas, series, unit = ' lb') {
  return make(canvas, {
    type: 'line',
    data: {
      datasets: series.map(s => ({
        label: s.label,
        data: s.points.map(p => ({ x: toTime(p.date), y: p.value })),
        borderColor: s.faint ? s.color + '55' : s.color,
        backgroundColor: s.color,
        borderWidth: s.faint ? 0 : 2,
        pointRadius: s.dots === false ? 0 : 2.5,
        pointBackgroundColor: s.faint ? s.color + '66' : s.color,
        showLine: !s.faint,
        tension: 0.25,
      })),
    },
    options: baseOptions(unit),
  });
}

// bars: [{ start: ms, value }]
export function weekBars(canvas, bars, label, unit = '') {
  const opts = baseOptions(unit);
  opts.plugins.legend.display = false;
  opts.plugins.tooltip.callbacks.title = items => `Week of ${shortDate(items[0].parsed.x)}`;
  opts.plugins.tooltip.callbacks.label = item => `${label}: ${Math.round(item.parsed.y).toLocaleString()}${unit}`;
  const halfWeek = 3.5 * 86400000;
  opts.scales.x.min = bars[0].start - halfWeek;
  opts.scales.x.max = bars[bars.length - 1].start + halfWeek;
  opts.scales.y.ticks.callback = v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v);
  return make(canvas, {
    type: 'bar',
    data: {
      datasets: [{
        label,
        data: bars.map(b => ({ x: b.start, y: b.value })),
        backgroundColor: COLORS.bench + 'cc',
        borderRadius: 4,
        barThickness: 'flex',
        maxBarThickness: 22,
      }],
    },
    options: opts,
  });
}
