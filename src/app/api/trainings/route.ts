import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin, isTrainer } from '@/types/roles';
import { getTrainingsForUser } from '@/lib/authorization';

// POST method removed - trainings are created only through automatic synchronization
// New trainings are added by adding three columns to User table:
// - {code}DatumPosl - Last completion date
// - {code}DatumPristi - Next due date
// - {code}Pozadovano - Required flag
// The app automatically detects these columns and creates Training records on startup or manual sync

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if admin or trainer request for all trainings from database
    const url = new URL(request.url);
    const isAdminOrTrainer =
      isAdmin(session.user.role) || isTrainer(session.user.role);

    // FIXED: Use authorization helper that respects training assignments
    if (url.searchParams.get('admin') === 'true' && isAdminOrTrainer) {
      const userId = parseInt(session.user.id);
      const trainings = await getTrainingsForUser(userId, session.user.role, {
        includeTests: true,
        orderBy: 'createdAt'
      });

      return NextResponse.json({
        trainings: trainings.map((t: any) => ({
          ...t,
          testsCount: t.tests?.length || 0
        }))
      });
    }
    // Získej data uživatele podle kódu nebo emailu
    // IMPORTANT: Použij raw SQL aby se načetly i dynamické sloupce školení (_*Pozadovano)
    let user: any;

    if (session.user.cislo) {
      // Uživatel přihlášen kódem
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM InspiritCisZam WHERE Cislo = ${session.user.cislo}
      `;
      user = result[0];
    } else if (session.user.email) {
      // Uživatel přihlášen emailem
      const result = await prisma.$queryRaw<any[]>`
        SELECT * FROM InspiritCisZam WHERE email = ${session.user.email}
      `;
      user = result[0];
    } else {
      return NextResponse.json(
        { error: 'User identifier not found' },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Načti všechna školení z databáze (pouze aktivní - ne soft-deleted)
    const dbTrainings = await prisma.inspiritTraining.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        name: 'asc'
      }
    });

    // RBAC: Pro všechny role načti seznam školení s přiřazeným školitelem
    // Školení bez školitele se zaměstnancům nezobrazují
    const trainingsWithTrainer = await prisma.inspiritTrainingAssignment.findMany({
      where: {
        deletedAt: null
      },
      select: {
        trainingId: true
      }
    });
    const trainingsWithTrainerIds = new Set(trainingsWithTrainer.map(t => t.trainingId));

    // Pro každé školení z databáze zkontroluj, zda je požadováno pro uživatele
    const trainings = dbTrainings.map((training: any) => {
      const slug = training.code.toLowerCase(); // Použij code jako slug
      // CRITICAL: Training columns have underscore prefix in database
      const pozadovano = Boolean(
        user[`_${training.code}Pozadovano` as keyof typeof user]
      );
      return {
        id: training.id,
        key: training.code,
        code: training.code,
        name: training.name,
        description: training.description,
        slug: slug,
        icon: 'post',
        required: pozadovano,
        url: `/${slug}`
      };
    });

    // Filtruj školení - všechny role vidí pouze svá požadovaná školení s přiřazeným školitelem
    // Management pohled (všechna/přiřazená školení) je dostupný přes ?admin=true
    const filteredTrainings = trainings.filter(
      (t: any) => t.required && trainingsWithTrainerIds.has(t.id)
    );

    return NextResponse.json({
      trainings: filteredTrainings,
      allTrainings: trainings
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch trainings' },
      { status: 500 }
    );
  }
}
