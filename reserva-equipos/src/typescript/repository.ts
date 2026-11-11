import type { Reserva, NuevaReserva } from './types.js';

export interface RepositorioReservas {
  listar(): Promise<Reserva[]>;
  buscarPorId(id: number): Promise<Reserva | undefined>;
  crear(datos: NuevaReserva): Promise<Reserva>;
  /** Inserta solo si no existe otra reserva activa para equipo, fecha y turno. */
  crearSiDisponible(datos: NuevaReserva): Promise<Reserva | undefined>;
  cancelar(id: number): Promise<Reserva | undefined>;
}

export class RepositorioReservasMap implements RepositorioReservas {
  private readonly reservas: Map<number, Reserva>;
  private siguienteId: number;

  constructor(iniciales: readonly Reserva[] = []) {
    this.reservas = new Map(iniciales.map((reserva) => [reserva.id, { ...reserva }]));
    this.siguienteId = Math.max(0, ...iniciales.map((reserva) => reserva.id)) + 1;
  }

  async listar(): Promise<Reserva[]> {
    return [...this.reservas.values()].map((reserva) => ({ ...reserva }));
  }

  async buscarPorId(id: number): Promise<Reserva | undefined> {
    const reserva = this.reservas.get(id);
    return reserva ? { ...reserva } : undefined;
  }

  async crear(datos: NuevaReserva): Promise<Reserva> {
    const reserva: Reserva = { id: this.siguienteId++, ...datos, estado: 'activa' };
    this.reservas.set(reserva.id, { ...reserva });
    return { ...reserva };
  }

  async crearSiDisponible(datos: NuevaReserva): Promise<Reserva | undefined> {
    const conflicto = [...this.reservas.values()].some((reserva) =>
      reserva.estado === 'activa' &&
      reserva.equipoId === datos.equipoId &&
      reserva.fecha === datos.fecha &&
      reserva.turno === datos.turno
    );
    if (conflicto) return undefined;
    return this.crear(datos);
  }

  async cancelar(id: number): Promise<Reserva | undefined> {
    const reserva = this.reservas.get(id);
    if (!reserva) return undefined;
    const cancelada: Reserva = { ...reserva, estado: 'cancelada' };
    this.reservas.set(id, cancelada);
    return { ...cancelada };
  }
}
