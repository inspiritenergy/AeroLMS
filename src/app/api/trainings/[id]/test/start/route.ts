import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserTrainingData } from '@/lib/training-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    // Get testId from request body
    const body = await request.json();
    const { testId } = body;

    if (!testId) {
      return NextResponse.json(
        { error: 'Test ID is required' },
        { status: 400 }
      );
    }

    // Verify test exists and belongs to this training
    const test = await prisma.inspiritTest.findFirst({
      where: {
        id: testId,
        trainingId: trainingId,
        isActive: true, // Only allow starting active tests
        deletedAt: null // Exclude soft-deleted tests
      },
      include: {
        training: true
      }
    });

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found or not active' },
        { status: 404 }
      );
    }

    // Get user data with training-specific fields
    const user = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Eligibility pravidla platí pro všechny role (ADMIN, TRAINER, WORKER)
    const trainingCode = test.training.code;

    // Get training data using raw SQL (Prisma can't access dynamic columns)
    const trainingData = await getUserTrainingData(
      parseInt(session.user.id),
      trainingCode
    );

    if (!trainingData) {
      return NextResponse.json(
        { error: 'Training data not found' },
        { status: 404 }
      );
    }

    // Check if training is required
    const isRequired = trainingData.pozadovano === true;

    // SECURITY: Check number of failed attempts SINCE last successful attempt
    // "Successful attempt" includes online pass OR manual entry by trainer
    // Manual passing test RESETS the counter, giving another 2 attempts
    const lastSuccessfulAttempt = await prisma.inspiritTestAttempt.findFirst({
      where: {
        testId: testId,
        userId: parseInt(session.user.id),
        passed: true,
        completedAt: { not: null },
        deletedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Count failed attempts AFTER the last successful attempt (or all if no success)
    const failedAttempts = await prisma.inspiritTestAttempt.findMany({
      where: {
        testId: testId,
        userId: parseInt(session.user.id),
        passed: false,
        completedAt: { not: null },
        deletedAt: null,
        ...(lastSuccessfulAttempt && {
          createdAt: {
            gt: lastSuccessfulAttempt.createdAt
          }
        })
      }
    });

    if (failedAttempts.length >= 2) {
      return NextResponse.json(
        {
          error:
            'Po dvou neúspěšných pokusech musíte absolvovat test osobně se školitelem',
          errorCode: 'MAX_ATTEMPTS_REACHED',
          requiresInPerson: true,
          failedAttempts: failedAttempts.length
        },
        { status: 403 }
      );
    }

    if (isRequired) {
      // Check if this is the first test (no previous completion date)
      const lastCompletionDate = trainingData.datumPosl;

      if (!lastCompletionDate) {
        return NextResponse.json(
          {
            error: 'První test musí být absolvován osobně se školitelem',
            errorCode: 'FIRST_TEST_REQUIRED',
            requiresInPerson: true
          },
          { status: 403 }
        );
      }

      // Check if user can retake test (one month before expiration)
      const nextDueDate = trainingData.datumPristi;

      if (nextDueDate) {
        const today = new Date();
        const dueDate = new Date(nextDueDate);
        const oneMonthBefore = new Date(dueDate);
        oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);

        if (today < oneMonthBefore) {
          const daysUntilAllowed = Math.ceil(
            (oneMonthBefore.getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          return NextResponse.json(
            {
              error: `Test můžete opakovat až měsíc před vypršením platnosti (za ${daysUntilAllowed} dní)`,
              errorCode: 'TOO_EARLY_TO_RETAKE',
              nextAllowedDate: oneMonthBefore.toISOString(),
              daysUntilAllowed
            },
            { status: 403 }
          );
        }
      }
    }

    // Check if there's an unfinished attempt for this specific test
    const existingAttempt = await prisma.inspiritTestAttempt.findFirst({
      where: {
        testId: testId,
        userId: parseInt(session.user.id),
        completedAt: null,
        deletedAt: null // Exclude soft-deleted attempts
      }
    });

    if (existingAttempt) {
      return NextResponse.json({
        attemptId: existingAttempt.id,
        testId: testId,
        message: 'Continuing existing test attempt'
      });
    }

    // Create new test attempt
    const newAttempt = await prisma.inspiritTestAttempt.create({
      data: {
        testId: testId,
        userId: parseInt(session.user.id),
        startedAt: new Date()
      }
    });

    return NextResponse.json({
      attemptId: newAttempt.id,
      testId: testId,
      message: 'Test started successfully'
    });
  } catch (error) {
    console.error('Failed to start test:', error);
    return NextResponse.json(
      { error: 'Failed to start test', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
