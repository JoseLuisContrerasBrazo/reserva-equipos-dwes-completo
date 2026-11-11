import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { crearRepositoriosIniciales } from './repositories/memory.js';
import { crearServicioReservas, crearServicioEquipos } from './services/reservas.js';
import { crearControladores } from './controllers/controllers.js';
import { cargarUsuario, prepararCsrf } from './middleware/security.js';
import { crearRouter } from './routes/index.js';
import { ErrorDominio } from './domain/errors.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export async function crearApp({ repositorios: repositoriosExternos } = {}) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(dirname, '..', 'views'));
  app.set('trust proxy', config.isProduction ? 1 : false);
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(cookieParser());
  app.use(express.static(path.join(dirname, '..', 'public')));
  app.use(session({
    name: 'sid', secret: config.sessionSecret,
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.isProduction, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 2 }
  }));

  const repositorios = repositoriosExternos ?? await crearDatosIniciales();
  app.locals.repositorios = repositorios;
  const servicioReservas = crearServicioReservas(repositorios);
  const servicioEquipos = crearServicioEquipos(repositorios);
  const controladores = crearControladores({ repositorios, servicioReservas, servicioEquipos });
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' });

  app.use((req, res, next) => {
    res.locals.aviso = req.session.aviso ?? null;
    delete req.session.aviso;
    next();
  });
  app.use(prepararCsrf);
  app.use(cargarUsuario(repositorios));
  app.use(crearRouter(controladores, loginLimiter, repositorios));
  app.use((req, res) => res.status(404).render('error', { titulo: 'Página no encontrada', mensaje: 'La ruta solicitada no existe.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof ErrorDominio ? error.status : 500;
    const mensaje = status === 500 ? 'Ha ocurrido un error interno. Inténtalo de nuevo.' : error.message;
    if (config.nodeEnv !== 'test') console.error(`[${error.codigo ?? error.name ?? 'ERROR'}] ${status === 500 ? error.message : mensaje}`);
    res.status(status).render('error', { titulo: status === 500 ? 'Error del servidor' : 'No se pudo completar', mensaje });
  });
  return app;
}


async function crearDatosIniciales() {
  const bcrypt = await import('bcrypt');
  const [adminHash, anaHash, luciaHash] = await Promise.all([
    bcrypt.hash('Admin123!', 12), bcrypt.hash('Ana12345!', 12), bcrypt.hash('Lucia123!', 12)
  ]);
  const equipos = [
    { id: 1, codigo: 'PC-001', nombre: 'Ordenador aula 1', tipo: 'sobremesa', estado: 'operativo' },
    { id: 2, codigo: 'PORT-001', nombre: 'Portátil Lenovo', tipo: 'portatil', estado: 'operativo' },
    { id: 3, codigo: 'PC-002', nombre: 'Ordenador aula 2', tipo: 'sobremesa', estado: 'fuera_de_servicio' }
  ];
  const usuarios = [
    { id: 1, nombre: 'Administrador', email: 'admin@example.com', passwordHash: adminHash, rol: 'admin' },
    { id: 2, nombre: 'Ana García', email: 'ana@example.com', passwordHash: anaHash, rol: 'usuario' },
    { id: 3, nombre: 'Lucía Martín', email: 'lucia@example.com', passwordHash: luciaHash, rol: 'usuario' }
  ];
  const reservas = [
    { id: 1, equipoId: 1, usuarioId: 2, fecha: '2027-01-15', turno: 'manana', estado: 'activa' },
    { id: 2, equipoId: 2, usuarioId: 3, fecha: '2027-01-16', turno: 'tarde', estado: 'activa' },
    { id: 3, equipoId: 1, usuarioId: 3, fecha: '2027-01-17', turno: 'manana', estado: 'cancelada' }
  ];
  return crearRepositoriosIniciales({ equipos, reservas, usuarios });
}
