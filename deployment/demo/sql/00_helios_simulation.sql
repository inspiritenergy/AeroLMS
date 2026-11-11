/*******************************************************************************
 * AeroLMS - simulace tabulek Helios ERP (PŘEDVÁDĚCÍ INSTANCE)
 *
 * Účel:
 *   Předváděcí instance nemá přístup k podnikovému Heliosu. Tento skript proto
 *   založí databázi Helios003 a v ní minimální podobu tabulek Heliosu, o které
 *   se AeroLMS opírá. Nad nimi pak běží PRODUKČNÍ skripty deployment/sql/02-10
 *   beze změny, takže schéma aplikace, pohled InspiritCisZam, jeho triggery
 *   i procedura sp_RegenerateInspiritCisZamView jsou v předváděcí instanci
 *   stejné jako v produkci.
 *
 * Co simuluje:
 *   TabCisZam      - kmenová tabulka zaměstnanců (ID, Cislo, Jmeno, Prijmeni, Alias)
 *   TabCisZam_EXT  - rozšíření se sloupci školení (_{kód}DatumPosl, _{kód}Pozadovano)
 *                    a sloupcem _DruhPozice; 29 školení shodných s produkčním
 *                    pohledem (deployment/sql/03_create_inspirit_view.sql)
 *   TabMzdObd      - mzdová období (právě jedno má Stav = 1 = aktuální)
 *   TabZamMzd      - mzdový záznam zaměstnance v období (StavES, DruhPP);
 *                    pohled podle něj zobrazuje jen zaměstnance v evidenčním stavu
 *   TabMzNastupPP  - nástupy do pracovního poměru (pohled se na tabulku jen ptá)
 *
 * Bezpečné opakování: každý objekt vzniká jen tehdy, když neexistuje.
 * NIKDY nespouštět proti skutečnému Heliosu - skript na to má pojistku níže.
 ******************************************************************************/

IF DB_ID(N'Helios003') IS NULL
BEGIN
    CREATE DATABASE [Helios003];
    PRINT 'Databaze Helios003 zalozena';
END
GO

USE Helios003;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Pojistka: skutečný Helios má stovky tabulek Tab*. Simulace jich zakládá pět.
-- Když jich v databázi je víc a značka simulace chybí, nejde o předváděcí databázi.
IF (SELECT COUNT(*) FROM sys.tables WHERE name LIKE 'Tab%') > 5
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties
                   WHERE class = 0 AND name = N'AeroLMS.HeliosSimulation')
BEGIN
    RAISERROR('Databaze vypada jako skutecny Helios (vice tabulek Tab* a bez znacky simulace). Skript konci.', 16, 1);
    SET NOEXEC ON;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 0 AND name = N'AeroLMS.HeliosSimulation')
    EXEC sys.sp_addextendedproperty
        @name = N'AeroLMS.HeliosSimulation',
        @value = N'Predvadeci instance AeroLMS: tabulky Tab* jsou simulace, ne Helios ERP.';
GO

-- ============================================================================
-- TabCisZam - kmenová tabulka zaměstnanců
-- ============================================================================
IF OBJECT_ID(N'dbo.TabCisZam', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TabCisZam] (
        [ID]       INT IDENTITY(1,1) NOT NULL,
        [Cislo]    INT NOT NULL,              -- osobní číslo (přihlášení)
        [Jmeno]    NVARCHAR(100) NOT NULL,
        [Prijmeni] NVARCHAR(100) NOT NULL,
        [Alias]    NVARCHAR(255) NULL,        -- heslo v otevřené podobě (omezení Heliosu)
        CONSTRAINT [PK_TabCisZam] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [UQ_TabCisZam_Cislo] UNIQUE ([Cislo])
    );
    PRINT 'TabCisZam zalozena';
END
GO

-- ============================================================================
-- TabCisZam_EXT - rozšíření se sloupci školení
-- Kódy a jejich počet odpovídají produkčnímu pohledu (03_create_inspirit_view.sql).
-- Doba platnosti se tu neukládá: počítá ji pohled z InspiritTraining.validityMonths.
-- ============================================================================
IF OBJECT_ID(N'dbo.TabCisZam_EXT', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TabCisZam_EXT] (
        [ID]           INT NOT NULL,
        [_DruhPozice]  NVARCHAR(60) NULL,
        CONSTRAINT [PK_TabCisZam_EXT] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [FK_TabCisZam_EXT_TabCisZam] FOREIGN KEY ([ID])
            REFERENCES [dbo].[TabCisZam]([ID]) ON DELETE CASCADE
    );
    PRINT 'TabCisZam_EXT zalozena';
END
GO

DECLARE @kody TABLE (kod NVARCHAR(100) NOT NULL PRIMARY KEY);
INSERT INTO @kody (kod) VALUES
    (N'CMM'), (N'EDM'), (N'EleZnaceni'), (N'ITBezpecnost'), (N'KnihaStroje'),
    (N'KontrPrijZboz'), (N'MerAVyhodOpotrebeni'), (N'Meridla'), (N'MonitorVyraCMTDilu'),
    (N'NakladaniLatkami'), (N'OpotrebeniNastrojuuCMT'), (N'PouzitiNatsroju'),
    (N'PozdavkyEN10204Dodak'), (N'PraceKonProdukt'), (N'Pruvodka'), (N'RazK1K'),
    (N'RegulacniKarty'), (N'Samokontrola'), (N'SeriovaCisla'), (N'SymbolyvBB'),
    (N'SystemmanagemenntuKvalityCilepodniku'), (N'TrideniOdpadu'),
    (N'UdrzbaStrojuPracovnikyDilny'), (N'VizualniKontrola'), (N'VrtaniKritDily'),
    (N'Vzorovani'), (N'ZkouskaTvrdosti'), (N'ZlomeniNastroje'), (N'Znaceni');

DECLARE @kod NVARCHAR(100), @sql NVARCHAR(MAX);
DECLARE kody_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT kod FROM @kody ORDER BY kod;
OPEN kody_cursor;
FETCH NEXT FROM kody_cursor INTO @kod;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.TabCisZam_EXT', N'_' + @kod + N'DatumPosl') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].[TabCisZam_EXT] ADD '
                 + QUOTENAME(N'_' + @kod + N'DatumPosl') + N' DATETIME2 NULL;';
        EXEC sys.sp_executesql @sql;
    END
    IF COL_LENGTH(N'dbo.TabCisZam_EXT', N'_' + @kod + N'Pozadovano') IS NULL
    BEGIN
        SET @sql = N'ALTER TABLE [dbo].[TabCisZam_EXT] ADD '
                 + QUOTENAME(N'_' + @kod + N'Pozadovano') + N' BIT NULL;';
        EXEC sys.sp_executesql @sql;
    END
    FETCH NEXT FROM kody_cursor INTO @kod;
END
CLOSE kody_cursor;
DEALLOCATE kody_cursor;
PRINT 'TabCisZam_EXT: sloupce skoleni overeny';
GO

-- ============================================================================
-- TabMzdObd - mzdová období
-- ============================================================================
IF OBJECT_ID(N'dbo.TabMzdObd', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TabMzdObd] (
        [ID]       INT IDENTITY(1,1) NOT NULL,
        [IdObdobi] AS ([ID]),                 -- pohled se na období ptá oběma jmény
        [Rok]      INT NOT NULL,
        [Mesic]    INT NOT NULL,
        [Stav]     TINYINT NOT NULL CONSTRAINT [DF_TabMzdObd_Stav] DEFAULT (0),  -- 1 = aktuální období
        CONSTRAINT [PK_TabMzdObd] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [UQ_TabMzdObd_RokMesic] UNIQUE ([Rok], [Mesic])
    );
    -- Pohled čte aktuální období skalárním poddotazem, smí tedy existovat jen jedno.
    CREATE UNIQUE INDEX [UX_TabMzdObd_Aktualni] ON [dbo].[TabMzdObd]([Stav]) WHERE [Stav] = 1;
    PRINT 'TabMzdObd zalozena';
END
GO

-- ============================================================================
-- TabZamMzd - mzdový záznam zaměstnance v období
--   StavES: 0 = v evidenčním stavu (pohled zobrazí), jiná hodnota = mimo stav
--   DruhPP: 0, 1 = pracovní poměry, které pohled zobrazuje
-- ============================================================================
IF OBJECT_ID(N'dbo.TabZamMzd', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TabZamMzd] (
        [ID]            INT IDENTITY(1,1) NOT NULL,
        [ZamestnanecId] INT NOT NULL,
        [IdObdobi]      INT NOT NULL,
        [StavES]        TINYINT NOT NULL CONSTRAINT [DF_TabZamMzd_StavES] DEFAULT (0),
        [DruhPP]        TINYINT NOT NULL CONSTRAINT [DF_TabZamMzd_DruhPP] DEFAULT (0),
        CONSTRAINT [PK_TabZamMzd] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [UQ_TabZamMzd_ZamObdobi] UNIQUE ([ZamestnanecId], [IdObdobi]),
        CONSTRAINT [FK_TabZamMzd_TabCisZam] FOREIGN KEY ([ZamestnanecId])
            REFERENCES [dbo].[TabCisZam]([ID]) ON DELETE CASCADE,
        CONSTRAINT [FK_TabZamMzd_TabMzdObd] FOREIGN KEY ([IdObdobi])
            REFERENCES [dbo].[TabMzdObd]([ID])
    );
    PRINT 'TabZamMzd zalozena';
END
GO

-- ============================================================================
-- TabMzNastupPP - nástupy do pracovního poměru
-- ============================================================================
IF OBJECT_ID(N'dbo.TabMzNastupPP', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TabMzNastupPP] (
        [ID]            INT IDENTITY(1,1) NOT NULL,
        [ZamestnanecId] INT NOT NULL,
        [DatumNastupu]  DATE NULL,
        CONSTRAINT [PK_TabMzNastupPP] PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT [FK_TabMzNastupPP_TabCisZam] FOREIGN KEY ([ZamestnanecId])
            REFERENCES [dbo].[TabCisZam]([ID]) ON DELETE CASCADE
    );
    PRINT 'TabMzNastupPP zalozena';
END
GO

SET NOEXEC OFF;
GO

PRINT 'Simulace Heliosu pripravena';
GO
