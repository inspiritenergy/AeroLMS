import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isTrainer } from '@/types/roles';
import {
  CreateTestSchema,
  validateRequestBody,
  safeJsonParse
} from '@/lib/validation-schemas';
import {
  validateTrainingAccess,
  isTrainerAssignedToTraining
} from '@/lib/authorization';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET - Získat všechny testy pro dané školení
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: 'Invalid training ID' },
        { status: 400 }
      );
    }

    // Get user to check role
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { role: true }
    });

    // Zaměstnanecký pohled (?employee=true) - pouze aktivní testy (pro vyplňování)
    // Management pohled (bez ?employee) - WORKER vidí jen aktivní, ADMIN/TRAINER vidí všechny
    const url = new URL(request.url);
    const isEmployeeView = url.searchParams.get('employee') === 'true';

    // SECURITY: Validate trainer has access to this training
    // Only check assignment for MANAGEMENT view - employee view is accessible to all roles
    // (trainers can be required to take trainings they don't manage)
    const userRole = session.user.role;
    if (isTrainer(userRole) && !isEmployeeView) {
      const hasAccess = await isTrainerAssignedToTraining(
        parseInt(session.user.id),
        trainingId
      );
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Nemáte oprávnění k tomuto školení' },
          { status: 403 }
        );
      }
    }

    const whereClause =
      isEmployeeView || user?.role === 'WORKER'
        ? {
            trainingId: trainingId,
            isActive: true,
            deletedAt: null
          }
        : {
            trainingId: trainingId,
            deletedAt: null
          };

    // Získej testy podle role
    const tests = await prisma.inspiritTest.findMany({
      where: whereClause,
      include: {
        questions: {
          where: { deletedAt: null }, // Only active questions
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            testAttempts: {
              where: { deletedAt: null } // Count only active attempts
            },
            questions: {
              where: { deletedAt: null } // Count only active questions
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Transform tests
    const transformedTests = tests.map((test: any) => ({
      id: test.id,
      title: test.title,
      description: test.description,
      passingScore: test.passingScore,
      timeLimit: test.timeLimit,
      isActive: test.isActive,
      validFrom: test.validFrom,
      validTo: test.validTo,
      questionsCount: test._count.questions,
      attemptsCount: test._count.testAttempts,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      questions: test.questions.map((q: any) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        question: q.question,
        options: safeJsonParse(q.options),
        points: q.points,
        required: q.required
      }))
    }));

    return NextResponse.json({
      tests: transformedTests,
      count: transformedTests.length
    });
  } catch (error) {
    console.error('[GET /api/trainings/[id]/tests] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

// POST - Vytvořit nový test pro školení
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: 'Invalid training ID' },
        { status: 400 }
      );
    }

    // SECURITY: Validate trainer has access to this training using centralized helper
    try {
      await validateTrainingAccess(session, trainingId);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Nedostatečná oprávnění' },
        { status: 403 }
      );
    }

    // Validate request body
    const validation = await validateRequestBody(request, CreateTestSchema);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      title,
      description,
      passingScore,
      timeLimit,
      validFrom,
      validTo,
      questions
    } = validation.data;

    // Vytvoř test s otázkami v transakci
    const test = await prisma.$transaction(async (tx) => {
      // BUSINESS RULE: Only one active test per training
      // When creating a new active test, deactivate all other tests for the same training
      // This ensures employees see only one test at a time
      await tx.inspiritTest.updateMany({
        where: {
          trainingId,
          isActive: true,
          deletedAt: null
        },
        data: { isActive: false }
      });

      // Vytvoř test (always active by default)
      const newTest = await tx.inspiritTest.create({
        data: {
          trainingId,
          title,
          description,
          passingScore,
          timeLimit,
          validFrom: validFrom ? new Date(validFrom) : null,
          validTo: validTo ? new Date(validTo) : null,
          isActive: true
        }
      });

      // Vytvoř otázky (již validované v schema)
      if (questions && questions.length > 0) {
        await tx.inspiritQuestion.createMany({
          data: questions.map((q, index: number) => ({
            testId: newTest.id,
            order: index,
            type: q.type,
            question: q.question,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer:
              typeof q.correctAnswer === 'string'
                ? q.correctAnswer
                : JSON.stringify(q.correctAnswer),
            points: q.points,
            required: q.required ?? true
          }))
        });
      }

      // Vrať test s otázkami
      return await tx.inspiritTest.findUnique({
        where: { id: newTest.id },
        include: {
          questions: {
            orderBy: { order: 'asc' }
          }
        }
      });
    });

    return NextResponse.json({
      success: true,
      test: test
    });
  } catch (error) {
    console.error('[POST /api/trainings/[id]/tests] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create test' },
      { status: 500 }
    );
  }
}
