import { PrismaClient, UserRole, UserStatus, DietType, ActivityLevel, GoalType, GoalStatus } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

/**
 * Development-only seed — per ARCHITECTURE.md / spec item 69, this must
 * never run automatically in production (no postinstall hook calls it;
 * it's wired only to `npm run prisma:seed`, invoked manually).
 */
async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const demoEmail = process.env.SEED_DEMO_EMAIL ?? 'demo@example.com';
  const demoPassword = process.env.SEED_DEMO_PASSWORD;

  if (!adminPassword || !demoPassword) {
    throw new Error(
      'Set SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD in your environment before seeding (never hardcode seed passwords).',
    );
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      profile: {
        create: {
          fullName: 'Admin',
          birthDate: new Date('1990-01-01'),
          heightCm: 175,
          weightKg: 75,
          timezone: 'Europe/Budapest',
        },
      },
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash: await hashPassword(demoPassword),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      profile: {
        create: {
          fullName: 'Demo User',
          birthDate: new Date('1992-06-15'),
          heightCm: 180,
          weightKg: 78,
          timezone: 'Europe/Budapest',
        },
      },
      exerciseProfile: {
        create: {
          activityLevel: ActivityLevel.MODERATELY_ACTIVE,
          weeklyWorkoutCount: 4,
          avgWorkoutDurationMin: 45,
          activityTypes: ['STRENGTH_TRAINING', 'RUNNING'],
        },
      },
      nutritionProfile: {
        create: {
          dietType: DietType.OMNIVORE,
          dailyMealCount: 3,
        },
      },
      supplements: {
        create: [
          {
            name: 'Magnesium Bisglycinate',
            dosage: 300,
            unit: 'mg',
            frequency: 'DAILY',
            timing: 'EVENING',
          },
          {
            name: 'Vitamin D3',
            dosage: 4000,
            unit: 'IU',
            frequency: 'DAILY',
            timing: 'MORNING',
          },
        ],
      },
      goals: {
        create: [
          {
            type: GoalType.SLEEP_IMPROVEMENT,
            name: 'Improve sleep score',
            targetValue: 85,
            targetUnit: 'score',
            status: GoalStatus.ACTIVE,
          },
        ],
      },
    },
  });

  // 30 days of mock DailyHealthMetric so the demo user's dashboard has
  // something to show before real Oura sync exists (OURA_MOCK_MODE proper,
  // via the mock adapter, ships in Phase 5 — this is just enough for the
  // Phase 1 dashboard shell to render non-empty numbers if you want to
  // eyeball it locally).
  const today = new Date();
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    await prisma.dailyHealthMetric.upsert({
      where: { userId_date: { userId: demo.id, date } },
      update: {},
      create: {
        userId: demo.id,
        date,
        sleepScore: 70 + Math.round(Math.random() * 25),
        readinessScore: 65 + Math.round(Math.random() * 30),
        activityScore: 60 + Math.round(Math.random() * 35),
        totalSleepMinutes: 380 + Math.round(Math.random() * 90),
        deepSleepMinutes: 60 + Math.round(Math.random() * 30),
        remSleepMinutes: 70 + Math.round(Math.random() * 30),
        restingHeartRate: 48 + Math.round(Math.random() * 10),
        averageHrv: 40 + Math.round(Math.random() * 25),
        steps: 4000 + Math.round(Math.random() * 8000),
        activeCalories: 300 + Math.round(Math.random() * 400),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded admin (${admin.email}) and demo user (${demo.email}) with 30 days of mock metrics.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
