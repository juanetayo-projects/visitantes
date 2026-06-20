-- ============================================================
--  Seed de DEMOSTRACIÓN (datos ficticios para probar el mapa)
--  Borrar cuando entre el sync real de GoMedisys/CENSO:
--    delete from visita_eventos; delete from visitas;
--    update tarjetas set estado='disponible', visita_id=null;
--    delete from aislamientos; delete from pacientes_ubicacion;
--    delete from visitantes;
-- ============================================================
with p7 as (select id from pisos where nombre='Piso 7 Hospitalización')
insert into pacientes_ubicacion (num_ingreso,documento,nombre,edad,ubicacion_id,piso_id,ubicacion_etiqueta,servicio,fecha_ingreso)
select v.ni, v.doc, v.nom, v.ed, u.id, u.piso_id, u.etiqueta, 'Hospitalización', current_date - (v.dias||' days')::interval
from (values
  ('H-48213','29498454','María Idalba Rojas Ocampo',76,'701A',3),
  ('H-48190','6388710','Jairo Hernández',71,'702A',2),
  ('H-48155','27224005','Blanca Lidia Astur',71,'703A',5),
  ('H-48077','6315008','Herney Saavedra Brand',84,'704A',8),
  ('H-48160','1133404006','Luz Elena Carabalí González',29,'705A',4),
  ('H-48233','34390270','José Leonardo Monroy',52,'706A',1),
  ('H-48118','29705273','Sofía Dorado',43,'707A',6),
  ('H-48251','10498221','José Reinel Delgado Chocué',49,'708A',2)
) v(ni,doc,nom,ed,et,dias)
join ubicaciones u on u.etiqueta = v.et and u.piso_id = (select id from p7)
on conflict (num_ingreso) do nothing;

insert into aislamientos (num_ingreso,tipo) values ('H-48155','contacto'),('H-48160','gotas');

insert into visitantes (cedula,nombres_completos,celular) values
  ('1002898224','Hernando Trochez','3001112233'),
  ('1143950373','Jessica Zapata','3002223344'),
  ('66882400','Isabel Tovar','3003334455'),
  ('29687465','Sandra Chamorro','3004445566'),
  ('1133404004','Tulia Carabalí','3005556677'),
  ('34609177','Francia Delgado','3006667788'),
  ('39381710','María Correa','3007778899')
on conflict (cedula) do nothing;

with m(ced, ni, tipoacc, card, hmin) as (values
  ('1002898224','H-48213','permanente','T-007', 290),
  ('1143950373','H-48190','visita','T-012', 42),
  ('66882400','H-48190','visita','T-013', 41),
  ('29687465','H-48155','permanente','T-004', 185),
  ('1133404004','H-48160','permanente','T-002', 320),
  ('34609177','H-48118','permanente','T-009', 240),
  ('39381710','H-48251','visita','T-021', 28)
)
insert into visitas (tipo_visitante, visitante_id, tipo_acompanante, paciente_documento, paciente_nombre, num_ingreso, ubicacion_id, ubicacion_etiqueta, piso_id, servicio_paciente, aislamiento, sede_id, puerta_id, tarjeta_id, estado, created_at)
select 'familiar', vi.id, m.tipoacc::tipo_acompanante, pac.documento, pac.nombre, pac.num_ingreso, pac.ubicacion_id, pac.ubicacion_etiqueta, pac.piso_id, pac.servicio,
  (select a.tipo from aislamientos a where a.num_ingreso = pac.num_ingreso and a.vigente limit 1),
  (select id from sedes where nombre='Torre de Salud'),
  (select id from puertas where nombre='Puerta BodyTech' limit 1),
  t.id, 'activa', now() - (m.hmin||' min')::interval
from m
join visitantes vi on vi.cedula = m.ced
join pacientes_ubicacion pac on pac.num_ingreso = m.ni
left join tarjetas t on t.codigo = m.card;

update tarjetas t set estado='en_uso', visita_id=v.id from visitas v where v.tarjeta_id = t.id;
insert into visita_eventos (visita_id, tipo, hora) select id, 'ingreso', created_at from visitas;
