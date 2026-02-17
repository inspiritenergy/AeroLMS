'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TestForm } from '@/components/training/test-form';
import { TestResults } from '@/components/training/test-results';
import PdfViewer from '@/components/training/pdf-viewer';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import {
  BookOpen,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Award,
  ArrowLeft,
  AlertTriangle,
  Info,
  Shield,
  FileCheck,
  Settings,
  BarChart3,
  ListChecks,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type ViewMode = 'overview' | 'test' | 'results';

// BUSINESS RULE: One training = one trainer (max)
interface Trainer {
  id: number;
  name: string;
  email: string | null;
}

interface TrainingClientProps {
  trainingData: {
    datumPosl: Date | null;
    pozadovano: boolean;
    datumPristi: Date | null;
  };
  training: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    content: any;
    hasTest: boolean;
    testId?: number;
  } | null;
  displayName: string;
  userRole: string;
  // Single trainer (or null if not assigned) - BUSINESS RULE: one trainer per training
  trainer: Trainer | null;
}

// Helper function to check if content is in Tiptap JSON format
function isTiptapFormat(content: any): boolean {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return parsed.type === 'doc' && Array.isArray(parsed.content);
    } catch {
      return false;
    }
  }
  return content?.type === 'doc' && Array.isArray(content?.content);
}

export function TrainingClient({
  trainingData,
  training,
  displayName,
  userRole,
  trainer
}: TrainingClientProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [test, setTest] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [hasPdfDocument, setHasPdfDocument] = useState(false);
  const [testEligibility, setTestEligibility] = useState<{
    canStart: boolean;
    reason: string;
    message?: string;
  } | null>(null);

  // Check if PDF document exists for this training
  useEffect(() => {
    if (training?.id) {
      fetch(`/api/trainings/${training.id}/assignment/pdf`, { method: 'HEAD' })
        .then((res) => setHasPdfDocument(res.ok))
        .catch(() => setHasPdfDocument(false));
    }
  }, [training?.id]);

  const handleStartTest = async () => {
    if (!training?.id) return;

    try {
      // First fetch available tests
      const testsResponse = await fetch(`/api/trainings/${training.id}/tests?employee=true`);
      if (!testsResponse.ok) {
        const errData = await testsResponse.json().catch(() => ({}));
        throw new Error(errData.error || `Chyba při načítání testů (${testsResponse.status})`);
      }
      const testsData = await testsResponse.json();

      if (!testsData.tests || testsData.tests.length === 0) {
        toast.error('Pro toto školení není k dispozici žádný test');
        return;
      }

      // Get the first active test (all roles see only active test in employee view)
      const activeTest = testsData.tests[0];

      // Try to start test attempt
      const startResponse = await fetch(
        `/api/trainings/${training.id}/test/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: activeTest.id })
        }
      );

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        // Handle specific error codes
        if (startData.errorCode === 'FIRST_TEST_REQUIRED') {
          toast.error(startData.error, {
            duration: 5000,
            description:
              'Kontaktujte svého školitele pro absolvování prvního testu.'
          });
          return;
        } else if (startData.errorCode === 'TOO_EARLY_TO_RETAKE') {
          toast.error(startData.error, {
            duration: 5000,
            description: `Můžete opakovat test od: ${new Date(startData.nextAllowedDate).toLocaleDateString('cs-CZ')}`
          });
          return;
        } else if (startData.errorCode === 'MAX_ATTEMPTS_REACHED') {
          toast.error(startData.error, {
            duration: 5000,
            description: 'Kontaktujte svého školitele pro další pokus.'
          });
          return;
        }
        throw new Error(startData.error || 'Failed to start test');
      }

      setTest(activeTest);
      setAttemptId(startData.attemptId);
      setViewMode('test');
      toast.success('Test byl úspěšně spuštěn');
    } catch (error) {
      console.error('Failed to start test:', error);
      toast.error('Nepodařilo se spustit test', {
        description: error instanceof Error ? error.message : 'Zkuste to prosím znovu nebo kontaktujte administrátora.'
      });
    }
  };

  const handleSubmitTest = async (data: any) => {
    if (!attemptId) return;

    try {
      const response = await fetch(`/api/test-attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to submit test');

      const results = await response.json();
      setTestResults(results);
      setViewMode('results');

      if (results.passed) {
        toast.success('Gratulujeme! Test jste úspěšně složili.');
      } else {
        toast.error('Test nebyl úspěšný. Zkuste to prosím znovu.');
      }
    } catch (error) {
      console.error('Failed to submit test:', error);
      toast.error('Nepodařilo se odeslat test', {
        description: error instanceof Error ? error.message : 'Zkuste to prosím znovu.'
      });
    }
  };

  const handleRetryTest = async () => {
    // Clear previous results
    setTestResults(null);
    setAttemptId(null);
    setTest(null);

    // Start new test immediately (same logic as handleStartTest)
    if (!training?.id) return;

    try {
      // First fetch available tests
      const testsResponse = await fetch(`/api/trainings/${training.id}/tests?employee=true`);
      if (!testsResponse.ok) {
        const errData = await testsResponse.json().catch(() => ({}));
        throw new Error(errData.error || `Chyba při načítání testů (${testsResponse.status})`);
      }
      const testsData = await testsResponse.json();

      if (!testsData.tests || testsData.tests.length === 0) {
        toast.error('Pro toto školení není k dispozici žádný test');
        return;
      }

      // Get the first active test (all roles see only active test in employee view)
      const activeTest = testsData.tests[0];

      // Try to start test attempt
      const startResponse = await fetch(
        `/api/trainings/${training.id}/test/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: activeTest.id })
        }
      );

      const startData = await startResponse.json();

      if (!startResponse.ok) {
        // Handle specific error codes
        if (startData.errorCode === 'FIRST_TEST_REQUIRED') {
          toast.error(startData.error, {
            duration: 5000,
            description:
              'Kontaktujte svého školitele pro absolvování prvního testu.'
          });
          return;
        } else if (startData.errorCode === 'TOO_EARLY_TO_RETAKE') {
          toast.error(startData.error, {
            duration: 5000,
            description: `Můžete opakovat test od: ${new Date(startData.nextAllowedDate).toLocaleDateString('cs-CZ')}`
          });
          return;
        } else if (startData.errorCode === 'MAX_ATTEMPTS_REACHED') {
          toast.error(startData.error, {
            duration: 5000,
            description: 'Kontaktujte svého školitele pro další pokus.'
          });

          // Fetch fresh eligibility from server to update button state
          if (training?.id) {
            try {
              const eligRes = await fetch(
                `/api/trainings/${training.id}/test/check-eligibility`
              );
              const eligData = await eligRes.json();
              setTestEligibility(eligData);
            } catch {
              setTestEligibility(null);
            }
          }

          // Return to overview with updated eligibility (button will show "Kontaktujte školitele")
          setViewMode('overview');
          return;
        }
        throw new Error(startData.error || 'Failed to start test');
      }

      setTest(activeTest);
      setAttemptId(startData.attemptId);
      setViewMode('test');
      toast.success('Test byl úspěšně spuštěn znovu');
    } catch (error) {
      console.error('Failed to retry test:', error);
      toast.error('Nepodařilo se znovu spustit test', {
        description: error instanceof Error ? error.message : 'Zkuste to prosím znovu nebo kontaktujte administrátora.'
      });
    }
  };

  const handleBackToOverview = async () => {
    // If user passed the test, reload page to show updated training data
    if (testResults?.passed) {
      window.location.reload();
    } else {
      // Refresh eligibility BEFORE switching view (eligibility may have changed after failed test)
      if (training?.id) {
        try {
          const res = await fetch(
            `/api/trainings/${training.id}/test/check-eligibility`
          );
          const data = await res.json();
          setTestEligibility(data);
        } catch {
          setTestEligibility(null);
        }
      }

      // Now switch to overview with updated eligibility
      setViewMode('overview');
      setTestResults(null);
      setAttemptId(null);
      setTest(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!training?.id) return;

    setIsDownloadingPdf(true);
    const dateStr = new Date().toISOString().split('T')[0];
    let downloadedCount = 0;

    try {
      // Download generated text content PDF if available
      if (training.content) {
        try {
          const textResponse = await fetch(`/api/trainings/${training.id}/pdf`);
          if (textResponse.ok) {
            const blob = await textResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${displayName}_obsah_${dateStr}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            downloadedCount++;
          }
        } catch {
          console.error('Failed to download text content PDF');
        }
      }

      // Download uploaded PDF document if available
      if (hasPdfDocument) {
        try {
          const pdfResponse = await fetch(
            `/api/trainings/${training.id}/assignment/pdf?mode=download`
          );
          if (pdfResponse.ok) {
            const blob = await pdfResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${displayName}_dokument_${dateStr}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            downloadedCount++;
          }
        } catch {
          console.error('Failed to download uploaded PDF document');
        }
      }

      if (downloadedCount > 0) {
        toast.success(
          downloadedCount === 1
            ? 'PDF byl úspěšně stažen'
            : `${downloadedCount} PDF soubory byly úspěšně staženy`
        );
      } else {
        toast.error('Žádný PDF obsah není k dispozici');
      }
    } catch {
      toast.error('Nepodařilo se stáhnout PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const [isExpired, setIsExpired] = useState(false);
  const isCompleted = trainingData.datumPosl !== null;

  // Vypočítej, zda může uživatel spustit test (stejná pravidla pro všechny role)
  const canStartTest = () => {
    if (!isCompleted) return false; // První test musí být osobně

    // Zkontroluj, zda je měsíc před vypršením
    if (trainingData.datumPristi) {
      const today = new Date();
      const dueDate = new Date(trainingData.datumPristi);
      const oneMonthBefore = new Date(dueDate);
      oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);

      return today >= oneMonthBefore;
    }

    return false;
  };

  useEffect(() => {
    if (trainingData.datumPristi) {
      setIsExpired(new Date(trainingData.datumPristi) < new Date());
    }
  }, [trainingData.datumPristi]);

  // Fetch test eligibility from server
  useEffect(() => {
    if (training?.id && viewMode === 'overview') {
      fetch(`/api/trainings/${training.id}/test/check-eligibility`)
        .then((res) => res.json())
        .then((data) => setTestEligibility(data))
        .catch(() => setTestEligibility(null));
    }
  }, [training?.id, viewMode, userRole]);

  // Test mode
  if (viewMode === 'test' && test && attemptId) {
    return (
      <TestForm test={test} attemptId={attemptId} onSubmit={handleSubmitTest} />
    );
  }

  // Results mode
  if (viewMode === 'results' && testResults) {
    return (
      <TestResults
        results={testResults}
        testTitle={test?.title || 'Test'}
        onRetry={handleRetryTest}
        onBackToTraining={handleBackToOverview}
      />
    );
  }

  // Overview mode (default)
  return (
    <div className='w-full space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>{displayName}</h1>
          {training && training.description && (
            <p className='text-muted-foreground mt-1'>{training.description}</p>
          )}
        </div>
        <Button
          variant='outline'
          onClick={() => router.push('/')}
          className='cursor-pointer gap-2'
        >
          <ArrowLeft className='h-4 w-4' />
          Zpět na přehled
        </Button>
      </div>

      {/* Status Cards */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card className='gap-1'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
              <Calendar className='h-4 w-4' />
              Poslední školení
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>
              {trainingData.datumPosl
                ? new Date(trainingData.datumPosl).toLocaleDateString('cs-CZ')
                : 'Neabsolvováno'}
            </p>
          </CardContent>
        </Card>

        <Card className='gap-1'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
              <AlertCircle className='h-4 w-4' />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trainingData.pozadovano ? (
              <Badge className='bg-orange-600 px-3 py-1 text-lg'>
                Požadováno
              </Badge>
            ) : (
              <Badge variant='secondary' className='px-3 py-1 text-lg'>
                Nepovinné
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className='gap-1'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
              <Clock className='h-4 w-4' />
              Příští školení
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${isExpired ? 'text-red-600' : ''}`}
            >
              {trainingData.datumPristi
                ? new Date(trainingData.datumPristi).toLocaleDateString('cs-CZ')
                : 'Neplánováno'}
            </p>
          </CardContent>
        </Card>

        <Card className='gap-1'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
              <Award className='h-4 w-4' />
              Platnost
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isCompleted ? (
              isExpired ? (
                <Badge variant='destructive' className='px-3 py-1 text-lg'>
                  Vypršelo
                </Badge>
              ) : (
                <Badge className='bg-green-600 px-3 py-1 text-lg'>Platné</Badge>
              )
            ) : (
              <Badge variant='outline' className='px-3 py-1 text-lg'>
                Neškoleno
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trainer Info - visible for all users */}
      {/* BUSINESS RULE: One training = one trainer */}
      {trainer && (
        <Card className='border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'>
          <CardContent className='py-0'>
            <div className='flex items-center gap-3'>
              <div className='rounded-full bg-blue-100 p-2 dark:bg-blue-900'>
                <User className='h-5 w-5 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                  Školitel
                </p>
                <div className='mt-1 flex items-center gap-2'>
                  <span className='font-semibold text-blue-800 dark:text-blue-200'>
                    {trainer.name || 'Neznámý'}
                  </span>
                  {trainer.email && (
                    <a
                      href={`mailto:${trainer.email}`}
                      className='text-sm text-blue-600 hover:underline dark:text-blue-400'
                    >
                      ({trainer.email})
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {isExpired && (
        <Card className='border-red-200 bg-red-50 dark:bg-red-950/20'>
          <CardContent className=''>
            <div className='flex items-start gap-3'>
              <AlertCircle className='mt-0.5 h-5 w-5 text-red-600' />
              <div>
                <p className='font-semibold text-red-900 dark:text-red-100'>
                  Platnost školení vypršela!
                </p>
                <p className='mt-1 text-sm text-red-700 dark:text-red-300'>
                  Je nutné absolvovat nové školení co nejdříve.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info about test availability - všechny role */}
      {training?.hasTest && (
        <div>
          {!isCompleted && (
            <Card className='mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20'>
              <CardContent className=''>
                <div className='flex items-start gap-3'>
                  <Info className='mt-0.5 h-5 w-5 text-blue-600' />
                  <div>
                    <p className='font-semibold text-blue-900 dark:text-blue-100'>
                      První test musí být absolvován osobně
                    </p>
                    <p className='mt-1 text-sm text-blue-700 dark:text-blue-300'>
                      Kontaktujte svého školitele pro absolvování prvního testu.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isCompleted && trainingData.datumPristi && !canStartTest() && (
            <Card className='mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20'>
              <CardContent className=''>
                <div className='flex items-start gap-3'>
                  <Clock className='mt-0.5 h-5 w-5 text-amber-600' />
                  <div>
                    <p className='font-semibold text-amber-900 dark:text-amber-100'>
                      Test bude dostupný měsíc před vypršením
                    </p>
                    <p className='mt-1 text-sm text-amber-700 dark:text-amber-300'>
                      Test můžete spustit od:{' '}
                      {(() => {
                        const dueDate = new Date(trainingData.datumPristi);
                        const oneMonthBefore = new Date(dueDate);
                        oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
                        return oneMonthBefore.toLocaleDateString('cs-CZ');
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {training && (
        <div className='flex gap-4'>
          <Button
            size='lg'
            variant='outline'
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || (!training.content && !hasPdfDocument)}
            className='cursor-pointer gap-2 px-8 py-6 text-base'
          >
            <FileText className='h-6 w-6' />
            {isDownloadingPdf ? 'Stahuji PDF...' : 'Stáhnout obsah v .pdf'}
          </Button>

          <Button
            size='lg'
            onClick={handleStartTest}
            disabled={!training.hasTest || !canStartTest()}
            className='cursor-pointer gap-2 px-8 py-6 text-base'
          >
            <FileText className='h-6 w-6' />
            {testEligibility && !testEligibility.canStart
              ? testEligibility.reason === 'max_attempts'
                ? 'Kontaktujte školitele'
                : testEligibility.reason === 'first_test'
                  ? 'První test osobně'
                  : testEligibility.reason === 'too_early'
                    ? 'Test zatím nedostupný'
                    : testEligibility.reason === 'no_test'
                      ? 'Test není dostupný'
                      : 'Spustit test'
              : !canStartTest()
                ? isCompleted
                  ? 'Test zatím nedostupný'
                  : 'První test osobně'
                : 'Spustit test'}
          </Button>
        </div>
      )}

      {/* Training Content Display with Tabs */}
      {training && (
        <Tabs defaultValue='text' className='w-full'>
          <TabsList className='grid h-auto w-full grid-cols-2 p-[2px]'>
            <TabsTrigger value='text' className='cursor-pointer gap-2 py-3 text-base'>
              <BookOpen className='h-5 w-5' />
              Textový obsah
            </TabsTrigger>
            <TabsTrigger value='pdf' className='cursor-pointer gap-2 py-3 text-base'>
              <FileText className='h-5 w-5' />
              PDF dokument
              {hasPdfDocument ? (
                <Badge variant='default' className='ml-1 bg-green-600 px-2 py-0.5 text-xs'>
                  ✓
                </Badge>
              ) : (
                <Badge variant='destructive' className='ml-1 px-2 py-0.5 text-xs'>
                  ✗
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Text Content Tab */}
          <TabsContent value='text' className='mt-4'>
            {training.content ? (
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <BookOpen className='h-5 w-5' />
                    Obsah školení
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='mx-auto max-w-[1200px] space-y-8'>
                    {isTiptapFormat(training.content) ? (
                      // New Tiptap format - render with read-only editor
                      <TiptapEditor
                        value={
                          typeof training.content === 'string'
                            ? training.content
                            : JSON.stringify(training.content)
                        }
                        editable={false}
                      />
                    ) : training.content.sections ? (
                      // Legacy format - render with old structure
                      training.content.sections.map((section: any, index: number) => {
                        const content = section.content;

                        if (!content) {
                          return null;
                        }

                        // Render structured content as continuous flow
                        return (
                          <div key={index} className='space-y-6'>
                            {/* Introduction */}
                            {content.introduction && (
                              <div className='prose prose-sm max-w-none'>
                                <p className='text-muted-foreground text-base leading-relaxed'>
                                  {content.introduction}
                                </p>
                              </div>
                            )}

                            {/* Key Points */}
                            {content.keyPoints && (
                              <Card className='bg-primary/5 border-primary/20'>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='flex items-center gap-2 text-sm'>
                                    <Info className='h-4 w-4' />
                                    Klíčové body
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <ul className='space-y-2'>
                                    {content.keyPoints.map(
                                      (point: string, i: number) => (
                                        <li
                                          key={i}
                                          className='flex items-start gap-2'
                                        >
                                          <CheckCircle className='text-primary mt-0.5 h-4 w-4 flex-shrink-0' />
                                          <span className='text-sm'>{point}</span>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </CardContent>
                              </Card>
                            )}

                            {/* Image placeholder */}
                            {content.image && (
                              <div className='bg-muted relative flex h-64 w-full items-center justify-center rounded-lg'>
                                <div className='text-muted-foreground text-center'>
                                  <BarChart3 className='mx-auto mb-2 h-12 w-12' />
                                  <p className='text-sm'>Ilustrační diagram</p>
                                </div>
                              </div>
                            )}

                            {/* Rules */}
                            {content.rules && (
                              <div className='space-y-4'>
                                {content.rules.map((rule: any, i: number) => (
                                  <Card key={i}>
                                    <CardHeader className='pb-3'>
                                      <CardTitle className='flex items-center gap-2 text-base'>
                                        <Badge variant='outline'>{rule.number}</Badge>
                                        {rule.title}
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className='space-y-3'>
                                      <p className='text-muted-foreground text-sm'>
                                        {rule.description}
                                      </p>

                                      {rule.checklist && (
                                        <div className='space-y-1'>
                                          {rule.checklist.map(
                                            (item: string, j: number) => (
                                              <div
                                                key={j}
                                                className='flex items-center gap-2'
                                              >
                                                <ListChecks className='text-muted-foreground h-3 w-3' />
                                                <span className='text-sm'>
                                                  {item}
                                                </span>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      )}

                                      {rule.parameters && (
                                        <div className='mt-3 grid grid-cols-2 gap-2'>
                                          {Object.entries(rule.parameters).map(
                                            ([key, value]) => (
                                              <div
                                                key={key}
                                                className='bg-muted flex justify-between rounded p-2 text-sm'
                                              >
                                                <span className='font-medium'>
                                                  {key}:
                                                </span>
                                                <span className='text-muted-foreground'>
                                                  {value as string}
                                                </span>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}

                            {/* Standards */}
                            {content.standards && (
                              <div className='flex flex-wrap gap-2'>
                                {content.standards.map(
                                  (standard: string, i: number) => (
                                    <Badge key={i} variant='secondary'>
                                      <FileCheck className='mr-1 h-3 w-3' />
                                      {standard}
                                    </Badge>
                                  )
                                )}
                              </div>
                            )}

                            {/* Tolerances */}
                            {content.tolerances && (
                              <Card>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='flex items-center gap-2 text-sm'>
                                    <Settings className='h-4 w-4' />
                                    Tolerance
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className='grid grid-cols-2 gap-3'>
                                    {Object.entries(content.tolerances).map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className='rounded-lg border p-3'
                                        >
                                          <div className='text-muted-foreground mb-1 text-xs'>
                                            {key}
                                          </div>
                                          <div className='font-mono font-semibold'>
                                            {value as string}
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Defects */}
                            {content.defects && (
                              <Card className='border-destructive/20 bg-destructive/5'>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='text-destructive flex items-center gap-2 text-sm'>
                                    <AlertTriangle className='h-4 w-4' />
                                    Možné vady
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className='flex flex-wrap gap-2'>
                                    {content.defects.map(
                                      (defect: string, i: number) => (
                                        <Badge
                                          key={i}
                                          variant='outline'
                                          className='border-destructive/30 text-destructive'
                                        >
                                          {defect}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Documents */}
                            {content.documents && (
                              <div className='space-y-3'>
                                {content.documents.map((doc: any, i: number) => (
                                  <Card key={i} className='overflow-hidden'>
                                    <div className='flex'>
                                      <div className='bg-primary w-2' />
                                      <div className='flex-1 p-4'>
                                        <div className='flex items-start justify-between'>
                                          <div className='space-y-1'>
                                            <div className='flex items-center gap-2'>
                                              <FileText className='text-primary h-4 w-4' />
                                              <h4 className='text-sm font-semibold'>
                                                {doc.name}
                                              </h4>
                                            </div>
                                            <p className='text-muted-foreground text-xs'>
                                              {doc.purpose}
                                            </p>
                                          </div>
                                          {doc.frequency && (
                                            <Badge variant='secondary'>
                                              <Clock className='mr-1 h-3 w-3' />
                                              {doc.frequency}
                                            </Badge>
                                          )}
                                        </div>
                                        {doc.fields && (
                                          <div className='mt-2 flex flex-wrap gap-1'>
                                            {doc.fields.map(
                                              (field: string, j: number) => (
                                                <Badge
                                                  key={j}
                                                  variant='outline'
                                                  className='text-xs'
                                                >
                                                  {field}
                                                </Badge>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            )}

                            {/* PPE */}
                            {content.ppe && (
                              <Card>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='flex items-center gap-2 text-sm'>
                                    <Shield className='h-4 w-4' />
                                    Osobní ochranné pomůcky
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className='grid grid-cols-2 gap-2'>
                                    {content.ppe.map((item: string, i: number) => (
                                      <div
                                        key={i}
                                        className='bg-muted flex items-center gap-2 rounded p-2'
                                      >
                                        <Shield className='text-primary h-4 w-4' />
                                        <span className='text-sm'>{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Hazards */}
                            {content.hazards && (
                              <Card className='border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-300'>
                                    <AlertTriangle className='h-4 w-4' />
                                    Nebezpečí
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <ul className='space-y-1'>
                                    {content.hazards.map(
                                      (hazard: string, i: number) => (
                                        <li
                                          key={i}
                                          className='flex items-center gap-2 text-sm'
                                        >
                                          <div className='h-1.5 w-1.5 rounded-full bg-yellow-600' />
                                          {hazard}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </CardContent>
                              </Card>
                            )}

                            {/* Emergency */}
                            {content.emergency && (
                              <Card className='border-destructive bg-destructive/5'>
                                <CardHeader className='pb-3'>
                                  <CardTitle className='text-destructive text-sm'>
                                    Tísňové kontakty
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className='space-y-2'>
                                    {Object.entries(content.emergency).map(
                                      ([key, value]) => (
                                        <div
                                          key={key}
                                          className='bg-background flex justify-between rounded p-2'
                                        >
                                          <span className='text-sm font-medium'>
                                            {key}:
                                          </span>
                                          <span className='text-destructive font-mono text-sm font-bold'>
                                            {value as string}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className='text-muted-foreground'>
                        Pro toto školení není dostupný online obsah.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className='py-12 text-center'>
                  <BookOpen className='mx-auto h-12 w-12 text-muted-foreground mb-4' />
                  <p className='text-muted-foreground'>
                    Pro toto školení není dostupný textový obsah.
                  </p>
                  <p className='text-muted-foreground text-sm mt-2'>
                    Zkontrolujte záložku PDF dokument.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PDF Document Tab */}
          <TabsContent value='pdf' className='mt-4'>
            <PdfViewer
              trainingId={training.id}
              trainingName={displayName}
              showCard={true}
              height='700px'
            />
          </TabsContent>
        </Tabs>
      )}

      {/* No training data message */}
      {!training && (
        <Card>
          <CardHeader>
            <CardTitle>Detail školení</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground'>
              Pro toto školení nejsou k dispozici další informace v systému.
            </p>
            {trainingData.pozadovano && (
              <p className='mt-2 text-orange-600 dark:text-orange-400'>
                ⚠️ Toto školení je pro vás požadováno.
              </p>
            )}
            {isExpired && (
              <p className='mt-2 text-red-600 dark:text-red-400'>
                ❌ Termín dalšího školení již vypršel!
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
