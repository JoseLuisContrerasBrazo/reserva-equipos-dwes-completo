import crypto from 'node:crypto';

export function exigirLogin(req, res, next) {
  if (!req.session.userId) {
    req.session.aviso = { tipo: 'info', texto: 'Inicia sesión para continuar.' };
    return res.redirect(303, '/login');
  }
  next();
}

export function exigirRol(rol, repositorios) {
  return async (req, res, next) => {
    if (!req.session.userId) return res.status(401).render('error', { titulo: 'No autenticado', mensaje: 'Inicia sesión para acceder.' });
    try {
      const usuario = await repositorios.usuarios.buscarPorId(req.session.userId);
      if (!usuario || usuario.rol !== rol) return res.status(403).render('error', { titulo: 'Acceso denegado', mensaje: 'No tienes permisos para realizar esta operación.' });
      next();
    } catch (error) { next(error); }
  };
}


export function prepararCsrf(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

export function verificarCsrf(req, res, next) {
  const enviado = req.body?._csrf;
  const esperado = req.session.csrfToken;
  if (typeof enviado !== 'string' || typeof esperado !== 'string' || enviado.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado))) {
    return res.status(403).render('error', { titulo: 'Petición no válida', mensaje: 'El token de seguridad no es válido. Recarga el formulario e inténtalo de nuevo.' });
  }
  next();
}

export function cargarUsuario(repositorios) {
  return async (req, res, next) => {
    try {
      res.locals.usuario = req.session.userId ? await repositorios.usuarios.buscarPorId(req.session.userId) : null;
      next();
    } catch (error) { next(error); }
  };
}
