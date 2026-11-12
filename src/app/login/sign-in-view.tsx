// src/features/auth/components/sign-in-view.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';

export default function SignInViewPage() {
  // State pro univerzální formulář
  const [identifier, setIdentifier] = useState(''); // email nebo osobní číslo
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // State pro obecné chyby
  const [generalError, setGeneralError] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';
  const error = params.get('error');

  // Zpracování error parametrů z URL
  useEffect(() => {
    if (error === 'SessionExpired') {
      setGeneralError('Vaše relace vypršela. Prosím přihlaste se znovu.');
      // Vyčistit localStorage a sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    } else if (error === 'CredentialsSignin') {
      setGeneralError('Neplatné přihlašovací údaje.');
    } else if (error) {
      setGeneralError('Došlo k chybě při přihlašování.');
    }
  }, [error]);

  // Submit pro univerzální formulář
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      // Detekuj, zda je identifier email nebo osobní číslo
      const isEmail = identifier.includes('@');
      const loginType = isEmail ? 'email' : 'code';

      const res = await signIn('credentials', {
        ...(isEmail ? { email: identifier } : { code: identifier }),
        password,
        loginType,
        redirect: false,
        callbackUrl: callbackUrl
      });

      if (res?.error) {
        setLoginError('Neplatné přihlašovací údaje');
      } else if (res?.ok) {
        // Získat session pro určení role
        const { getSession } = await import('next-auth/react');
        const session = await getSession();

        // Přesměrovat podle role
        let redirectPath = callbackUrl;
        if (callbackUrl === '/') {
          // Pokud je callbackUrl root, přesměrujeme podle role
          if (session?.user?.role === 'ADMIN') {
            redirectPath = '/admin/prehled';
          } else if (session?.user?.role === 'TRAINER') {
            redirectPath = '/trainer';
          }
          // WORKER zůstane na '/'
        }

        router.push(redirectPath);
      }
    } catch {
      setLoginError('Chyba při přihlašování');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <Link
        href='/examples/authentication'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 hidden md:top-8 md:right-8'
        )}
      >
        Login
      </Link>

      {/* levý panel – světlý v obou motivech, logo je kreslené pro světlé pozadí */}
      <div className='relative hidden h-full flex-col items-center justify-center gap-12 overflow-hidden border-r bg-gradient-to-b from-white to-[#e4edf4] p-10 lg:flex'>
        <Image
          src='/atc-space-logo-vertical.png'
          alt='ATC Space'
          width={240}
          height={344}
          priority
        />
        <h1
          className='text-3xl text-[#006090] uppercase'
          style={{
            fontFamily: 'OPTIBankGothic-Medium, Arial, sans-serif',
            fontWeight: 500,
            letterSpacing: '0.45em',
            // prostrkání přidává mezeru i za poslední písmeno; bez vyrovnání by nadpis nebyl na středu
            marginRight: '-0.45em'
          }}
        >
          AeroLMS
        </h1>
      </div>

      {/* pravý panel – vlastní přihlášení */}
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
          {/* Na úzkých obrazovkách se levý panel nevykresluje, značku nese široké logo nad formulářem */}
          <div className='rounded-md lg:hidden dark:bg-white dark:px-3 dark:py-2'>
            <Image
              src='/atc-space-logo.png'
              alt='ATC Space'
              width={320}
              height={100}
              className='h-14 w-auto'
              priority
            />
          </div>

          {/* Zobrazení obecných chyb */}
          {generalError && (
            <Alert variant='destructive' className='mb-4'>
              <IconAlertCircle className='h-4 w-4' />
              <AlertDescription>{generalError}</AlertDescription>
            </Alert>
          )}

          {/* Univerzální přihlašovací formulář */}
          <div className='w-full space-y-6'>
            <div className='space-y-2 text-center'>
              <h1 className='text-2xl font-semibold tracking-tight'>
                Přihlášení
              </h1>
              <p className='text-muted-foreground text-sm'>
                Použijte svůj email nebo osobní číslo
              </p>
            </div>

            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='identifier'>E-mail / Osobní číslo</Label>
                <Input
                  id='identifier'
                  type='text'
                  placeholder='email@example.cz nebo 123456'
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={isLoading}
                  autoComplete='username'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='password'>Heslo</Label>
                <Input
                  id='password'
                  type='password'
                  placeholder='••••••'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete='current-password'
                  required
                />
              </div>
              {loginError && (
                <Alert variant='destructive'>
                  <IconAlertCircle className='h-4 w-4' />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <Button type='submit' className='w-full' disabled={isLoading}>
                {isLoading ? 'Přihlašování...' : 'Přihlásit se'}
              </Button>
            </form>
          </div>

          <p className='text-muted-foreground px-8 text-center text-sm'>
            © 2025 ATC Space. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </div>
  );
}
