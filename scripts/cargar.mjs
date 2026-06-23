import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY)
const {error:ae}=await sb.auth.signInWithPassword({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD}); if(ae){console.error(ae.message);process.exit(1)}
const norm=s=>(s??'').toString().trim().toLowerCase()
const siNo=v=>String(v??'').trim().toUpperCase()!=='NO'
const num=v=>{const n=Number(v);return isNaN(n)?0:n}
function tipoDe(et){const s=norm(et);
 if(/camilla|^cami/.test(s))return 'camilla';
 if(/sill[oó]n|silla|^sill/.test(s))return 'sillon';
 if(/cuna|^cama/.test(s))return 'cama';
 if(/^ci\b|^ce\b|esclusa|cub/.test(s))return 'cubiculo';
 if(/reanimaci/.test(s))return 'habitacion';
 if(/^\d{3}[ab]?$|^[78]\d{2}[ab]?$|^9\d/.test(s))return 'habitacion';
 return 'area'}
const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile('docs/Plantilla_Pisos_Ubicaciones.xlsx')
const ci=ws=>{const m={};ws.getRow(1).eachCell((c,col)=>m[norm(c.value)]=col);return m}
const P=wb.getWorksheet('Pisos'),U=wb.getWorksheet('Ubicaciones'),ip=ci(P),iu=ci(U)
const {data:sedes}=await sb.from('sedes').select('id,nombre'); const sid=new Map(sedes.map(s=>[norm(s.nombre),s.id]))
const pisos=[]; P.eachRow((r,n)=>{if(n===1)return;const sede=String(r.getCell(ip['sede']).value??'').trim();const nombre=String(r.getCell(ip['nombre']).value??'').trim();if(!sede||!nombre)return;pisos.push({sede_id:sid.get(norm(sede)),numero:num(r.getCell(ip['numero']).value),nombre,orden:num(r.getCell(ip['orden']).value),activo:siNo(r.getCell(ip['activo']).value)})})
// Mapeo: etiqueta = col "Tipo" (D), area = col "Area" (C), tipo físico deducido de la etiqueta
const ubic=[]; U.eachRow((r,n)=>{if(n===1)return;const sede=String(r.getCell(iu['sede']).value??'').trim();const piso=String(r.getCell(iu['piso']).value??'').trim();const etiqueta=String(r.getCell(iu['tipo']).value??'').trim();const area=String(r.getCell(iu['area']).value??'').trim();if(!sede||!piso||!etiqueta)return;ubic.push({sede,piso,area:area||null,tipo:tipoDe(etiqueta),etiqueta,cupo_default:num(r.getCell(iu['cupo']).value)||1,orden:num(r.getCell(iu['orden']).value),activo:siNo(r.getCell(iu['activo']).value)})})
const porPiso={}; ubic.forEach(u=>porPiso[u.piso]=(porPiso[u.piso]||0)+1)
console.log('Pisos (orden):'); pisos.sort((a,b)=>a.orden-b.orden).forEach(p=>console.log(`  ${p.orden}. ${p.nombre} (Nº${p.numero}) → ${porPiso[p.nombre]||0} ubic`))
console.log('Total ubicaciones:', ubic.length)
// wipe + insert
await sb.from('ubicaciones').delete().not('id','is',null)
await sb.from('pisos').delete().not('id','is',null)
const {data:insP,error:eP}=await sb.from('pisos').insert(pisos).select('id,sede_id,nombre'); if(eP){console.error('pisos:',eP.message);process.exit(1)}
const pk=new Map(insP.map(p=>[p.sede_id+'|'+norm(p.nombre),p.id]))
const payloadU=ubic.map(u=>({piso_id:pk.get(sid.get(norm(u.sede))+'|'+norm(u.piso)),area:u.area,tipo:u.tipo,etiqueta:u.etiqueta,cupo_default:u.cupo_default,orden:u.orden,activo:u.activo})).filter(u=>u.piso_id)
const {data:insU,error:eU}=await sb.from('ubicaciones').insert(payloadU).select('id'); if(eU){console.error('ubic:',eU.message);process.exit(1)}
console.log('\nCargado → pisos:',insP.length,'ubicaciones:',insU.length)
