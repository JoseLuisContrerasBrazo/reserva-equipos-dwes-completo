# Sistema de reserva de equipos informáticos — DWES UD 2 y 3

Aplicación educativa desarrollada con Node.js, Express, EJS y JavaScript, con un núcleo adicional en TypeScript. La persistencia es en memoria mediante repositorios; no requiere base de datos.

> **Importante para la entrega:** revisa y comprende cada archivo, ejecuta las pruebas en tu ordenador, añade el enlace real a tu conversación de apoyo con IA y confirma el último commit antes de la fecha de Classroom. El historial de IA forma parte de la evaluación.

## 1. Requisitos

- Node.js 20 o superior (recomendado Node 22 LTS).
- npm.
- Git para la entrega.

## 2. Instalación y configuración

```bash
npm install
cp .env.example .env
```

Edita `.env` y establece `SESSION_SECRET` con una cadena aleatoria de al menos 32 caracteres. No subas `.env` al repositorio.

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=pon-aqui-una-clave-larga-y-aleatoria-de-32-caracteres-o-mas
```

Arranque:

```bash
npm start
```

Abre `http://localhost:3000`. Para desarrollo con reinicio automático:

```bash
npm run dev
```

La aplicación valida `PORT`, `NODE_ENV` y `SESSION_SECRET` al arrancar y se detiene si son incorrectos.

## 3. Usuarios de demostración

Los usuarios se crean al arrancar y las contraseñas se guardan con bcrypt:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@example.com` | `Admin123!` |
| Usuario | `ana@example.com` | `Ana12345!` |
| Usuario | `lucia@example.com` | `Lucia123!` |

Son credenciales de demostración. No reutilices estas contraseñas en cuentas reales.

## 4. Funcionalidades implementadas

### Catálogo de equipos
- `GET /equipos`: lista equipos.
- `GET /equipos?tipo=portatil`: filtra portátiles.
- `GET /equipos?tipo=sobremesa`: filtra sobremesa.
- `GET /equipos?operativos=true`: filtra equipos operativos.
- `GET /equipos?tipo=portatil&operativos=true`: aplica ambos filtros.
- `GET /equipos/:id`: ficha de equipo.
- Cookie de preferencia `preferenciaEquipo` para recordar el tipo preferido. Es una cookie de preferencia no `httpOnly`; nunca se utiliza para autorización.

### Cuenta y sesión
- `GET/POST /registro`: valida nombre, email, contraseña y duplicados; el rol público se fija en `usuario`; bcrypt.
- `GET/POST /login`: comparación bcrypt, mensaje genérico y regeneración de sesión tras autenticar.
- `POST /logout`: requiere autenticación y CSRF, destruye sesión y elimina la cookie `sid`.
- `GET /perfil`: requiere sesión.
- `express-session` usa `httpOnly`, `sameSite=lax`, `secure` en producción y `maxAge` de dos horas.

### Reservas
- `GET /reservas/nueva`: consulta disponibilidad para fecha/turno y muestra únicamente equipos operativos sin reserva activa.
- `POST /reservas`: vuelve a validar en el servidor, obtiene el usuario desde la sesión y usa PRG (303).
- `GET /mis-reservas`: muestra reservas activas y canceladas del usuario.
- `POST /reservas/:id/cancelar`: solo permite cancelar reserva propia activa no pasada; cambia estado, no borra.
- Conflictos equipo+fecha+turno activos responden 409. Una cancelada deja de bloquear disponibilidad. El repositorio en memoria comprueba el conflicto en la misma operación de escritura para evitar duplicados por peticiones concurrentes dentro de un único proceso Node.js.

### Administración
- `GET /admin/equipos`: panel de equipos.
- `POST /admin/equipos`: añade equipo.
- `POST /admin/equipos/:id/estado`: cambia entre `operativo` y `fuera_de_servicio`.
- `GET /admin/reservas`: consulta global.
- `POST /admin/reservas/:id/cancelar`: cancela una reserva activa.
- Todas las rutas admin comprueban autenticación y rol en el servidor.

### Seguridad y presentación
- Middleware reutilizable de autenticación y autorización.
- Token CSRF por sesión en formularios que modifican estado, incluido logout.
- Rate limit en login.
- Validación de campos, errores de dominio y middleware de errores centralizado.
- EJS utiliza `<%= ... %>` para escapar contenido mostrado.
- Parciales `views/partials/header.ejs` y `footer.ejs`.
- El formulario de reserva utiliza un modelo de vista `vm` con fecha, turno, equipos, valores y errores.
- Mensajes de confirmación flash de un solo uso.

## 5. Arquitectura

```text
src/
├── app.js                    # configura Express y devuelve app para tests
├── server.js                 # arranque HTTP separado
├── config/env.js              # carga y valida entorno
├── domain/                    # reglas puras y ErrorDominio
├── repositories/memory.js      # acceso a colecciones en memoria
├── services/reservas.js       # reglas de reserva y equipos
├── middleware/security.js      # login, roles, CSRF y usuario actual
├── controllers/controllers.js  # adaptación HTTP, vistas y redirecciones
├── routes/index.js            # métodos, URL y middleware
└── typescript/                # núcleo tipado separado
```

Flujo de una reserva: **ruta → middleware → controlador → servicio → repositorio**. El servicio no importa Express ni EJS. Las funciones `estaReservado`, `obtenerEquiposDisponibles` y `validarReserva` están en `src/domain/reservas.js`, fuera de controladores HTTP.

## 6. TypeScript

El módulo tipado incluye:
- interfaces `Equipo`, `Reserva`, `Usuario`;
- tipos unión `Rol`, `Turno`, `EstadoEquipo`, `EstadoReserva`;
- interfaz `RepositorioReservas`;
- clase `RepositorioReservasMap` basada en `Map`;
- `ServicioReservasTipado` que recibe el repositorio por inyección de dependencias y permite consultar disponibilidad y crear reservas;
- anotaciones explícitas en métodos públicos, con `strict: true` y sin `any`;
- el repositorio Map devuelve copias y ofrece `crearSiDisponible`, que comprueba y registra una reserva sin intercalar otra operación dentro del mismo proceso.

Compilar:

```bash
npm run build:ts
```

Comprobar tipos sin emitir archivos:

```bash
npm run typecheck
```

## 7. Pruebas automatizadas

Las pruebas usan Vitest y Supertest con repositorios de prueba controlados. No arrancan un servidor manual.

```bash
npm test
```

Cubren los diez comportamientos exigidos: registro válido, credenciales incorrectas, ruta privada anónima, perfil con sesión, prohibición admin a usuario, reserva válida, duplicado, cancelación ajena, CSRF inválido y sesión destruida tras logout.

## 8. Ejemplos curl reproducibles

Los formularios HTML son la vía recomendada para probar. Para curl, primero conserva cookies y extrae el token CSRF de la página; cada sesión tiene su propio token.

### 8.1 Catálogo público

```bash
curl -i http://localhost:3000/equipos
curl -i 'http://localhost:3000/equipos?tipo=portatil&operativos=true'
curl -i http://localhost:3000/equipos/1
```

### 8.2 Obtener cookie y CSRF, registro

En Git Bash, con `curl` y `grep` disponibles:

```bash
curl -s -c cookies.txt http://localhost:3000/registro -o registro.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' registro.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/registro \
  -d "_csrf=$TOKEN" -d "nombre=Mario Prueba" \
  -d "email=mario.prueba@example.com" -d "password=Password123"
```

### 8.3 Login y perfil

```bash
curl -s -b cookies.txt -c cookies.txt http://localhost:3000/login -o login.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' login.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/login \
  -d "_csrf=$TOKEN" -d 'email=ana@example.com' -d 'password=Ana12345!'
curl -i -b cookies.txt http://localhost:3000/perfil
```

### 8.4 Consultar disponibilidad y reservar

```bash
curl -s -b cookies.txt -c cookies.txt 'http://localhost:3000/reservas/nueva?fecha=2030-02-10&turno=manana' -o reserva.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' reserva.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/reservas \
  -d "_csrf=$TOKEN" -d 'equipoId=2' -d 'fecha=2030-02-10' -d 'turno=manana'
curl -i -b cookies.txt http://localhost:3000/mis-reservas
```

### 8.5 Cancelar reserva propia

Obtén token desde `/mis-reservas` (misma sesión):

```bash
curl -s -b cookies.txt -c cookies.txt http://localhost:3000/mis-reservas -o mis-reservas.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' mis-reservas.html | head -1 | sed 's/.*value="//;s/"//')
# Sustituye 4 por el ID real de tu reserva
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/reservas/4/cancelar -d "_csrf=$TOKEN"
```

### 8.6 Operaciones de administración

Inicia sesión como `admin@example.com` / `Admin123!` en una cookie jar independiente. Obtén el token de `/admin/equipos` y envíalo en cada POST:

```bash
curl -s -c admin-cookies.txt http://localhost:3000/login -o admin-login.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' admin-login.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b admin-cookies.txt -c admin-cookies.txt -X POST http://localhost:3000/login \
  -d "_csrf=$TOKEN" -d 'email=admin@example.com' -d 'password=Admin123!'
curl -s -b admin-cookies.txt -c admin-cookies.txt http://localhost:3000/admin/equipos -o admin-equipos.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' admin-equipos.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b admin-cookies.txt -c admin-cookies.txt -X POST http://localhost:3000/admin/equipos \
  -d "_csrf=$TOKEN" -d 'codigo=PORT-002' -d 'nombre=Portatil aula 2' -d 'tipo=portatil'
# Obtener token de nuevo si el formulario se recarga y cambiar estado:
curl -s -b admin-cookies.txt -c admin-cookies.txt http://localhost:3000/admin/equipos -o admin-equipos.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' admin-equipos.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b admin-cookies.txt -c admin-cookies.txt -X POST http://localhost:3000/admin/equipos/1/estado \
  -d "_csrf=$TOKEN" -d 'estado=fuera_de_servicio'
curl -i -b admin-cookies.txt http://localhost:3000/admin/reservas
```

### 8.7 Logout

```bash
curl -s -b cookies.txt -c cookies.txt http://localhost:3000/perfil -o perfil.html
TOKEN=$(grep -o 'name="_csrf" value="[a-f0-9]*"' perfil.html | head -1 | sed 's/.*value="//;s/"//')
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/logout -d "_csrf=$TOKEN"
curl -i -b cookies.txt http://localhost:3000/perfil
```

## 9. Mapa de rutas

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/` | Público |
| GET | `/equipos`, `/equipos/:id` | Público |
| GET/POST | `/registro` | Público; POST CSRF |
| GET/POST | `/login` | Público; POST rate limit + CSRF |
| POST | `/logout` | Login + CSRF |
| GET | `/perfil` | Login |
| GET | `/reservas/nueva` | Login |
| POST | `/reservas` | Login + CSRF |
| GET | `/mis-reservas` | Login |
| POST | `/reservas/:id/cancelar` | Login + CSRF + propiedad |
| GET | `/admin/equipos` | Admin |
| POST | `/admin/equipos` | Admin + CSRF |
| POST | `/admin/equipos/:id/estado` | Admin + CSRF |
| GET | `/admin/reservas` | Admin |
| POST | `/admin/reservas/:id/cancelar` | Admin + CSRF |


**ENLACE IA :** ``

