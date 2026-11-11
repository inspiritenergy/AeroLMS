/*******************************************************************************
 * AeroLMS - přihlášení aplikace (PŘEDVÁDĚCÍ INSTANCE)
 *
 * Aplikace se k databázi nepřipojuje jako sa. Dostává vlastní přihlášení AeroLMS
 * (stejné jméno jako v produkci) a jen ta práva, která doopravdy používá:
 *   - čtení a zápis dat ve schématu dbo
 *   - spuštění procedury sp_RegenerateInspiritCisZamView a funkce platnosti
 *   - ALTER na pohledu InspiritCisZam (procedura ho přegenerovává příkazem
 *     CREATE OR ALTER VIEW pod právy volajícího)
 *
 * Heslo přichází z proměnné sqlcmd APP_DB_PASSWORD. Při opakovaném běhu se heslo
 * přihlášení srovná s aktuální hodnotou.
 ******************************************************************************/

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'AeroLMS')
    CREATE LOGIN [AeroLMS] WITH PASSWORD = N'$(APP_DB_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = [Helios003];
ELSE
    ALTER LOGIN [AeroLMS] WITH PASSWORD = N'$(APP_DB_PASSWORD)', DEFAULT_DATABASE = [Helios003];
GO

USE Helios003;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'AeroLMS')
    CREATE USER [AeroLMS] FOR LOGIN [AeroLMS];
ELSE
    ALTER USER [AeroLMS] WITH LOGIN = [AeroLMS];
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO [AeroLMS];
GRANT EXECUTE ON OBJECT::dbo.sp_RegenerateInspiritCisZamView TO [AeroLMS];
GRANT EXECUTE ON OBJECT::dbo.fn_GetTrainingValidityMonths TO [AeroLMS];
GRANT ALTER ON OBJECT::dbo.InspiritCisZam TO [AeroLMS];
GO

PRINT 'Prihlaseni AeroLMS pripraveno';
GO
