# Web para GitHub Pages

Esta carpeta es la parte que va a GitHub.

GitHub Pages sirve solo archivos estaticos, por eso la arquitectura queda asi:

```text
GitHub Pages
  index.html
  styles.css
  app.js
  manifest.webmanifest
  sw.js
  icon.svg
  icon-192.png
  icon-512.png
  apple-touch-icon.png

Google Apps Script
  Code.gs
  Google Sheet
  Telegram
```

## Pasos

1. Crear un repositorio en GitHub.
2. Subir los archivos de esta carpeta a la raiz del repo.
3. Ir a `Settings > Pages`.
4. Elegir `Deploy from a branch`.
5. Elegir la rama `main` y carpeta `/root`.
6. Pegar la URL publicada en el celular.

## Backend sin PIN

En el proyecto de Google Apps Script conectado a tu Google Sheet:

1. Reemplaza el contenido de `Code.gs` con el archivo `Code.gs` actualizado.
2. Guarda el proyecto.
3. Ve a `Implementar > Administrar implementaciones`, edita la implementación web con el lápiz y crea una versión nueva.
4. Mantén `Ejecutar como: Yo` y `Quién tiene acceso: Cualquier usuario`.
5. No hace falta crear la propiedad `APP_SHARED_SECRET`.
6. Conserva la URL que termina en `/exec`; la app ya está configurada con esa URL.

**Acceso público:** sin clave, cualquiera que obtenga la URL de la app o del puente puede leer y modificar la hoja de gastos. No uses esta versión si esos datos deben ser privados.

## Primer uso

Al abrir la web de GitHub Pages, la app se conecta automaticamente al Apps Script configurado en `app.js`. No hay que cargar URL ni clave en el celular.

Si cambias la implementacion de Apps Script y se genera una URL nueva, actualiza la constante `APP_CONFIG.apiUrl` en `app.js`. Para evitar eso, conviene editar la implementacion web existente en Apps Script en vez de crear una nueva.

## Si el celular sigue mostrando una version vieja

Despues de subir estos archivos a GitHub, abrí una vez esta direccion en el celular:

```text
https://mig985.github.io/Gastos/cache-reset.html
```

Esa pagina borra la cache anterior de la PWA y entra automaticamente a la app nueva.

## Instalar en el celular

La web ya tiene manifest, service worker e icono de app.

En Android/Chrome, abrir la web y tocar el icono de descarga en la cabecera. Si el navegador ya ofrece instalacion nativa, aparece el dialogo de instalar.

En iPhone/Safari, tocar el icono de descarga para ver el recordatorio y despues usar:

```text
Compartir > Agregar a pantalla de inicio
```

## Nota importante

Apps Script no funciona como una API CORS normal. Por eso esta web usa un iframe puente invisible, el mismo patron usado por la app Inventario: GitHub Pages habla con el puente por `postMessage` y el puente ejecuta Apps Script con `google.script.run`.
