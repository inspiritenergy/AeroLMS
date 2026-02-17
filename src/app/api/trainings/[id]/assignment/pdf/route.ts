// src/app/api/trainings/[id]/assignment/pdf/route.ts
// Enterprise-grade PDF upload/download/delete endpoint for training assignments

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin, isTrainer } from '@/types/roles';
import {
  validatePdfUpload,
  PdfDownloadQuerySchema,
  validateQueryParams
} from '@/lib/validation-schemas';
import { isTrainerAssignedToTraining } from '@/lib/authorization';
import {
  savePdfFile,
  readPdfFile,
  deletePdfFile,
  sanitizeFileName,
  validatePdfMagicBytes,
  validatePdfMimeType
} from '@/lib/file-storage';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// ============================================================================
// POST - Upload PDF for trainer's training assignment
// ============================================================================
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Neautorizovaný přístup' },
        { status: 401 }
      );
    }

    // SECURITY: Only TRAINER and ADMIN can upload
    if (!isTrainer(session.user.role) && !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Pouze školitelé mohou nahrávat PDF dokumenty' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: 'Neplatné ID školení' },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    // SECURITY: Validate trainer has access to this training
    if (isTrainer(session.user.role)) {
      const hasAccess = await isTrainerAssignedToTraining(userId, trainingId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Nemáte oprávnění k tomuto školení' },
          { status: 403 }
        );
      }
    }

    // Get the training to verify it exists and get the code
    const training = await prisma.inspiritTraining.findUnique({
      where: { id: trainingId, deletedAt: null },
      select: { id: true, code: true }
    });

    if (!training) {
      return NextResponse.json(
        { error: 'Školení nenalezeno' },
        { status: 404 }
      );
    }

    // Get the assignment record
    const assignment = await prisma.inspiritTrainingAssignment.findFirst({
      where: {
        trainerId: userId,
        trainingId: trainingId,
        deletedAt: null
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Přiřazení ke školení nenalezeno' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Soubor nebyl nahrán' },
        { status: 400 }
      );
    }

    // Validate file metadata
    const metadataValidation = validatePdfUpload({
      name: file.name,
      type: file.type,
      size: file.size
    });

    if (!metadataValidation.valid) {
      return NextResponse.json(
        { error: metadataValidation.error },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SECURITY: Validate MIME type
    if (!validatePdfMimeType(file.type)) {
      return NextResponse.json(
        { error: 'Neplatný typ souboru. Povoleno: PDF' },
        { status: 400 }
      );
    }

    // SECURITY: Validate PDF magic bytes
    if (!validatePdfMagicBytes(buffer)) {
      return NextResponse.json(
        { error: 'Soubor není platný PDF dokument' },
        { status: 400 }
      );
    }

    // Delete existing PDF if present (move to archive)
    if (assignment.pdfFileName) {
      try {
        await deletePdfFile(training.code, userId, assignment.pdfFileName, true);
      } catch {
        // Ignore deletion errors - file may not exist
      }
    }

    // Save the new PDF
    const sanitizedOriginalName = sanitizeFileName(file.name);
    const saveResult = await savePdfFile(
      training.code,
      userId,
      buffer,
      sanitizedOriginalName
    );

    // Update database with file metadata
    const updatedAssignment = await prisma.inspiritTrainingAssignment.update({
      where: { id: assignment.id },
      data: {
        pdfFileName: saveResult.fileName,
        pdfOriginalName: sanitizedOriginalName,
        pdfFileSize: BigInt(saveResult.fileSize),
        pdfMimeType: file.type,
        pdfUploadedAt: new Date(),
        pdfUploadedBy: userId
      }
    });

    return NextResponse.json({
      success: true,
      pdfFileName: updatedAssignment.pdfFileName,
      pdfOriginalName: updatedAssignment.pdfOriginalName,
      pdfFileSize: Number(updatedAssignment.pdfFileSize),
      pdfUploadedAt: updatedAssignment.pdfUploadedAt
    });
  } catch (error: any) {
    console.error('PDF upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při nahrávání PDF' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Download/View PDF
// ============================================================================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Neautorizovaný přístup' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: 'Neplatné ID školení' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const queryValidation = validateQueryParams(
      request.nextUrl.searchParams,
      PdfDownloadQuerySchema
    );
    const mode = queryValidation.success ? queryValidation.data.mode : 'view';

    // Get the training
    const training = await prisma.inspiritTraining.findUnique({
      where: { id: trainingId, deletedAt: null },
      select: { id: true, code: true }
    });

    if (!training) {
      return NextResponse.json(
        { error: 'Školení nenalezeno' },
        { status: 404 }
      );
    }

    // Find the assignment with PDF for this training
    // Business rule: one trainer per training, so there's only one PDF per training
    // All roles (including trainers in employee view) should see the training's PDF
    const assignment = await prisma.inspiritTrainingAssignment.findFirst({
      where: {
        trainingId: trainingId,
        deletedAt: null,
        pdfFileName: { not: null }
      },
      orderBy: {
        pdfUploadedAt: 'desc'
      }
    });

    if (!assignment || !assignment.pdfFileName) {
      return NextResponse.json(
        { error: 'PDF dokument nenalezen' },
        { status: 404 }
      );
    }

    // Read the PDF file
    const pdfBuffer = await readPdfFile(
      training.code,
      assignment.trainerId,
      assignment.pdfFileName
    );

    // Set appropriate headers based on mode
    const disposition =
      mode === 'download'
        ? `attachment; filename="${encodeURIComponent(assignment.pdfOriginalName || 'document.pdf')}"`
        : `inline; filename="${encodeURIComponent(assignment.pdfOriginalName || 'document.pdf')}"`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error: any) {
    console.error('PDF download error:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při stahování PDF' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete PDF from training assignment
// ============================================================================
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    // SECURITY: Require authentication
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Neautorizovaný přístup' },
        { status: 401 }
      );
    }

    // SECURITY: Only TRAINER and ADMIN can delete
    if (!isTrainer(session.user.role) && !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Pouze školitelé mohou mazat PDF dokumenty' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const trainingId = parseInt(id);

    if (isNaN(trainingId)) {
      return NextResponse.json(
        { error: 'Neplatné ID školení' },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    // Get the training
    const training = await prisma.inspiritTraining.findUnique({
      where: { id: trainingId, deletedAt: null },
      select: { id: true, code: true }
    });

    if (!training) {
      return NextResponse.json(
        { error: 'Školení nenalezeno' },
        { status: 404 }
      );
    }

    // Find the assignment
    let assignment;

    if (isAdmin(session.user.role)) {
      // Admin can delete any PDF
      assignment = await prisma.inspiritTrainingAssignment.findFirst({
        where: {
          trainingId: trainingId,
          deletedAt: null,
          pdfFileName: { not: null }
        }
      });
    } else {
      // Trainer can only delete their own PDF
      assignment = await prisma.inspiritTrainingAssignment.findFirst({
        where: {
          trainingId: trainingId,
          trainerId: userId,
          deletedAt: null,
          pdfFileName: { not: null }
        }
      });
    }

    if (!assignment || !assignment.pdfFileName) {
      return NextResponse.json(
        { error: 'PDF dokument nenalezen' },
        { status: 404 }
      );
    }

    // Delete the file (move to archive)
    await deletePdfFile(
      training.code,
      assignment.trainerId,
      assignment.pdfFileName,
      true // Archive instead of permanent delete
    );

    // Clear PDF metadata in database
    await prisma.inspiritTrainingAssignment.update({
      where: { id: assignment.id },
      data: {
        pdfFileName: null,
        pdfOriginalName: null,
        pdfFileSize: null,
        pdfMimeType: null,
        pdfUploadedAt: null,
        pdfUploadedBy: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'PDF dokument byl smazán'
    });
  } catch (error: any) {
    console.error('PDF delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při mazání PDF' },
      { status: 500 }
    );
  }
}
