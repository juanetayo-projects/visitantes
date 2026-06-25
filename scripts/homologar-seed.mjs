import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const {data:ubic}=await sb.from('ubicaciones').select('id, etiqueta, area, servicio')
const idx=new Map(), idxSA=new Map()
ubic.forEach(u=>{ idx.set(norm(u.servicio)+'|'+norm(u.area)+'|'+norm(u.etiqueta),u.id); idxSA.set(norm(u.servicio)+'|'+norm(u.etiqueta),u.id) })
function derivar(unidad,cama){const u=norm(unidad);const m=String(cama).match(/(\d+)/);const num=m?parseInt(m[1],10):null;const c=String(cama).trim();
  if(/(intensivo|intermedios)/.test(u)&&/^c[ie]/i.test(c)&&num!=null) return 'Cubículo '+String(num).padStart(2,'0');
  if(/parcial/.test(u)){ if(/^sill/i.test(c)&&num!=null) return 'Sillón '+num; if(/^cami/i.test(c)&&num!=null) return 'Camilla '+num; }
  return null}
const d=JSON.parse(fs.readFileSync(new URL('../docs/CensoOrientadoresProduccion-1782314313861.json',import.meta.url),'utf8'))
const arr=Array.isArray(d)?d:(d.data||d.results||Object.values(d).find(Array.isArray))
const distintas=new Map()
arr.forEach(r=>{const unidad=String(r.UbicacionActual??'').trim();const area=String(r.UbicacionArea??'').trim();const bed=(String(r.Cama??'').trim()||String(r.UbicacionNombre??'').trim());if(!unidad||!bed)return;const k=unidad+'|'+area+'|'+bed;if(!distintas.has(k))distintas.set(k,{unidad,area,bed})})
const rows=[]; let nAuto=0,nRegla=0,nNull=0
for(const {unidad,area,bed} of distintas.values()){
  let uid=idx.get(norm(unidad)+'|'+norm(area)+'|'+norm(bed)); let origen='auto'
  if(!uid) uid=idxSA.get(norm(unidad)+'|'+norm(bed))
  if(!uid){ const der=derivar(unidad,bed); if(der){ uid=idx.get(norm(unidad)+'|'+norm(area)+'|'+norm(der))||idxSA.get(norm(unidad)+'|'+norm(der)); if(uid) origen='regla'; } }
  if(!uid){origen=null;nNull++} else if(origen==='auto')nAuto++; else nRegla++
  rows.push({censo_unidad:unidad,censo_area:area||null,censo_cama:bed,ubicacion_id:uid||null,origen:origen||'manual'})
}
const {error}=await sb.from('homologacion_ubicaciones').upsert(rows,{onConflict:'censo_unidad,censo_area,censo_cama'})
console.log(error?('ERROR: '+error.message):'OK')
console.log('Ubicaciones distintas del CENSO:',rows.length)
console.log('  homologadas auto:',nAuto,'| por regla:',nRegla,'| SIN homologar:',nNull)
