# src/weapons.js, src/entities/bullet.js, src/entities/pickup.js
**Responsabilidad:** armas (puños, pistola, escopeta), inventario, proyectiles y pickups de armas.
**Depende de:** `CONFIG`, `Utils`, `CityMap`. Orden de carga: `bullet.js` → `weapons.js` → ... → `pickup.js`.

## API pública
### `Weapons` (objeto)
Un **inventario** es un objeto plano: `{ owned: {FISTS, PISTOL, SHOTGUN}, ammo: {PISTOL, SHOTGUN}, current, cooldown }`.
- `Weapons.ORDER`: `['FISTS', 'PISTOL', 'SHOTGUN']` (ranuras 1, 2, 3). `Weapons.DEFS` = `CONFIG.WEAPONS`.
- `createInventory()`: solo puños.
- `update(inv, dt)`: baja el enfriamiento.
- `addWeapon(inv, key, ammo)`: da el arma y suma munición hasta `MAX_AMMO`.
- `select(inv, index) → boolean`: cambia a la ranura si el arma se tiene. `cycle(inv, ±1)`: siguiente/anterior arma que se tiene.
- `canFire(inv)`, `fire(inv, owner, angle, game) → boolean`: respeta cadencia y munición. Las armas de fuego crean `Bullet`s, un destello y asustan a los peatones en `SCARE_RADIUS` (250 px). Los puños llaman a `punch`.
- `punch(owner, angle, def, game)`: daña a todos los objetivos dentro del alcance (borde a ≤ 30 px) y del arco de 90° frente al dueño (o pegados a él), y añade el efecto `swing`.

`game` debe ofrecer: `bullets[]`, `effects[]`, `getTargets()`, `damageTarget(t, n, x, y)` y `scareAt(x, y, r)`. Así `Weapons` y `Bullet` sirven también para la policía en F6.

### `Bullet` (clase)
- `new Bullet(x, y, angle, speed, range, damage, owner)`; `update(dt, game)`, `draw(ctx, camera)` (estela corta amarilla); `dead`.
- Avanza en sub-pasos de 4 px: muere al tocar un edificio, al recorrer su alcance o al impactar al primer objetivo (nunca a su `owner`).

### `Pickup` (clase)
- `new Pickup(x, y, weapon)` con `weapon` = `'PISTOL'` o `'SHOTGUN'`; `update(dt, player) → boolean` (true si se recoge en este frame); `draw(ctx, camera)` (círculo azul "P" o naranja "E").
- Recoger = `Weapons.addWeapon` con `PICKUP_AMMO`; reaparece a los `RESPAWN_TIME` (20 s).

## Detalles / decisiones
- Posiciones fijas en `CONFIG.PICKUPS.PISTOL_TILES` (4) y `SHOTGUN_TILES` (3), todas en aceras; una pistola está en (18, 18), junto a la aparición del jugador.
- Se dispara manteniendo el clic (`Input.mouse.down`); la cadencia limita el ritmo.
- Los perdigones se reparten uniformemente en el abanico de 30°. A 100 px quedan separados ~13 px, así que a media distancia solo suele acertar uno (posible ajuste en F8).
- Las balas que dañan a un peatón lo hacen huir en la dirección de la bala.

## Tests
`tests/weapons.test.js`: inventario inicial y selección, munición con tope y `cycle`, cadencia y munición, abanico de la escopeta, alcance/arco de los puños, balas (primer objetivo, ignora al dueño, alcance exacto, paran en edificios), pickup y reaparición, pickups en aceras.
