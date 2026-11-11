import type { Equipo, Reserva, Turno, NuevaReserva } from './types.js';
import type { RepositorioReservas } from './repository.js';

export type CodigoErrorReserva =
  | 'EQUIPO_NO_ENCONTRADO'
  | 'EQUIPO_NO_OPERATIVO'
  | 'FECHA_INVALIDA'
  | 'FECHA_PASADA'
  | 'TURNO_INVALIDO'
  | 'RESERVA_CONFLICTO';

export class ErrorReservaTipado extends Error {
  constructor(public readonly codigo: CodigoErrorReserva, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorReservaTipado';
  }
}

export class ServicioReservasTipado {
  constructor(
    private readonly repo: RepositorioReservas,
    private readonly equipos: readonly Equipo[]
  ) {}

  async estaReservado(equipoId: number, fecha: string, turno: Turno): Promise<boolean> {
    const reservas = await this.repo.listar();
    return reservas.some((reserva) =>
      reserva.equipoId === equipoId && reserva.fecha === fecha &&
      reserva.turno === turno && reserva.estado === 'activa'
    );
  }

  async disponibles(fecha: string, turno: Turno): Promise<Equipo[]> {
    const reservas = await this.repo.listar();
    return this.equipos
      .filter((equipo) => equipo.estado === 'operativo')
      .filter((equipo) => !reservas.some((reserva) =>
        reserva.equipoId === equipo.id && reserva.fecha === fecha &&
        reserva.turno === turno && reserva.estado === 'activa'
      ))
      .map((equipo) => ({ ...equipo }));
  }

  async crear(datos: NuevaReserva): Promise<Reserva> {
    const equipo = this.equipos.find((item) => item.id === datos.equipoId);
    if (!equipo) throw new ErrorReservaTipado('EQUIPO_NO_ENCONTRADO', 'El equipo no existe.');
    if (equipo.estado !== 'operativo') throw new ErrorReservaTipado('EQUIPO_NO_OPERATIVO', 'El equipo no está operativo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) throw new ErrorReservaTipado('FECHA_INVALIDA', 'La fecha no es válida.');
    const [year, month, day] = datos.fecha.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
      throw new ErrorReservaTipado('FECHA_INVALIDA', 'La fecha no existe.');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed < today) throw new ErrorReservaTipado('FECHA_PASADA', 'La fecha ya ha pasado.');
    if (datos.turno !== 'manana' && datos.turno !== 'tarde') throw new ErrorReservaTipado('TURNO_INVALIDO', 'El turno no es válido.');
    const creada = await this.repo.crearSiDisponible(datos);
    if (!creada) throw new ErrorReservaTipado('RESERVA_CONFLICTO', 'El equipo ya está reservado para ese turno.');
    return creada;
  }

  async listarReservas(): Promise<Reserva[]> {
    return this.repo.listar();
  }
}
