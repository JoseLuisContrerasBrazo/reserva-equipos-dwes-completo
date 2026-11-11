import { config } from './config/env.js';
import { crearApp } from './app.js';

const app = await crearApp();
app.listen(config.port, () => console.log(`Reserva de equipos disponible en http://localhost:${config.port}`));
