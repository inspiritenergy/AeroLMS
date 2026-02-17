'use client';

import { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  Award,
  FileText,
  Filter,
  Loader2,
  AlertCircle,
  Info
} from 'lucide-react';

interface TestAttempt {
  id: number;
  testTitle: string;
  trainingName: string;
  userName: string;
  userCislo: number | null;
  score: number;
  passed: boolean;
  createdAt: string;
  certificate: {
    id: number;
    certificateNumber: string;
    issuedAt: string;
    validUntil: string;
  } | null;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  cislo: number | null;
}

interface Training {
  id: number;
  name: string;
  code: string;
}

interface Test {
  id: number;
  title: string;
  trainingId: number;
}

interface Question {
  id: number;
  order: number;
  type: string;
  question: string;
  options: string[] | null;
  correctAnswer: string;
  points: number;
  required: boolean;
}

interface TestAttemptDetail {
  attempt: {
    id: number;
    score: number | null;
    passed: boolean | null;
    startedAt: string;
    completedAt: string | null;
    isManual: boolean;
    notes: string | null;
    answers: { [key: number]: any } | null;
  };
  test: {
    id: number;
    title: string;
    passingScore: number;
    timeLimit: number | null;
    questions: Question[];
  };
  training: {
    id: number;
    name: string;
    code: string;
  };
  user: {
    id: number;
    firstName: string;
    lastName: string;
    cislo: number | null;
  };
  certificate: {
    id: number;
    certificateNumber: string;
    issuedAt: string;
    validUntil: string;
  } | null;
}

export function ResultsClient() {
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tests, setTests] = useState<Test[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAttemptDetail, setSelectedAttemptDetail] =
    useState<TestAttemptDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch initial data (users, trainings, tests)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch users, trainings in parallel
        const [usersRes, trainingsRes] = await Promise.all([
          fetch('/api/users?context=first-tests'),
          fetch('/api/trainings?admin=true')
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }

        if (trainingsRes.ok) {
          const data = await trainingsRes.json();
          setTrainings(data.trainings || []);
        }
      } catch {
        // Error silently handled via UI state
      }
    };
    fetchInitialData();
  }, []);

  // Fetch tests when training is selected
  useEffect(() => {
    if (!selectedTrainingId) {
      return;
    }

    const fetchTests = async () => {
      try {
        const training = trainings.find(
          (t) => t.id === parseInt(selectedTrainingId)
        );
        if (!training) return;

        const response = await fetch(`/api/trainings/${training.id}/tests`);
        if (response.ok) {
          const data = await response.json();
          setTests(data.tests || []);
        }
      } catch {
        // Error silently handled via UI state
      }
    };

    fetchTests();
  }, [selectedTrainingId, trainings]);

  // Fetch attempts with filters
  useEffect(() => {
    const fetchAttempts = async () => {
      setIsLoading(true);
      try {
        // Build query params (skip "_all" values)
        const params = new URLSearchParams();
        params.append('includeAll', 'true'); // Include both manual and online test attempts
        if (selectedUserId && selectedUserId !== '_all')
          params.append('userId', selectedUserId);
        if (selectedTrainingId && selectedTrainingId !== '_all')
          params.append('trainingId', selectedTrainingId);
        if (selectedTestId && selectedTestId !== '_all')
          params.append('testId', selectedTestId);

        const queryString = params.toString();
        const url = `/api/test-attempts/manual?${queryString}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setAttempts(data.attempts || []);
        }
      } catch {
        // Error silently handled via UI state
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttempts();
  }, [selectedUserId, selectedTrainingId, selectedTestId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle row click - fetch test attempt details
  const handleViewDetail = async (attemptId: number) => {
    setLoadingDetail(true);
    setDetailDialogOpen(true);
    setSelectedAttemptDetail(null);

    try {
      const response = await fetch(`/api/test-attempts/${attemptId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedAttemptDetail(data);
      } else {
        // Handle error
        console.error('Failed to fetch test attempt details');
      }
    } catch (error) {
      console.error('Error fetching test attempt details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Check if user answer is correct for a question
  const isAnswerCorrect = (question: Question, userAnswer: any): boolean => {
    if (question.type === 'single') {
      return userAnswer === question.correctAnswer;
    } else if (question.type === 'multiple') {
      try {
        const correctAnswers = JSON.parse(question.correctAnswer);
        if (Array.isArray(userAnswer) && Array.isArray(correctAnswers)) {
          const userSet = new Set(userAnswer);
          const correctSet = new Set(correctAnswers);
          // All user answers must be correct and all correct answers must be selected
          return (
            userSet.size === correctSet.size &&
            [...userSet].every((a) => correctSet.has(a))
          );
        }
      } catch {
        return false;
      }
    }
    return false;
  };

  return (
    <PageContainer>
      <div className='w-full max-w-full min-w-0 space-y-6'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Výsledky testů</h1>
          <p className='text-muted-foreground'>
            Přehled všech výsledků testů ze všech přidělených školení
          </p>
        </div>

      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className='h-5 w-5' />
            Filtry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {/* User Selection */}
            <div className='space-y-2'>
              <Label htmlFor='user'>Zaměstnanec</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id='user' className='w-full'>
                  <SelectValue placeholder='Všichni' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='_all'>Všichni</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {`${user.firstName} ${user.lastName}`} ({user.cislo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Training Selection */}
            <div className='space-y-2'>
              <Label htmlFor='training'>Školení</Label>
              <Select
                value={selectedTrainingId}
                onValueChange={(value) => {
                  setSelectedTrainingId(value);
                  setSelectedTestId(''); // Reset test selection
                }}
              >
                <SelectTrigger id='training' className='w-full'>
                  <SelectValue placeholder='Všechna školení' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='_all'>Všechna školení</SelectItem>
                  {trainings.map((training) => (
                    <SelectItem key={training.id} value={training.id.toString()}>
                      {training.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Selection */}
            <div className='space-y-2'>
              <Label htmlFor='test'>Test</Label>
              <Select
                value={selectedTestId}
                onValueChange={setSelectedTestId}
                disabled={!selectedTrainingId || selectedTrainingId === '_all'}
              >
                <SelectTrigger id='test' className='w-full'>
                  <SelectValue placeholder='Všechny testy' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='_all'>Všechny testy</SelectItem>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id.toString()}>
                      {test.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Výsledky testů
            </div>
            <Badge variant='outline'>
              {attempts.length}{' '}
              {attempts.length === 1 ? 'výsledek' : 'výsledků'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Seznam všech absolvovaných testů ze všech přidělených školení
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='text-muted-foreground py-8 text-center'>
              Načítání...
            </div>
          ) : attempts.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center'>
              Žádné výsledky k zobrazení
            </div>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaměstnanec</TableHead>
                    <TableHead>Školení</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Skóre</TableHead>
                    <TableHead>Výsledek</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Certifikát</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow
                      key={attempt.id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => handleViewDetail(attempt.id)}
                    >
                      <TableCell className='font-medium'>
                        {attempt.userName}
                        {attempt.userCislo && (
                          <span className='text-muted-foreground ml-2 text-sm'>
                            ({attempt.userCislo})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{attempt.trainingName}</TableCell>
                      <TableCell>{attempt.testTitle}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {attempt.score.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {attempt.passed ? (
                          <Badge variant='default' className='gap-1'>
                            <CheckCircle className='h-3 w-3' />
                            Uspěl
                          </Badge>
                        ) : (
                          <Badge variant='destructive' className='gap-1'>
                            <XCircle className='h-3 w-3' />
                            Neuspěl
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-muted-foreground text-sm'>
                        {formatDate(attempt.createdAt)}
                      </TableCell>
                      <TableCell>
                        {attempt.certificate ? (
                          <div className='flex items-center gap-2'>
                            <Award className='h-4 w-4 text-yellow-600' />
                            <span className='font-mono text-sm'>
                              {attempt.certificate.certificateNumber}
                            </span>
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-sm'>
                            -
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* Test Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className='max-h-[90vh] sm:max-w-6xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <FileText className='h-5 w-5' />
              Detail výsledku testu
            </DialogTitle>
            <DialogDescription>
              {loadingDetail
                ? 'Načítání...'
                : selectedAttemptDetail
                  ? 'Kompletní přehled vyplněného testu včetně odpovědí'
                  : 'Chyba při načítání'}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-8 w-8 animate-spin text-primary' />
            </div>
          ) : selectedAttemptDetail ? (
            <>
              <div className='space-y-6'>
                {/* Test Info */}
                <div className='grid gap-4 md:grid-cols-2'>
                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>
                        Zaměstnanec
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className='font-semibold'>
                        {selectedAttemptDetail.user.firstName}{' '}
                        {selectedAttemptDetail.user.lastName}
                      </p>
                      {selectedAttemptDetail.user.cislo && (
                        <p className='text-muted-foreground text-sm'>
                          Číslo: {selectedAttemptDetail.user.cislo}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>
                        Školení a test
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className='font-semibold'>
                        {selectedAttemptDetail.training.name}
                      </p>
                      <p className='text-muted-foreground text-sm'>
                        {selectedAttemptDetail.test.title}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>
                        Výsledek
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='flex items-center gap-3'>
                        <span className='text-2xl font-bold'>
                          {selectedAttemptDetail.attempt.score?.toFixed(1)}%
                        </span>
                        {selectedAttemptDetail.attempt.passed ? (
                          <Badge variant='default' className='gap-1'>
                            <CheckCircle className='h-3 w-3' />
                            Uspěl
                          </Badge>
                        ) : (
                          <Badge variant='destructive' className='gap-1'>
                            <XCircle className='h-3 w-3' />
                            Neuspěl
                          </Badge>
                        )}
                      </div>
                      <p className='text-muted-foreground mt-1 text-sm'>
                        Minimální úspěšnost:{' '}
                        {selectedAttemptDetail.test.passingScore}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm font-medium'>
                        Datum absolvování
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className='font-medium'>
                        {selectedAttemptDetail.attempt.completedAt
                          ? formatDate(selectedAttemptDetail.attempt.completedAt)
                          : 'Nedokončeno'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Manual Test or Questions */}
                {selectedAttemptDetail.attempt.isManual ? (
                  <Card className='border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20'>
                    <CardContent className='pt-6'>
                      <div className='flex items-start gap-3'>
                        <Info className='mt-0.5 h-5 w-5 text-yellow-600' />
                        <div className='space-y-2'>
                          <p className='font-semibold text-yellow-900 dark:text-yellow-100'>
                            Ručně vyplněný test školitelem
                          </p>
                          <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                            Tento test byl absolvován osobně se školitelem a zadán
                            manuálně do systému. Detaily jednotlivých otázek a
                            odpovědí nejsou k dispozici.
                          </p>
                          {selectedAttemptDetail.attempt.notes && (
                            <div className='mt-3'>
                              <p className='text-sm font-medium text-yellow-900 dark:text-yellow-100'>
                                Poznámky:
                              </p>
                              <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                                {selectedAttemptDetail.attempt.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold'>
                        Otázky a odpovědi
                      </h3>
                      <Badge variant='outline'>
                        {selectedAttemptDetail.test.questions.length} otázek
                      </Badge>
                    </div>

                    {/* Questions */}
                    {selectedAttemptDetail.test.questions.map(
                      (question, index) => {
                        const userAnswer =
                          selectedAttemptDetail.attempt.answers?.[question.id];
                        const isCorrect = isAnswerCorrect(question, userAnswer);

                        return (
                          <Card key={question.id}>
                            <CardHeader>
                              <div className='flex items-start justify-between gap-4'>
                                <div className='flex-1'>
                                  <div className='mb-2 flex items-center gap-2'>
                                    <Badge variant='outline'>
                                      Otázka {index + 1}
                                    </Badge>
                                    <Badge variant='secondary'>
                                      {question.points}{' '}
                                      {question.points === 1 ? 'bod' : 'body'}
                                    </Badge>
                                    <Badge
                                      variant={
                                        question.type === 'single'
                                          ? 'default'
                                          : 'secondary'
                                      }
                                    >
                                      {question.type === 'single'
                                        ? 'Jedna správná'
                                        : 'Více správných'}
                                    </Badge>
                                  </div>
                                  <p className='font-medium'>
                                    {question.question}
                                  </p>
                                </div>
                                {isCorrect ? (
                                  <CheckCircle className='h-5 w-5 text-green-600' />
                                ) : (
                                  <XCircle className='h-5 w-5 text-red-600' />
                                )}
                              </div>
                            </CardHeader>
                            <CardContent>
                              {question.options ? (
                                <div className='space-y-2'>
                                  {question.options.map((option, optIndex) => {
                                    const correctAnswers =
                                      question.type === 'multiple'
                                        ? JSON.parse(question.correctAnswer)
                                        : [question.correctAnswer];
                                    const isCorrectOption =
                                      correctAnswers.includes(option);
                                    const isUserSelected = Array.isArray(
                                      userAnswer
                                    )
                                      ? userAnswer.includes(option)
                                      : userAnswer === option;

                                    return (
                                      <div
                                        key={optIndex}
                                        className={`flex items-start gap-2 rounded-lg border p-3 ${
                                          isCorrectOption && isUserSelected
                                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                            : isUserSelected
                                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                              : isCorrectOption
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                                : 'border-muted'
                                        }`}
                                      >
                                        <div className='mt-0.5 flex-shrink-0'>
                                          {isUserSelected ? (
                                            isCorrectOption ? (
                                              <CheckCircle className='h-4 w-4 text-green-600' />
                                            ) : (
                                              <XCircle className='h-4 w-4 text-red-600' />
                                            )
                                          ) : isCorrectOption ? (
                                            <Info className='h-4 w-4 text-blue-600' />
                                          ) : null}
                                        </div>
                                        <div className='flex-1'>
                                          <p className='text-sm'>{option}</p>
                                          {isUserSelected && (
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                              {isCorrectOption
                                                ? 'Správně vybráno'
                                                : 'Nesprávně vybráno'}
                                            </p>
                                          )}
                                          {!isUserSelected && isCorrectOption && (
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                              Správná odpověď (nevybráno)
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className='space-y-2'>
                                  <p className='text-sm font-medium'>
                                    Odpověď zaměstnance:
                                  </p>
                                  <p
                                    className={`rounded-lg border p-3 ${
                                      isCorrect
                                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                        : 'border-red-500 bg-red-50 dark:bg-red-950/20'
                                    }`}
                                  >
                                    {userAnswer || '(bez odpovědi)'}
                                  </p>
                                  {!isCorrect && (
                                    <div>
                                      <p className='text-sm font-medium text-blue-600'>
                                        Správná odpověď:
                                      </p>
                                      <p className='text-muted-foreground text-sm'>
                                        {question.correctAnswer}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      }
                    )}
                  </div>
                )}

                {/* Certificate Info */}
                {selectedAttemptDetail.certificate && (
                  <>
                    <Separator />
                    <Card className='border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'>
                      <CardContent className='pt-6'>
                        <div className='flex items-start gap-3'>
                          <Award className='mt-0.5 h-5 w-5 text-green-600' />
                          <div className='space-y-1'>
                            <p className='font-semibold text-green-900 dark:text-green-100'>
                              Certifikát vystaven
                            </p>
                            <p className='font-mono text-sm text-green-700 dark:text-green-300'>
                              {selectedAttemptDetail.certificate.certificateNumber}
                            </p>
                            <p className='text-sm text-green-700 dark:text-green-300'>
                              Platnost do:{' '}
                              {formatDate(
                                selectedAttemptDetail.certificate.validUntil
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              <div className='flex justify-end gap-2 pt-4'>
                <Button
                  variant='outline'
                  onClick={() => setDetailDialogOpen(false)}
                  className='cursor-pointer'
                >
                  Zavřít
                </Button>
              </div>
            </>
          ) : (
            <div className='py-12 text-center'>
              <AlertCircle className='text-destructive mx-auto mb-3 h-12 w-12' />
              <p className='text-muted-foreground'>
                Nepodařilo se načíst detail testu
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </PageContainer>
  );
}
