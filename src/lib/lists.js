import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// รายการช่องทางสั่งซื้อ + ขนาดกล่อง (แก้ไขได้จากฐานข้อมูล)
export function useLists() {
  const [channels, setChannels] = useState(['TikTok'])
  const [boxes, setBoxes] = useState(['00/0+4'])
  const reload = useCallback(async () => {
    const [c, b] = await Promise.all([
      supabase.from('channels').select('name').order('sort').order('name'),
      supabase.from('box_sizes').select('name').order('sort').order('name')
    ])
    if (c.data?.length) setChannels(c.data.map(x => x.name))
    if (b.data?.length) setBoxes(b.data.map(x => x.name))
  }, [])
  useEffect(() => { reload() }, [reload])
  return { channels, boxes, reload }
}
