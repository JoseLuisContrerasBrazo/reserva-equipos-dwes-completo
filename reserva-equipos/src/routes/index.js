import express from 'express';
import { exigirLogin, exigirRol, verificarCsrf } from '../middleware/security.js';

export function crearRouter(controladores, loginLimiter, repositorios) {
  const router = express.Router();
  router.get('/', controladores.inicio);
  router.get('/equipos', controladores.listarEquipos);
  router.get('/equipos/:id', controladores.detalleEquipo);

  router.get('/registro', controladores.registro);
  router.post('/registro', verificarCsrf, controladores.registrar);
  router.get('/login', controladores.login);
  router.post('/login', loginLimiter, verificarCsrf, controladores.autenticar);
  router.post('/logout', exigirLogin, verificarCsrf, controladores.logout);
  router.get('/perfil', exigirLogin, controladores.perfil);

  router.get('/reservas/nueva', exigirLogin, controladores.formularioReserva);
  router.post('/reservas', exigirLogin, verificarCsrf, controladores.crearReserva);
  router.get('/mis-reservas', exigirLogin, controladores.misReservas);
  router.post('/reservas/:id/cancelar', exigirLogin, verificarCsrf, controladores.cancelarReserva);

  router.get('/admin/equipos', exigirLogin, exigirRol('admin', repositorios), controladores.adminEquipos);
  router.post('/admin/equipos', exigirLogin, exigirRol('admin', repositorios), verificarCsrf, controladores.crearEquipo);
  router.post('/admin/equipos/:id/estado', exigirLogin, exigirRol('admin', repositorios), verificarCsrf, controladores.cambiarEstado);
  router.get('/admin/reservas', exigirLogin, exigirRol('admin', repositorios), controladores.adminReservas);
  router.post('/admin/reservas/:id/cancelar', exigirLogin, exigirRol('admin', repositorios), verificarCsrf, controladores.cancelarAdmin);
  return router;
}
