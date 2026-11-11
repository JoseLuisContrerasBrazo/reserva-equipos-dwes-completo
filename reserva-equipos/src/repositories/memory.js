export function crearRepositoriosIniciales({ equipos, reservas, usuarios }) {
  let siguienteEquipo = Math.max(0, ...equipos.map((x) => x.id)) + 1;
  let siguienteReserva = Math.max(0, ...reservas.map((x) => x.id)) + 1;
  let siguienteUsuario = Math.max(0, ...usuarios.map((x) => x.id)) + 1;
  const copia = (x) => structuredClone(x);
  return {
    equipos: {
      async listar() { return copia(equipos); },
      async buscarPorId(id) { const x = equipos.find((e) => e.id === Number(id)); return x ? copia(x) : undefined; },
      async crear(datos) { const item = { id: siguienteEquipo++, ...datos }; equipos.push(item); return copia(item); },
      async cambiarEstado(id, estado) { const item = equipos.find((e) => e.id === Number(id)); if (!item) return undefined; item.estado = estado; return copia(item); }
    },
    reservas: {
      async listar() { return copia(reservas); },
      async listarPorUsuario(usuarioId) { return copia(reservas.filter((r) => r.usuarioId === Number(usuarioId))); },
      async buscarPorId(id) { const x = reservas.find((r) => r.id === Number(id)); return x ? copia(x) : undefined; },
      async crear(datos) { const item = { id: siguienteReserva++, estado: 'activa', ...datos }; reservas.push(item); return copia(item); },
      // Comprobación y escritura síncronas: evita duplicados entre peticiones concurrentes
      // dentro del mismo proceso Node.js.
      async crearSiDisponible(datos) {
        const conflicto = reservas.some((r) => r.estado === 'activa' && r.equipoId === datos.equipoId && r.fecha === datos.fecha && r.turno === datos.turno);
        if (conflicto) return undefined;
        const item = { id: siguienteReserva++, estado: 'activa', ...datos };
        reservas.push(item);
        return copia(item);
      },
      async cancelar(id) { const item = reservas.find((r) => r.id === Number(id)); if (!item) return undefined; item.estado = 'cancelada'; return copia(item); }
    },
    usuarios: {
      async listar() { return copia(usuarios); },
      async buscarPorId(id) { const x = usuarios.find((u) => u.id === Number(id)); return x ? copia(x) : undefined; },
      async buscarPorEmail(email) { const x = usuarios.find((u) => u.email === email.toLowerCase()); return x ? copia(x) : undefined; },
      async crear(datos) { const item = { id: siguienteUsuario++, rol: 'usuario', ...datos }; usuarios.push(item); return copia(item); }
    }
  };
}
