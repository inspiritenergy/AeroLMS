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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  UserCheck,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Save
} from 'lucide-react';

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
  passingScore: number;
}

export function FirstTestsClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tests, setTests] = useState<Test[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [score, setScore] = useState<string>('');
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users - all roles (ALL employees can have required trainings)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users?context=first-tests');
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch {
        // Error silently handled via UI state
      }
    };
    fetchUsers();
  }, []);

  // Fetch trainings
  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const response = await fetch('/api/trainings?admin=true');
        if (response.ok) {
          const data = await response.json();
          setTrainings(data.trainings || []);
        }
      } catch {
        // Error silently handled via UI state
      }
    };
    fetchTrainings();
  }, []);

  // Fetch tests for selected training
  useEffect(() => {
    if (!selectedTrainingId) {
      setTests([]);
      return;
    }

    const fetchTests = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/trainings/${selectedTrainingId}/tests`
        );
        if (response.ok) {
          const data = await response.json();
          // Filter only active tests for first test entry
          const activeTests = (data.tests || []).filter((test: any) => test.isActive);
          setTests(activeTests);
        }
      } catch {
        // Error silently handled via UI state
      } finally {
        setIsLoading(false);
      }
    };
    fetchTests();
  }, [selectedTrainingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId || !selectedTestId || !score) {
      toast.error('Vyplňte všechna povinná pole');
      return;
    }

    const scoreNum = parseFloat(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      toast.error('Skóre musí být číslo mezi 0 a 100');
      return;
    }

    // Automatically determine if test was passed based on score
    const passed = selectedTest ? scoreNum >= selectedTest.passingScore : false;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/test-attempts/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: parseInt(selectedUserId),
          testId: parseInt(selectedTestId),
          score: scoreNum,
          passed,
          notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Chyba při ukládání výsledku');
      }

      toast.success('Výsledek testu byl úspěšně uložen');

      // Reset form
      setSelectedUserId('');
      setSelectedTrainingId('');
      setSelectedTestId('');
      setScore('');
      setNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Nepodařilo se uložit výsledek testu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTest = tests.find((t) => t.id === parseInt(selectedTestId));

  return (
    <PageContainer>
      <div className='space-y-6'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>První testy</h1>
          <p className='text-muted-foreground'>
            Zadejte výsledky prvních testů absolvovaných osobně se školitelem
          </p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileCheck className='h-5 w-5' />
            Zadání výsledku prvního testu
          </CardTitle>
          <CardDescription>
            Vyplňte formulář pro zaznamenání výsledku testu absolvovaného osobně
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* User Selection */}
            <div className='space-y-2'>
              <Label htmlFor='user' className='flex items-center gap-2'>
                <UserCheck className='h-4 w-4' />
                Zaměstnanec *
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id='user'>
                  <SelectValue placeholder='Vyberte zaměstnance' />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor='training'>Školení *</Label>
              <Select
                value={selectedTrainingId}
                onValueChange={setSelectedTrainingId}
              >
                <SelectTrigger id='training'>
                  <SelectValue placeholder='Vyberte školení' />
                </SelectTrigger>
                <SelectContent>
                  {trainings.map((training) => (
                    <SelectItem
                      key={training.id}
                      value={training.id.toString()}
                    >
                      {training.name} ({training.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Selection */}
            <div className='space-y-2'>
              <Label htmlFor='test'>Test *</Label>
              <Select
                value={selectedTestId}
                onValueChange={setSelectedTestId}
                disabled={!selectedTrainingId || isLoading}
              >
                <SelectTrigger id='test'>
                  <SelectValue
                    placeholder={isLoading ? 'Načítání...' : 'Vyberte test'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((test) => (
                    <SelectItem key={test.id} value={test.id.toString()}>
                      {test.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTest && (
                <p className='text-muted-foreground text-sm'>
                  Minimální úspěšnost: {selectedTest.passingScore}%
                </p>
              )}
            </div>

            {/* Score Input */}
            <div className='space-y-2'>
              <Label htmlFor='score'>Dosažené skóre (%) *</Label>
              <Input
                id='score'
                type='number'
                min='0'
                max='100'
                step='0.01'
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder='např. 85.5'
              />
              {selectedTest && score && (
                <div className='flex items-center gap-2'>
                  {parseFloat(score) >= selectedTest.passingScore ? (
                    <Badge variant='default' className='gap-1'>
                      <CheckCircle className='h-3 w-3' />
                      Uspěl
                    </Badge>
                  ) : (
                    <Badge variant='destructive' className='gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      Neuspěl
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className='space-y-2'>
              <Label htmlFor='notes'>Poznámky (volitelné)</Label>
              <Textarea
                id='notes'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Doplňující informace k absolvování testu...'
                rows={3}
              />
            </div>

            {/* Info Alert */}
            {selectedTest && score && parseFloat(score) >= selectedTest.passingScore && (
              <Alert>
                <CheckCircle className='h-4 w-4' />
                <AlertDescription>
                  Po uložení bude automaticky vytvořen certifikát a
                  aktualizována data školení zaměstnance.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className='flex justify-end gap-3'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setSelectedUserId('');
                  setSelectedTrainingId('');
                  setSelectedTestId('');
                  setScore('');
                  setNotes('');
                }}
                disabled={isSubmitting}
                className='cursor-pointer'
              >
                Vymazat formulář
              </Button>
              <Button
                type='submit'
                disabled={
                  isSubmitting || !selectedUserId || !selectedTestId || !score
                }
                className='gap-2 cursor-pointer'
              >
                <Save className='h-4 w-4' />
                {isSubmitting ? 'Ukládám...' : 'Uložit výsledek'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </PageContainer>
  );
}
