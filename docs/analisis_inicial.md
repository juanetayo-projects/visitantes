Build: Aplicacion Control Ingreso de Visitantes

Se requiere construir una app que permita

	.- Construye el proyecto a partir de la ruta de mi pc C:\Users\Juan Carlos Etayo\visitantes
	En la ruta: C:\Users\Juan Carlos Etayo\visitantes\images se encuentran los logos de la Clinica
	.- El color azul debe utilizar este:#0D2D6B y con constrastes de este azul #16468E
	

1.- Infraestructura
	Github (ya cuento con MCP para todo el despliegue)
		El nombre del repositorio deber ser: visitantes
	Supabase (ya cuento con MCP para todo el despliegue)
		El nombre del repositorio deber ser: visitantes
	Resend (ya cuento con MCP para todo el despliegue)
		La API Key deben llamarse notificacionprogturnos
	Formato de ingreso
		ver archivo planilla.jpeg  ubicado en la carpeta C:\Users\Juan Carlos Etayo\visitantes\docs

2.- Brandig
	Utilizar los logos de la Clínica que estan ubicados en la carpeta C:\Users\Juan Carlos Etayo\visitantes\images
	Colores azul debe utilizar este:#0D2D6B y con constrastes de este azul #16468E
	Cards metrics, tablas, filtros, etc utiliza bordes sombreados para destacar
	Cards metrics utilizar colores de fonde acuerdo a la necesidad
	Utilizar todos los filtros posibles que faciliente la navegacion y consulta de la informacion
	Metodos de exportar Excel, PDF
	Estadisticas todas posibles
	Utilizar mapa de calor que permita identificar el flujo de visitantes por sede, piso o servicio, dias de la semana y horarios del dias
	Utilizar zona horaria Colombia -5 GMT
	Tener en cuenta el calendario de Colombia, domingos y festivos para efectos de las graficas, mapa de calor e informes
	
3.- Tablas de datos a implementar
		Usuario del sistema
			Administrador
			Orientador
			Coordinador

		Responsable
			Esta tabla aplica para cuando quien ingresa es tipo (proveedor)
			Por lo tanto cuando el tipo es proveedor se de solicitar los siguientes datos
				Persona respnsable (debe existir una tabla con todos los datos del colaborador responsable de atender al proveedor)
				Servicio (Debe ser una tabla que ya tenemos en otros proyectos)
				Cargo (Cargo del responsable)				
				
		Tipo de visitantes
			Familiar
			Proveedor
			Colaborador
		

		Sedes
			Ubicaciones
				Torre de Salud
					Puerta (BodyTech)
					Puerta (Ambulancias)
				 
				 Urgencias
					Puerta (Ambulancias)
					Puerta (Administración)
			
		Piso de la Torre de Salud
			Piso
				en cada piso existen habitaciones, cubiclos, sillones, camillas
				Torre de Salud existen lo siguientes pisos 
					Piso 1 Imagenes
					Piso 2 Hospitalizacion HD
					Piso 5 Cirugia
					Piso 6 UCI
					Piso 6 UCIN
					Piso 7 Hospitalizacion
					Piso 8 Hospitalizacion
					Piso 9 Hospitlizacion
				Urgencias existe un solo Piso
					Piso 1 Urgencias
					
			Ubicaciones (en la Torre de salud) 
			    Piso 1 (Tomografia, Ecografia, Recuperacion, Mamografia, Densitomertria)
				Piso 2 (Cubiclo 1....Cubiculo 36, Sillon 1...Sillon 24)
				Piso 5 UCI (Cubiculo 1...Cubiculo 24)
				Piso 5 UCIN (Cubiculo 1...Cubiculo 24)
				Piso 7 (Habitacion 701A, Habitacion 701B,.....Habitacion 730A, Habitacion 730B)
				Piso 8 (Habitacion 801A, Habitacion 801B,.....Habitacion 830A, Habitacion 830B)
				Piso 9 (Sillon 1...Sillon24)
			
			Ubicaciones (en Urgencias)
				Piso 1
				Ubicaciones 
				Observacion-1
					Cama 1...Cama12
					Camilla 1...Camilla 12
					Sillon 1...Sillon 12
				Observacion-2
					Cama 1...Cama12
					Camilla 1...Camilla 12
					Sillon 1...Sillon 12
				Observacion-3
					Cama 1...Cama12
					Camilla 1...Camilla 12
					Sillon 1...Sillon 12
				Observacion-4
					Cama 1...Cama12
					Camilla 1...Camilla 12
					Sillon 1...Sillon 12
				Pediatria
					Cama 1...Cama12
					Camilla 1...Camilla 12
					Sillon 1...Sillon 12

			Visitantes
				Cedula
				Nombres completos
				Celular
				email (no obligatorio)
				
			Control de Ingreso
				datos del paciente (cedula, # de ingreso, ubicacion, otros) estos datos los voy a traer de la base de datos de GoMedisys utilizando un script qeu consulta esta informacion
				a partir de la ubicacion del paciente, pues es posible que el visitante no conozca datos como numero de cedula o nombre exacto como esta registrado en la base de dato de GoMedisys, por lo 
				tanto con el numero de la habitacion, o la ubucacion se hara la consulta, estos datos deben quedar asociados al registro de la visita, dado que con el tiempo la habitacion la ocuparan otros pacienets
			
				datos del visitante (familiar)
				hora de ingreso
				hora de salid
				
				Tipo de permiso
					posiblemente se le acutorice al visitante el ingreso de alimentos u otros elementos
					es posible que el visitante pueda ingresar y salir varias veces utilizando el mismo registro
				
				Tipo de Aislamiento
					Esta dato proviene de otra aplicacion que se llama CENSO y se consultara utilizando un script sql para traer estos datos
					
				
			
				datos del visitante (provedor)
				hora de ingreso
				hora de salida
				
				Acompañante autorizado
					Todo proveedor debe ser acompañado por una persona autorizada los datos ya estan en la tabla de Responsables
					es posible que el visitante pueda ingresar y salir varias veces utilizando el mismo registro
				

				
2.- Consideraciones		

	La aplicacion debe utlizar el login basados en los modelos anteriors de los proyectos ya desarrollados
	La aplicacion debera mostrar el mapa de camas cuando se vaya a registrar el visitante cuando este sea del tipo familiar
	La aplicacion debe contar con la opcion de recuperacion de contraseña
	La aplicacion debera mostrar a la persona que hace el registro del visitante con identificacion de colores y tooltip (tipo odoo.com) la informacion de las habitaciones que ya tiene algun visitante previamente ingresado, esto con el objetivo de poder conocer si ya hay algun acompañante o familiar con el paciente
	Se debe tener en cuenta la opcion de salida y entrega de la tarjeta de acceso que se le asigna al visitante para liberar el cupo de la visita
	


Por favor analizar primero el archivo adjunto, antes de iniciar cualquier desarrollo, por lo cual es necesario que me presentes tus comentarios y obaservaciones

