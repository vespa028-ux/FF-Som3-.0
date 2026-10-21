import { useEffect, useState } from 'react'
import { toDataUrl } from './drive'

export function useDataUrl(url) {
  const [d, setD] = useState('')
  useEffect(() => {
    let on = true
    if (!url) { setD(''); return }
    toDataUrl(url).then(x => on && setD(x)).catch(() => on && setD(url))
    return () => { on = false }
  }, [url])
  return d
}
