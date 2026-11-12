import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SignInViewPage from './sign-in-view';

export const metadata: Metadata = {
  title: 'Přihlášení | ATC-LMS',
  description: 'Přihlášení do školicího systému ATC-LMS'
};

export default async function Page() {
  // Kontrola, zda je uživatel již přihlášený
  const session = await getServerSession(authOptions);

  if (session) {
    // Pokud je přihlášený, přesměrovat na hlavní stránku
    redirect('/');
  }

  return <SignInViewPage />;
}
