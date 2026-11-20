(function (root) {
  'use strict';

  // All game constants live here. Times in seconds,
  // distances in world pixels, speeds in px/s, angles in degrees unless noted.
  const CONFIG = {
    SCREEN_WIDTH: 960,
    SCREEN_HEIGHT: 640,
    MAX_DT: 0.05,

    TILE_SIZE: 64,
    MAP_COLS: 40,
    MAP_ROWS: 40,
    MAP: {
      BLOCK_PERIOD: 8, // 2 road tiles + 6x6 block
      ROAD_WIDTH: 2,
      // Blocks (block column, block row) whose interior is PARK instead of BUILDING.
      PARK_BLOCKS: [[1, 3], [3, 1]],
      COLORS: {
        ROAD: '#3b3b3e',
        ROAD_LINE: '#d8c040',
        SIDEWALK: '#9a968c',
        SIDEWALK_LINE: '#8a867c',
        PARK: '#4c8a3c',
        TREE: '#2f6427',
        WALL: '#2a2a2e',
        ROOF_EDGE: 'rgba(0, 0, 0, 0.35)',
        ROOFS: ['#8c5a4a', '#5a6c8c', '#7a7a6a', '#8c7a4a', '#6a5a7a', '#4a7a7a']
      }
    },

    TILE: {
      ROAD: 0,
      SIDEWALK: 1,
      BUILDING: 2,
      PARK: 3
    },

    PLAYER: {
      MAX_HEALTH: 100,
      RADIUS: 12,
      SPEED: 160,
      SPAWN_TILE: { tx: 18, ty: 20 } // sidewalk near the map centre
    },

    WEAPONS: {
      FISTS: {
        NAME: 'Puños',
        DAMAGE: 20,
        RANGE: 30,
        COOLDOWN: 0.4,
        ARC: 90,
        INFINITE_AMMO: true
      },
      PISTOL: {
        NAME: 'Pistola',
        DAMAGE: 25,
        RANGE: 500,
        COOLDOWN: 0.35,
        PICKUP_AMMO: 24,
        MAX_AMMO: 60,
        PELLETS: 1,
        SPREAD: 0,
        BULLET_SPEED: 700
      },
      SHOTGUN: {
        NAME: 'Escopeta',
        DAMAGE: 15,
        RANGE: 250,
        COOLDOWN: 0.9,
        PICKUP_AMMO: 8,
        MAX_AMMO: 24,
        PELLETS: 5,
        SPREAD: 20,
        BULLET_SPEED: 700
      }
    },

    PICKUPS: {
      RESPAWN_TIME: 20,
      RADIUS: 14,
      // Fixed sidewalk tiles [tx, ty] (4 pistol + 3 shotgun).
      PISTOL_TILES: [[18, 18], [2, 2], [34, 2], [34, 34]],
      SHOTGUN_TILES: [[10, 26], [26, 10], [23, 13]]
    },

    EFFECTS: {
      SWING_TIME: 0.15, // fist swing arc
      FLASH_TIME: 0.06, // muzzle flash
      MAX_PARTICLES: 120, // oldest particles are dropped beyond this
      PARTICLE_TIME: 0.35, // particle lifetime (fades out)
      PARTICLE_DRAG: 6, // velocity decay per second (exponential)
      SPARK_COUNT: 6, // per bullet impact on a building
      SPARK_SPEED: 160,
      SPARK_COLORS: ['#ffe080', '#ffd040', '#c8c8c8', '#9a9a9a'],
      HIT_COUNT: 5, // red particles per bullet impact on a person
      HIT_SPEED: 120,
      BLOOD_COUNT: 8, // per attack on a pedestrian (bullet or fist)
      BLOOD_SPEED: 90,
      BLOOD_COLORS: ['#b01818', '#d02828', '#801010'],
      HURT_FLASH_TIME: 0.4, // player blinks red after taking damage
      HURT_BLINK_RATE: 16, // blinks per second while hurt
      SMOKE_RATE: 6, // smoke particles per second from a damaged car (on screen)
      SMOKE_SPEED: 25,
      SMOKE_TIME: 1.2, // smoke particle lifetime
      SMOKE_COLORS: ['#555', '#666', '#777', '#444'],
      FIRE_RATE: 18, // fire particles per second from a burning car (on screen)
      FIRE_SPEED: 50,
      FIRE_TIME: 0.5,
      FIRE_COLORS: ['#ffd040', '#ff9020', '#ff5010', '#e02010'],
      EXPLOSION_COUNT: 40, // particles per car explosion
      EXPLOSION_SPEED: 280,
      EXPLOSION_TIME: 0.7,
      EXPLOSION_COLORS: ['#fff2a0', '#ffd040', '#ff9020', '#ff5010', '#555', '#333']
    },

    AUDIO: {
      MASTER_VOLUME: 0.35,
      MAX_SAME_SOUND: 3, // max plays of the same sound inside THROTTLE_WINDOW
      THROTTLE_WINDOW: 0.05, // seconds
      DEDUPE_TIME: 0.03 // same sound from the same source inside this time plays once
    },

    SCARE_RADIUS: 250,

    CAR: {
      WIDTH: 48,
      HEIGHT: 24,
      MAX_SPEED: 320,
      MAX_REVERSE_SPEED: 120,
      ACCELERATION: 400,
      BRAKE: 600, // deceleration when pressing against the motion
      FRICTION: 200,
      TURN_RATE: 3, // rad/s at TURN_FULL_SPEED or faster
      TURN_FULL_SPEED: 120, // below this the turn rate scales with speed
      BOUNCE: 0.3, // fraction of speed kept (reversed) after a head-on hit
      CRASH_SPEED: 100, // speed lost in an impact that emits 'carCrash'
      CRASH_COOLDOWN: 0.5,
      CAR_HIT_DAMPING: 0.7, // speed kept by both cars in a car-car hit
      ENTER_DISTANCE: 50, // from the player centre to the car body
      TRAFFIC_COUNT: 10,
      TRAFFIC_SPEED: 150,
      TRAFFIC_TURN_SPEED: 80,
      TRAFFIC_GAP: 30, // free space traffic keeps in front
      TURN_START: 44, // traffic starts turning this far before the turn point
      WAYPOINT_REACHED: 20,
      TURN_SLOWDOWN_DIST: 140,
      MAX_WAIT: 3, // traffic stops for obstacles at most this long
      STUCK_TIME: 1.5, // stopped against a wall this long -> reverse
      REVERSE_TIME: 0.8,
      STUCK_REMOVE_TIME: 8, // stuck traffic out of view is removed (and respawned)
      RUN_OVER_SPEED: 120,
      PLAYER_DAMAGE_FACTOR: 0.5,
      // Damage and explosions (MCC-001)
      HEALTH: 100,
      SMOKE_HEALTH: 50, // smokes at or below this health
      BURN_TIME: 3, // seconds burning at 0 health before exploding
      EXPLOSION_RADIUS: 110,
      EXPLOSION_DAMAGE: 80, // at the centre; falls off linearly to 0 at the radius
      CRASH_DAMAGE_FACTOR: 0.1, // health lost per px/s of speed lost in a carCrash
      WRECK_TIME: 15, // seconds a burnt wreck stays
      COLORS: ['#d33', '#36c', '#eb3', '#3a3', '#e80', '#a3c', '#ddd', '#555']
    },

    PEDESTRIAN: {
      COUNT: 25,
      RADIUS: 10,
      HEALTH: 30,
      SPEED: 60,
      FLEE_SPEED: 140,
      FLEE_TIME: 4,
      TURN_MIN: 2,
      TURN_MAX: 4,
      CORPSE_TIME: 5, // seconds the body stays on the ground
      PARK_SPAWN_CHANCE: 0.15, // otherwise spawns on a sidewalk
      SPAWN_MARGIN: 64, // spawn at least this far outside the camera view
      COLORS: ['#e05a5a', '#e0a05a', '#d8d860', '#7ad86a', '#5ad8c8', '#c87ae0', '#f0f0f0', '#a07050']
    },

    WANTED: {
      MAX_STARS: 3,
      VISION_RADIUS: 350,
      LOSE_STAR_TIME: 10,
      // Index = number of stars
      FOOT_COPS: [0, 2, 4, 5],
      PATROL_CARS: [0, 0, 1, 3]
    },

    POLICE: {
      HEALTH: 50,
      RADIUS: 12,
      SPEED: 130,
      SHOOT_RANGE: 300,
      DAMAGE: 6,
      FIRE_COOLDOWN: 1.5,
      RAM_DAMAGE_ON_FOOT: 20,
      RAM_DAMAGE_IN_CAR: 10,
      RAM_COOLDOWN: 2,
      RAM_MIN_SPEED: 40, // a patrol car must move at least this fast to hurt by ramming
      PATROL_COLOR: '#f4f4f4',
      PATROL_SIGHT: 700, // drives straight at the player if the line is clear and closer than this
      PATROL_NODE_REACHED: 48, // px from an intersection centre to pick the next one
      PATROL_STUCK_TIME: 0.7, // seconds almost stopped before reversing
      PATROL_REVERSE_TIME: 0.8,
      BULLET_SPEED: 600,
      BULLET_RANGE: 400,
      AIM_ERROR: 12, // degrees, random +/- when a cop fires
      KEEP_DISTANCE: 110, // cops stop approaching closer than this
      DETOUR_TIME: 0.8, // seconds walking sideways after bumping into a building
      CORPSE_TIME: 5,
      SPAWN_MIN_DIST: 560, // spawn ring around the player (also out of camera view)
      SPAWN_MAX_DIST: 900,
      SPAWN_MARGIN: 64 // spawn at least this far outside the camera view
    },

    SCORE: {
      PEDESTRIAN: 10,
      POLICE: 50,
      CAR: 20, // civilian car destroyed by the player
      PATROL_CAR: 100, // patrol car destroyed by the player
      PER_SECOND: 1
    },

    HUD: {
      MARGIN: 12,
      MINIMAP_SIZE: 160, // px (40 tiles -> 4 px per tile)
      PANEL: 'rgba(0, 0, 0, 0.55)',
      ACCENT: '#ffd23a',
      STAR: '#ffd23a',
      MINIMAP_COLORS: {
        ROAD: '#55555a',
        SIDEWALK: '#8a867c',
        BUILDING: '#26262a',
        PARK: '#3f7a32',
        PLAYER: '#ffd23a',
        COP: '#4a8cff',
        PATROL: '#2050ff'
      }
    },

    HIGHSCORE_KEY: 'mcc-highscore'
  };

  root.CONFIG = CONFIG;
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
