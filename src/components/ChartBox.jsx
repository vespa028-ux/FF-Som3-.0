import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

// แสดงตัวเลขบนแท่ง/จุดของกราฟ
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    if (chart.config.type === 'doughnut') return
    const { ctx } = chart
    ctx.save(); ctx.font = '600 11px Sarabun'; ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'center'
    chart.data.datasets.forEach((ds, i) => {
      chart.getDatasetMeta(i).data.forEach((el, j) => {
        const v = ds.data[j]
        if (v) ctx.fillText(Number(v).toLocaleString(), el.x, el.y - 6)
      })
    })
    ctx.restore()
  }
}

export default function ChartBox({ type = 'bar', labels, datasets, height = 240 }) {
  const ref = useRef(null)
  const chart = useRef(null)
  useEffect(() => {
    chart.current?.destroy()
    chart.current = new Chart(ref.current, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1 || type === 'doughnut', labels: { color: '#94a3b8' } } },
        scales: type === 'doughnut' ? {} : {
          x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.12)' }, beginAtZero: true, grace: '12%' }
        }
      },
      plugins: [valueLabels]
    })
    return () => chart.current?.destroy()
  }, [type, JSON.stringify(labels), JSON.stringify(datasets)])
  return <div style={{ height }} className="relative w-full"><canvas ref={ref} /></div>
}
