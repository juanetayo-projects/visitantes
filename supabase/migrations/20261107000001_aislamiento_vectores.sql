-- El censo reporta aislamiento por «Vectores» («Gotas» ya existía en el enum).
alter type tipo_aislamiento add value if not exists 'vectores';
