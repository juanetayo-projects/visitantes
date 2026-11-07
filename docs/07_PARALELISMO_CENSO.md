# Paralelismo entre la app y el CENSO

Qué pasa cuando la clínica crea una ubicación o cambia su nombre, y qué debe hacer el administrador.

## Cómo reconoce la app una ubicación

El censo reporta cada paciente con `IdUbicacionGomedisys` (la **unidad**), `UbicacionArea` y `Cama`.
El censo **no** trae un ID por cama: la cama solo se identifica por su nombre.

1. La unidad se reconoce por su ID, y cada unidad pertenece a un piso (`censo_unidades`).
2. La cama se busca en `homologacion_ubicaciones`.
3. Si no está, se busca una ubicación activa **del mismo piso** con ese nombre. Nunca se empareja entre pisos.
4. Si tampoco hay, queda pendiente en Homologación CENSO y como inconsistencia en Sincronización CENSO.

## Qué hacer en cada caso

| Cambio en la clínica | Qué hace la app sola | Qué debe hacer el administrador |
|---|---|---|
| Renombran una **unidad** | La sigue reconociendo por su ID y actualiza el nombre | Nada |
| Crean una **unidad** nueva | La registra sin piso y reporta sus pacientes | Asignarle el piso en *Sedes y ubicaciones → Censo vs app* |
| Crean una **cama** nueva | La deja pendiente, salvo que ya exista con ese nombre en el piso | Crearla en *Ubicaciones*; la siguiente sincronización la homologa sola |
| Renombran una **cama** | La ve como cama nueva y la deja pendiente | Cambiar la etiqueta en *Ubicaciones*, o asignarla a la existente en *Homologación CENSO* |
| Dan de baja una **cama** | Nada hasta que el censo reporte un paciente allí | Marcarla inactiva en *Ubicaciones* |
| Reporta paciente en cama **inactiva** | Lo reporta como inconsistencia | Reactivarla o corregir la homologación |

## Rutina recomendada

Revisar *Sedes y ubicaciones → Censo vs app* cada semana y cuando la clínica anuncie cambios.
La lista **Diferencias con el censo** debe quedar vacía.

Pedir a la clínica que avise los cambios de ubicaciones antes de aplicarlos en GoMedisys evita
que haya pacientes sin ubicar mientras se ajusta el catálogo.

## Garantía al registrar una visita

Al elegir un paciente, Registrar visita consulta el censo en vivo:

- **Misma ubicación:** la confirma.
- **Cambió de cama:** avisa y registra la ubicación del censo.
- **Ya no está en el censo:** no permite registrar la visita.
- **El censo no responde:** avisa que el dato es de la última sincronización y permite continuar,
  para no detener la portería.
