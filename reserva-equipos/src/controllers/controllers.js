import bcrypt from 'bcrypt';
import { ErrorDominio } from '../domain/errors.js';

const flash = (req, tipo, texto) => { req.session.aviso = { tipo, texto }; };
const dummyHash = bcrypt.hashSync('dummy-password-never-used', 12);
const correoValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function crearControladores({ repositorios, servicioReservas, servicioEquipos }) {
  return {
    inicio(req, res) { res.render('index', { titulo: 'Reserva de equipos' }); },
    async listarEquipos(req, res, next) {
      try {
        const equipos = await servicioEquipos.listar();
        const tipo = req.query.tipo ?? req.cookies.preferenciaEquipo ?? '';
        const operativos = req.query.operativos === 'true';
        const filtrados = equipos.filter((e) => (!tipo || e.tipo === tipo) && (!operativos || e.estado === 'operativo'));
        if (['portatil', 'sobremesa'].includes(String(req.query.tipo))) res.cookie('preferenciaEquipo', String(req.query.tipo), { httpOnly: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 180 });
        res.render('equipos/lista', { titulo: 'Equipos', equipos: filtrados, filtros: { tipo, operativos } });
      } catch (error) { next(error); }
    },
    async detalleEquipo(req, res, next) {
      try { const equipo = await repositorios.equipos.buscarPorId(req.params.id); if (!equipo) throw new ErrorDominio('EQUIPO_NO_ENCONTRADO', 'El equipo no existe.', 404); res.render('equipos/detalle', { titulo: equipo.nombre, equipo }); }
      catch (error) { next(error); }
    },
    registro(req, res) { res.render('auth/registro', { titulo: 'Crear cuenta', valores: {}, errores: [] }); },
    async registrar(req, res, next) {
      try {
        const nombre = String(req.body.nombre ?? '').trim(); const email = String(req.body.email ?? '').trim().toLowerCase(); const password = String(req.body.password ?? '');
        const errores = [];
        if (nombre.length < 2 || nombre.length > 80) errores.push('El nombre debe tener entre 2 y 80 caracteres.');
        if (!correoValido(email) || email.length > 160) errores.push('Introduce un correo válido.');
        if (password.length < 8 || password.length > 72) errores.push('La contraseña debe tener entre 8 y 72 caracteres.');
        if (await repositorios.usuarios.buscarPorEmail(email)) errores.push('No se pudo crear la cuenta con esos datos.');
        if (errores.length) return res.status(400).render('auth/registro', { titulo: 'Crear cuenta', valores: { nombre, email }, errores });
        const passwordHash = await bcrypt.hash(password, 12);
        await repositorios.usuarios.crear({ nombre, email, passwordHash, rol: 'usuario' });
        flash(req, 'success', 'Cuenta creada. Ya puedes iniciar sesión.'); res.redirect(303, '/login');
      } catch (error) { next(error); }
    },
    login(req, res) { res.render('auth/login', { titulo: 'Iniciar sesión', email: '', error: null }); },
    async autenticar(req, res, next) {
      try {
        const email = String(req.body.email ?? '').trim().toLowerCase(); const password = String(req.body.password ?? '');
        const usuario = await repositorios.usuarios.buscarPorEmail(email);
        const valido = await bcrypt.compare(password, usuario?.passwordHash ?? dummyHash);
        if (!usuario || !valido) return res.status(401).render('auth/login', { titulo: 'Iniciar sesión', email, error: 'Correo o contraseña incorrectos.' });
        req.session.regenerate((error) => {
          if (error) return next(error);
          req.session.userId = usuario.id;
          req.session.csrfToken = req.session.csrfToken;
          req.session.save((saveError) => { if (saveError) return next(saveError); res.redirect(303, '/perfil'); });
        });
      } catch (error) { next(error); }
    },
    logout(req, res, next) {
      req.session.destroy((error) => { if (error) return next(error); res.clearCookie('sid', { httpOnly: true, sameSite: 'lax', secure: req.app.get('trust proxy') === 1 }); res.redirect(303, '/'); });
    },
    async perfil(req, res, next) { try { const usuario = await repositorios.usuarios.buscarPorId(req.session.userId); if (!usuario) throw new ErrorDominio('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado.', 404); res.render('auth/perfil', { titulo: 'Mi perfil', usuario }); } catch (error) { next(error); } },
    async formularioReserva(req, res, next) {
      try {
        const fecha = String(req.query.fecha ?? new Date().toISOString().slice(0, 10)); const turno = String(req.query.turno ?? 'manana');
        const equipos = await servicioReservas.disponibles(fecha, turno);
        const vm = { fecha, turno, equipos, errores: [], valores: { equipoId: String(req.query.equipoId ?? '') } };
        res.render('reservas/nueva', { titulo: 'Nueva reserva', vm });
      } catch (error) { next(error); }
    },
    async crearReserva(req, res, next) {
      const valores = { equipoId: String(req.body.equipoId ?? ''), fecha: String(req.body.fecha ?? ''), turno: String(req.body.turno ?? '') };
      try {
        await servicioReservas.crear(valores, req.session.userId);
        flash(req, 'success', 'Reserva creada correctamente.');
        req.session.save((error) => { if (error) return next(error); res.redirect(303, '/mis-reservas'); });
      } catch (error) {
        if (!(error instanceof ErrorDominio)) return next(error);
        try { const equipos = await servicioReservas.disponibles(valores.fecha, valores.turno); res.status(error.status).render('reservas/nueva', { titulo: 'Nueva reserva', vm: { ...valores, equipos, errores: [error.message], valores } }); }
        catch (secondary) { next(secondary); }
      }
    },
    async misReservas(req, res, next) { try { const reservas = await servicioReservas.misReservas(req.session.userId); const equipos = await repositorios.equipos.listar(); const enriquecidas = reservas.map((r) => ({ ...r, equipo: equipos.find((e) => e.id === r.equipoId) })); res.render('reservas/mias', { titulo: 'Mis reservas', reservas: enriquecidas }); } catch (error) { next(error); } },
    async cancelarReserva(req, res, next) { try { await servicioReservas.cancelarPropia(req.params.id, req.session.userId); flash(req, 'success', 'Reserva cancelada.'); res.redirect(303, '/mis-reservas'); } catch (error) { next(error); } },
    async adminEquipos(req, res, next) { try { res.render('admin/equipos', { titulo: 'Administrar equipos', equipos: await servicioEquipos.listar(), errores: [] }); } catch (error) { next(error); } },
    async crearEquipo(req, res, next) { try { await servicioEquipos.crear(req.body); flash(req, 'success', 'Equipo añadido.'); res.redirect(303, '/admin/equipos'); } catch (error) { if (error.status) return res.status(error.status).render('admin/equipos', { titulo: 'Administrar equipos', equipos: await servicioEquipos.listar(), errores: [error.message] }); next(error); } },
    async cambiarEstado(req, res, next) { try { await servicioEquipos.cambiarEstado(req.params.id, String(req.body.estado)); flash(req, 'success', 'Estado actualizado.'); res.redirect(303, '/admin/equipos'); } catch (error) { next(error); } },
    async adminReservas(req, res, next) { try { const reservas = await repositorios.reservas.listar(); const equipos = await repositorios.equipos.listar(); const usuarios = await repositorios.usuarios.listar(); res.render('admin/reservas', { titulo: 'Todas las reservas', reservas: reservas.map((r) => ({ ...r, equipo: equipos.find((e) => e.id === r.equipoId), usuario: usuarios.find((u) => u.id === r.usuarioId) })) }); } catch (error) { next(error); } },
    async cancelarAdmin(req, res, next) { try { await servicioReservas.cancelarAdmin(req.params.id); flash(req, 'success', 'Reserva cancelada por administración.'); res.redirect(303, '/admin/reservas'); } catch (error) { next(error); } }
  };
}
