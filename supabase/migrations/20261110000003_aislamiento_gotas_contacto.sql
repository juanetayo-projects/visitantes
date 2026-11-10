-- El censo reporta aislamiento combinado «Gotas / Contacto» (UCIN, nov-2026). Sin este valor el
-- sync lo marcaba como «aislamiento no contemplado» y el paciente quedaba como NO aislado.
alter type tipo_aislamiento add value if not exists 'gotas_contacto';
