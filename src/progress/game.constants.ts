export const TIER_CONFIG = {
  A: {
    lives: 7,
    steps: 5,
    xpThresholds: [30, 40, 50, 60, 70], // Test için düşük
  },
  B: {
    lives: 5,
    steps: 5,
    xpThresholds: [350, 370, 390, 410, 450],
  },
  C: {
    lives: 3,
    steps: 5,
    xpThresholds: [500, 530, 560, 600, 650],
  },
  MASTER: {
    lives: 1,
    steps: Infinity,
    xpThresholds: [],
  },
};

export const TIER_UNLOCK_LEVEL = {
  B: 10,
  C: 20,
  MASTER: 30,
};

export const XP_PER_CORRECT = 10;
export const XP_STREAK_BONUS = 20;
export const XP_STREAK_INTERVAL = 10;
