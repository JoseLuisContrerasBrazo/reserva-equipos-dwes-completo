import { ErrorDominio } from '../domain/errors.js';
import { obtenerEquiposDisponibles, validarReserva } from '../domain/reservas.js';

export function crearServicioReservas(repositorios) {
  return {
    async disponibles(fecha, turno) {
      const [equipos, reservas] = await Promise.all([repositorios.equipos.listar(), repositorios.reservas.listar()]);
      return obtenerEquiposDisponibles(equipos, reservas, fecha, turno);
    },
    async crear(datos, usuarioId) {
      const [equipos, reservas] = await Promise.all([repositorios.equipos.listar(), repositorios.reservas.listar()]);
      const validada = validarReserva(datos, equipos, reservas);
      const nueva = { ...validada, usuarioId: Number(usuarioId) };
      // El repositorio en memoria ofrece una operación atómica para el último control
      // de disponibilidad. El fallback mantiene compatibilidad con repositorios de prueba.
      const creada = repositorios.reservas.crearSiDisponible
        ? await repositorios.reservas.crearSiDisponible(nueva)
        : await repositorios.reservas.crear(nueva);
      if (!creada) throw new ErrorDominio('RESERVA_CONFLICTO', 'El equipo ya está reservado para esa fecha y turno.', 409);
      return creada;
    },
    async misReservas(usuarioId) { return repositorios.reservas.listarPorUsuario(usuarioId); },
    async cancelarPropia(reservaId, usuarioId) {
      const reserva = await repositorios.reservas.buscarPorId(reservaId);
      if (!reserva) throw new ErrorDominio('RESERVA_NO_ENCONTRADA', 'La reserva no existe.', 404);
      if (reserva.usuarioId !== Number(usuarioId)) throw new ErrorDominio('RESERVA_AJENA', 'No puedes cancelar una reserva de otro usuario.', 403);
      return this.cancelarValidada(reserva);
    },
    async cancelarAdmin(reservaId) {
      const reserva = await repositorios.reservas.buscarPorId(reservaId);
      if (!reserva) throw new ErrorDominio('RESERVA_NO_ENCONTRADA', 'La reserva no existe.', 404);
      return this.cancelarValidada(reserva);
    },
    async cancelarValidada(reserva) {
      if (reserva.estado !== 'activa') throw new ErrorDominio('RESERVA_NO_ACTIVA', 'La reserva ya está cancelada.', 409);
      const fecha = new Date(`${reserva.fecha}T00:00:00`);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      if (fecha < hoy) throw new ErrorDominio('RESERVA_PASADA', 'No se puede cancelar una reserva cuya fecha ya ha pasado.', 409);
      return repositorios.reservas.cancelar(reserva.id);
    }
  };
}


export function crearServicioEquipos(repositorios) {
  return {
    listar() { return repositorios.equipos.listar(); },
    async crear(datos) {
      const codigo = String(datos.codigo ?? '').trim().toUpperCase();
      const nombre = String(datos.nombre ?? '').trim();
      const tipo = String(datos.tipo ?? '');
      if (codigo.length < 3 || nombre.length < 3 || !['portatil', 'sobremesa'].includes(tipo)) throw new ErrorDominio('DATOS_INVALIDOS', 'Código, nombre o tipo de equipo no válidos.', 400);
      const todos = await repositorios.equipos.listar();
      if (todos.some((e) => e.codigo.toLowerCase() === codigo.toLowerCase())) throw new ErrorDominio('CODIGO_DUPLICADO', 'Ya existe un equipo con ese código.', 409);
      return repositorios.equipos.crear({ codigo, nombre, tipo, estado: 'operativo' });
    },
    async cambiarEstado(id, estado) {
      if (!['operativo', 'fuera_de_servicio'].includes(estado)) throw new ErrorDominio('ESTADO_INVALIDO', 'Estado no válido.', 400);
      const item = await repositorios.equipos.cambiarEstado(id, estado);
      if (!item) throw new ErrorDominio('EQUIPO_NO_ENCONTRADO', 'El equipo no existe.', 404);
      return item;
    }
  };
}
