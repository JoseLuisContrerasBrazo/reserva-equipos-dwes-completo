import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-that-is-long-enough-for-session-security';
process.env.PORT = '3001';
const { crearApp } = await import('../src/app.js');

let app;
let anaHash;
let adminHash;
function fixtureRepos() {
  const equiposData = [
    { id: 1, codigo: 'PC-001', nombre: 'Ordenador aula 1', tipo: 'sobremesa', estado: 'operativo' },
    { id: 2, codigo: 'PORT-001', nombre: 'Portátil Lenovo', tipo: 'portatil', estado: 'operativo' },
    { id: 3, codigo: 'PC-002', nombre: 'Ordenador aula 2', tipo: 'sobremesa', estado: 'fuera_de_servicio' }
  ];
  const reservasData = [
    { id: 1, equipoId: 1, usuarioId: 1, fecha: '2030-01-15', turno: 'manana', estado: 'activa' },
    { id: 2, equipoId: 2, usuarioId: 2, fecha: '2030-01-16', turno: 'tarde', estado: 'activa' },
    { id: 3, equipoId: 1, usuarioId: 2, fecha: '2030-01-17', turno: 'manana', estado: 'cancelada' }
  ];
  const usuariosData = [
    { id: 1, nombre: 'Administrador', email: 'admin@example.com', passwordHash: adminHash, rol: 'admin' },
    { id: 2, nombre: 'Ana García', email: 'ana@example.com', passwordHash: anaHash, rol: 'usuario' },
    { id: 3, nombre: 'Lucía Martín', email: 'lucia@example.com', passwordHash: anaHash, rol: 'usuario' }
  ];
  const copy = (x) => structuredClone(x);
  return {
    equipos: { async listar(){return copy(equiposData)}, async buscarPorId(id){return copy(equiposData.find(e=>e.id===Number(id)))}, async crear(d){const x={id:4,...d};equiposData.push(x);return copy(x)}, async cambiarEstado(id,estado){const x=equiposData.find(e=>e.id===Number(id));if(!x)return undefined;x.estado=estado;return copy(x)} },
    reservas: { async listar(){return copy(reservasData)}, async listarPorUsuario(id){return copy(reservasData.filter(r=>r.usuarioId===Number(id)))}, async buscarPorId(id){const x=reservasData.find(r=>r.id===Number(id));return x?copy(x):undefined}, async crear(d){const x={id:reservasData.length+1,estado:'activa',...d};reservasData.push(x);return copy(x)}, async cancelar(id){const x=reservasData.find(r=>r.id===Number(id));if(!x)return undefined;x.estado='cancelada';return copy(x)} },
    usuarios: { async listar(){return copy(usuariosData)}, async buscarPorId(id){const x=usuariosData.find(u=>u.id===Number(id));return x?copy(x):undefined}, async buscarPorEmail(email){const x=usuariosData.find(u=>u.email===email.toLowerCase());return x?copy(x):undefined}, async crear(d){const x={id:usuariosData.length+1,rol:'usuario',...d};usuariosData.push(x);return copy(x)} }
  };
}
async function csrf(agent, path = '/login') {
  const response = await agent.get(path);
  const match = response.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  if (!match) throw new Error('No se encontró el token CSRF en el formulario.');
  return match[1];
}
async function login(agent, email = 'ana@example.com', password = 'Ana12345!') {
  const token = await csrf(agent, '/login');
  return agent.post('/login').type('form').send({ _csrf: token, email, password });
}
beforeAll(async () => { anaHash = await bcrypt.hash('Ana12345!', 4); adminHash = await bcrypt.hash('Admin123!', 4); });
beforeEach(async () => { app = await crearApp({ repositorios: fixtureRepos() }); });

describe('Práctica DWES: comportamiento HTTP y seguridad', () => {
  it('1. registra un usuario válido y asigna rol usuario', async () => {
    const agent = request.agent(app); const token = await csrf(agent, '/registro');
    const response = await agent.post('/registro').type('form').send({ _csrf: token, nombre: 'Mario Test', email: 'mario@example.com', password: 'Password123' });
    expect(response.status).toBe(303); expect(response.headers.location).toBe('/login');
    const creado = await app.locals.repositorios.usuarios.buscarPorEmail('mario@example.com'); expect(creado?.rol).toBe('usuario');
  });
  it('2. rechaza credenciales incorrectas con mensaje genérico', async () => {
    const agent = request.agent(app); const token = await csrf(agent);
    const response = await agent.post('/login').type('form').send({ _csrf: token, email: 'ana@example.com', password: 'incorrecta' });
    expect(response.status).toBe(401); expect(response.text).toContain('Correo o contraseña incorrectos');
  });
  it('3. redirige al visitante anónimo desde una ruta privada', async () => { const response = await request(app).get('/perfil'); expect(response.status).toBe(303); expect(response.headers.location).toBe('/login'); });
  it('4. permite acceder al perfil con una sesión válida', async () => { const agent = request.agent(app); const response = await login(agent); expect(response.status).toBe(303); const perfil = await agent.get('/perfil'); expect(perfil.status).toBe(200); expect(perfil.text).toContain('Ana García'); });
  it('5. rechaza una operación admin de un usuario ordinario', async () => { const agent = request.agent(app); await login(agent); const token = await csrf(agent, '/perfil'); const response = await agent.post('/admin/equipos').type('form').send({ _csrf: token, codigo: 'PC-900', nombre: 'Equipo de prueba', tipo: 'sobremesa' }); expect(response.status).toBe(403); });
  it('6. crea una reserva válida para equipo disponible', async () => { const agent = request.agent(app); await login(agent); const token = await csrf(agent, '/reservas/nueva'); const response = await agent.post('/reservas').type('form').send({ _csrf: token, equipoId: '2', fecha: '2030-02-10', turno: 'manana' }); expect(response.status).toBe(303); expect(response.headers.location).toBe('/mis-reservas'); });
  it('7. rechaza una reserva duplicada para equipo, fecha y turno', async () => { const agent = request.agent(app); await login(agent); const token = await csrf(agent, '/reservas/nueva'); const datos = { _csrf: token, equipoId: '1', fecha: '2030-01-15', turno: 'manana' }; const response = await agent.post('/reservas').type('form').send(datos); expect(response.status).toBe(409); expect(response.text).toContain('ya está reservado'); });
  it('8. impide cancelar una reserva que pertenece a otro usuario', async () => { const agent = request.agent(app); await login(agent); const token = await csrf(agent, '/mis-reservas'); const response = await agent.post('/reservas/1/cancelar').type('form').send({ _csrf: token }); expect(response.status).toBe(403); });
  it('9. rechaza cambio de estado admin sin token CSRF', async () => { const agent = request.agent(app); await login(agent, 'admin@example.com', 'Admin123!'); const response = await agent.post('/admin/equipos/1/estado').type('form').send({ estado: 'fuera_de_servicio' }); expect(response.status).toBe(403); });
  it('10. invalida la sesión después del logout', async () => { const agent = request.agent(app); await login(agent); const token = await csrf(agent, '/perfil'); const logout = await agent.post('/logout').type('form').send({ _csrf: token }); expect(logout.status).toBe(303); const perfil = await agent.get('/perfil'); expect(perfil.status).toBe(303); expect(perfil.headers.location).toBe('/login'); });
});
