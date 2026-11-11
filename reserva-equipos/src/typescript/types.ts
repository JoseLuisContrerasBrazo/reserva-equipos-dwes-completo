export type Rol = 'usuario' | 'admin';
export type Turno = 'manana' | 'tarde';
export type TipoEquipo = 'portatil' | 'sobremesa';
export type EstadoEquipo = 'operativo' | 'fuera_de_servicio';
export type EstadoReserva = 'activa' | 'cancelada';

export interface Equipo {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoEquipo;
  estado: EstadoEquipo;
}

export interface Reserva {
  id: number;
  equipoId: number;
  usuarioId: number;
  fecha: string;
  turno: Turno;
  estado: EstadoReserva;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  passwordHash: string;
  rol: Rol;
}

export interface NuevaReserva {
  equipoId: number;
  usuarioId: number;
  fecha: string;
  turno: Turno;
}
