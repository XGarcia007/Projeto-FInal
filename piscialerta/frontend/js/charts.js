const CRITICAL_OXYGEN_LIMIT = 4.0;
let oxygenChart;

const criticalLimitPlugin = {
  id: 'criticalLimitLine',
  afterDatasetsDraw(chart) {
    const y = chart.scales.y.getPixelForValue(CRITICAL_OXYGEN_LIMIT);
    const { left, right } = chart.chartArea;
    const context = chart.ctx;
    context.save();
    context.strokeStyle = '#ef4444';
    context.lineWidth = 2;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
    context.restore();
  },
};

function formatTime(value, period) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (period === '24h') {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function renderOxygenChart(readings, period = '24h') {
  const canvas = document.querySelector('#oxygen-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ordered = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const labels = ordered.map((reading) => formatTime(reading.timestamp, period));
  const values = ordered.map((reading) => Number(reading.oxygenMgL));
  const threshold = ordered.map(() => CRITICAL_OXYGEN_LIMIT);

  if (oxygenChart) oxygenChart.destroy();
  oxygenChart = new Chart(canvas, {
    plugins: [criticalLimitPlugin],
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Oxigênio dissolvido',
          data: values,
          borderColor: '#2b80ff',
          backgroundColor: 'rgba(43, 128, 255, 0.12)',
          borderWidth: 2.5,
          pointRadius: values.length > 36 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: values.map((value) => value < CRITICAL_OXYGEN_LIMIT ? '#ef4444' : '#2b80ff'),
          fill: true,
          tension: 0.32,
        },
        {
          label: 'Limite crítico (4,0 mg/L)',
          data: threshold,
          borderColor: 'transparent',
          borderWidth: 0,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#17211f', padding: 11, displayColors: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64736f', maxTicksLimit: 7, maxRotation: 0, font: { family: 'DM Sans', size: 10 } },
        },
        y: {
          min: 0,
          suggestedMax: 10,
          title: { display: true, text: 'mg/L', color: '#64736f', font: { family: 'DM Sans', size: 10 } },
          grid: { color: '#e8efec' },
          ticks: { color: '#64736f', font: { family: 'DM Sans', size: 10 } },
        },
      },
    },
  });

  const emptyState = document.querySelector('#chart-empty');
  if (emptyState) emptyState.hidden = ordered.length > 0;
}