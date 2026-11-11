import { ErrorDominio } from './errors.js';

export function estaReservado(equipoId, fecha, turno, reservas) {
  return reservas.some((r) => r.equipoId === equipoId && r.fecha === fecha && r.turno === turno && r.estado === 'activa');
}

export function obtenerEquiposDisponibles(equipos, reservas, fecha, turno) {
  return equipos.filter((equipo) => equipo.estado === 'operativo' && !estaReservado(equipo.id, fecha, turno, reservas));
}

export function validarReserva(datos, equipos, reservas, hoy = new Date()) {
  const equipoId = Number(datos.equipoId);
  if (!Number.isSafeInteger(equipoId) || equipoId < 1) throw new ErrorDominio('DATOS_INVALIDOS', 'Selecciona un equipo válido.', 400);
  const equipo = equipos.find((e) => e.id === equipoId);
  if (!equipo) throw new ErrorDominio('EQUIPO_NO_ENCONTRADO', 'El equipo solicitado no existe.', 404);
  if (equipo.estado !== 'operativo') throw new ErrorDominio('EQUIPO_NO_OPERATIVO', 'El equipo está fuera de servicio.', 409);
  if (typeof datos.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) throw new ErrorDominio('FECHA_INVALIDA', 'Introduce una fecha válida.', 400);
  const [anio, mes, dia] = datos.fecha.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  if (Number.isNaN(fecha.getTime()) || fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) throw new ErrorDominio('FECHA_INVALIDA', 'La fecha no existe.', 400);
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (fecha < hoyLocal) throw new ErrorDominio('FECHA_PASADA', 'La fecha no puede ser anterior al día actual.', 400);
  if (!['manana', 'tarde'].includes(datos.turno)) throw new ErrorDominio('TURNO_INVALIDO', 'Selecciona mañana o tarde.', 400);
  if (estaReservado(equipoId, datos.fecha, datos.turno, reservas)) throw new ErrorDominio('RESERVA_CONFLICTO', 'El equipo ya está reservado para esa fecha y turno.', 409);
  return { equipoId, fecha: datos.fecha, turno: datos.turno };
}
