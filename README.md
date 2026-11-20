# Mini City Chaos

Minijuego de acción con vista cenital al estilo de los GTA clásicos: una ciudad en cuadrícula, peatones, tráfico, tres armas y una policía que te persigue cada vez con más ganas. **Objetivo: sobrevivir y sumar puntos.**

Hecho con HTML5 Canvas y JavaScript puro: sin dependencias, sin instalación y sin compilar.

## Cómo jugar

1. Abre `index.html` en el navegador (doble clic). Alternativa: `python3 -m http.server 8000` y entra en `http://localhost:8000`.
2. Pulsa **Enter** para empezar.

### Controles

| Tecla | Acción |
|---|---|
| `W` `A` `S` `D` | Moverse a pie / conducir (W acelera, S frena y da marcha atrás, A/D giran) |
| Ratón | Apuntar |
| Clic izquierdo (mantener) | Disparar / dar puñetazos (no se puede disparar dentro del coche) |
| `1` `2` `3` o rueda | Cambiar de arma: puños, pistola, escopeta (solo las que tengas) |
| `E` | Entrar en el coche más cercano / salir del coche |
| `Enter` | Empezar / reiniciar tras Game Over |
| `P` | Pausa |
| `M` | Silenciar / activar el sonido |

### Reglas

- Empiezas solo con los **puños**. La **pistola** (círculo azul "P") y la **escopeta** (círculo naranja "E") están repartidas por las aceras; al recogerlas te dan munición y reaparecen a los 20 s.
- **Puntos:** +1 por segundo sobrevivido, +10 por peatón y +50 por policía. El récord se guarda en el navegador.
- **Nivel de búsqueda (★):** atacar o atropellar a un peatón te da al menos 1 ★; matar a un policía, +1 ★ (máximo 3). Con más estrellas llegan más policías a pie y coches patrulla que te embisten.
- Si **ningún policía te ve durante 10 s**, pierdes una estrella. Con 0 ★ la policía se retira.
- Puedes **robar cualquier coche** con `E`. Dentro del coche recibes la mitad de daño de bala, y a más de 120 px/s atropellas a quien se cruce. Los coches no se rompen.
- No hay regeneración ni botiquines: cuando tu vida llega a 0, **Game Over**.

## Para desarrolladores

- Tests de la lógica: `node --test tests/`
- Documentación del código: [`docs/README.md`](docs/README.md)
- Plan de implementación: [`PLAN.md`](PLAN.md)
