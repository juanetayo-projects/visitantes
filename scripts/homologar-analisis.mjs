import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const {data:ubic}=await sb.from('ubicaciones').select('id, etiqueta, area, servicio, piso:pisos(nombre)')
const idx=new Map(), idxSA=new Map()
ubic.forEach(u=>{ idx.set(norm(u.servicio)+'|'+norm(u.area)+'|'+norm(u.etiqueta), u); idxSA.set(norm(u.servicio)+'|'+norm(u.etiqueta), u) })
const d=JSON.parse(fs.readFileSync(new URL('../docs/CensoOrientadoresProduccion-1782314313861.json',import.meta.url),'utf8'))
const arr=Array.isArray(d)?d:(d.data||d.results||Object.values(d).find(Array.isArray))
let conCama=0, sinCama=0, matchExacto=0, matchSinArea=0
const noMatch=new Map()
arr.forEach(r=>{
  const serv=String(r.UbicacionActual??'').trim()
  const area=String(r.UbicacionArea??'').trim()
  const bed=(String(r.Cama??'').trim()||String(r.UbicacionNombre??'').trim())
  if(!bed){sinCama++;return}
  conCama++
  const k1=norm(serv)+'|'+norm(area)+'|'+norm(bed)
  const k2=norm(serv)+'|'+norm(bed)
  if(idx.has(k1)) matchExacto++
  else if(idxSA.has(k2)) matchSinArea++
  else { const key=serv+'  ||  '+(area||'-')+'  ||  '+bed; noMatch.set(key,(noMatch.get(key)||0)+1) }
})
console.log('Total registros:',arr.length)
console.log('  sin cama/ubicación detallada:',sinCama,'(no se puede ubicar a nivel cama)')
console.log('  con cama:',conCama)
console.log('    match EXACTO (servicio+area+etiqueta):',matchExacto)
console.log('    match por servicio+etiqueta (sin area):',matchSinArea)
console.log('    SIN match (necesitan homologación):',[...noMatch.values()].reduce((a,b)=>a+b,0))
console.log('\n=== SIN MATCH (servicio || area || cama : conteo) ===')
;[...noMatch.entries()].sort((a,b)=>b[1]-a[1]).forEach(([k,c])=>console.log('  '+k+'  : '+c))
