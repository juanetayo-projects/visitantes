import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
await sb.auth.signInWithPassword({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})
const norm=s=>(s??'').toString().trim().toLowerCase()
const FILE = process.argv[2] || 'docs/Plantilla_Pisos_Ubicaciones.xlsx'
const wb=new ExcelJS.Workbook(); await wb.xlsx.readFile(FILE)
console.log('Archivo:', FILE)
console.log('Hojas:', wb.worksheets.map(w=>`${w.name}(${w.rowCount}f)`).join(' | '))
const ci=ws=>{const m={};ws.getRow(1).eachCell((c,col)=>m[norm(c.value)]=col);return m}
const wsP=wb.getWorksheet('Pisos'), wsU=wb.getWorksheet('Ubicaciones')
if(!wsP||!wsU){console.log('ERROR: faltan hojas Pisos/Ubicaciones'); process.exit(1)}
console.log('Encabezados Pisos:', Object.keys(ci(wsP)).join(', '))
console.log('Encabezados Ubicaciones:', Object.keys(ci(wsU)).join(', '))
const {data:sedes}=await sb.from('sedes').select('nombre'); const sedeSet=new Set(sedes.map(s=>norm(s.nombre)))
const ip=ci(wsP), iu=ci(wsU)
const TIPOS=new Set(['habitacion','cubiculo','sillon','cama','camilla','area'])
// Pisos
const pisos=[]; const errP=[]; const pisoKeys=new Set()
wsP.eachRow((r,n)=>{if(n===1)return;const sede=String(r.getCell(ip['sede']).value??'').trim();const nombre=String(r.getCell(ip['nombre']).value??'').trim();if(!sede&&!nombre)return;
  if(!sede)errP.push(`Fila ${n}: sede vacía`); else if(!sedeSet.has(norm(sede)))errP.push(`Fila ${n}: sede "${sede}" no existe en BD`);
  if(!nombre)errP.push(`Fila ${n}: nombre de piso vacío`);
  const k=norm(sede)+'|'+norm(nombre); if(pisoKeys.has(k))errP.push(`Fila ${n}: piso duplicado (${sede} / ${nombre})`); pisoKeys.add(k);
  pisos.push({sede,nombre})})
// Ubicaciones
const errU=[]; let nU=0; const ukeys=new Set(); const tipoCount={}; const porPiso={}
wsU.eachRow((r,n)=>{if(n===1)return;const sede=String(r.getCell(iu['sede']).value??'').trim();const piso=String(r.getCell(iu['piso']).value??'').trim();const et=String(r.getCell(iu['etiqueta']).value??'').trim();const area=String(r.getCell(iu['area']).value??'').trim();const tipo=norm(r.getCell(iu['tipo']).value);const cupo=Number(r.getCell(iu['cupo']).value);
  if(!sede&&!piso&&!et)return; nU++;
  if(!sede||!sedeSet.has(norm(sede)))errU.push(`Fila ${n}: sede "${sede}" inválida`);
  if(!piso||!pisoKeys.has(norm(sede)+'|'+norm(piso)))errU.push(`Fila ${n}: piso "${piso}" no está en hoja Pisos`);
  if(!et)errU.push(`Fila ${n}: etiqueta vacía`);
  if(!TIPOS.has(tipo))errU.push(`Fila ${n}: tipo "${tipo}" inválido`);
  if(isNaN(cupo)||cupo<1)errU.push(`Fila ${n}: cupo inválido (${r.getCell(iu['cupo']).value})`);
  const k=norm(sede)+'|'+norm(piso)+'|'+norm(area)+'|'+norm(et); if(ukeys.has(k))errU.push(`Fila ${n}: ubicación duplicada (${piso}/${area}/${et})`); ukeys.add(k);
  tipoCount[tipo]=(tipoCount[tipo]||0)+1; porPiso[piso]=(porPiso[piso]||0)+1})
console.log('\n=== RESUMEN ===')
console.log('Sedes en BD:', [...sedeSet].join(', '))
console.log('Pisos en archivo:', pisos.length)
console.log('Ubicaciones en archivo:', nU)
console.log('Tipos:', JSON.stringify(tipoCount))
console.log('\nUbicaciones por piso:'); Object.entries(porPiso).forEach(([p,c])=>console.log(`  ${p}: ${c}`))
console.log('\n=== ERRORES Pisos ('+errP.length+') ==='); errP.slice(0,20).forEach(e=>console.log('  '+e))
console.log('\n=== ERRORES Ubicaciones ('+errU.length+') ==='); errU.slice(0,30).forEach(e=>console.log('  '+e))
console.log(errU.length>30?`  … y ${errU.length-30} más`:'')
