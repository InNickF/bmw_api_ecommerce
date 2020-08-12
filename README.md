# [apiecommerce](https://apiecommerce.arepa.co)

## Instalación

Instalación

```
$ npm install
```

## Entorno de desarrollo

Empezaremos correr el comando, para inciar el servidor

```
$ npm run dev
```

Acceder a http://localhost:8080 o el puerto configurado en tus variables de entorno.

**Nota:** Al actualizar cualquier archivo automaticamente actualiza el servicio.

## Lanzamiento a staging o producción

Para apiecommerce se usan 2 entornos, uno es para testiar todos los cambios. Cuando ya todo esta probado, se sube a la rama staging y automaticamente empieza el proceso de despliegue y la rama master es la que se encuentra en producción

Staging
```
$ git push origin staging
```
Producción
```
$ git push origin master
```
#### Ramas (Git)

- **master** - Producción.
- **Staging** - Pruebas.
 


#### Dominio de apiecommerce 

- https://apiecommerce.arepa.co - Producción.
- https://stagingapiecm.arepa.co - Pruebas.

## Archivos de configuración

#### .env

En este archivo se agregan constantes globales y accesibles.

| Constante                 | Tipo     | Descripción
| ------------------------ | --------  | ---------------------------------------------------------------------------------------
| **DATABASE**	 	       | `String`  | Nombre de la base de datos.
| **DB_HOST**	 	           | `String`  | Host donde esta ubicada la base de datos.
| **DB_NAME**	 	       | `String`  | Nombre de la base de datos.
| **DB_PASSWORD**	 	       | `String`  | Contraseña de la base de datos.
| **DB_PORT**	 	   | `Number` | Puerto de la base de datos.
| **DB_USER**  | `String`  | Usuario de la base de datos.
| **NODE_ENV**	 	       | `String`  | Entorno en el cual esta ejecutando el server development o production
| **MERCADO_PAGO_PUBLIC_KEY**  | `String`  | Llave de acceso de mercadopago.
| **MERCADO_PAGO_ACCES_TOKEN**  | `String`  | Llave de acceso de mercadopago.
| **MERCADOPAGO_HOOKS**  | `String`  | Url a la cual mercado pago informara.

## Instalación de librerías

Para la instalación de librerías usar **NPM** en lo posible.

```
$ NPM install [dependencia] --save
```


## Arquitectura de folders

```javascript
build/ /*Aquí esta todo el código*/
	common/ /*Código fuente de los modelos usados con loopback*/
	    models/ /*Modelos de usados myuser, payment etc*/
	integrations/ /*Integraciones*/
	    mercadoPago/ /*Integración base para mercado pago*/
```

**Nota:** Las carpetas o archivos que no aparecen, no hace falta especificarlos.
