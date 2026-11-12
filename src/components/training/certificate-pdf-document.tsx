import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font
} from '@react-pdf/renderer';

// Registrace fontů pro české znaky
Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
      fontWeight: 400,
      fontStyle: 'normal'
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
      fontWeight: 700,
      fontStyle: 'normal'
    }
  ]
});

// Definice stylů
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Roboto',
    position: 'relative'
  },
  border: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    border: '3pt solid #2563eb',
    borderRadius: 8
  },
  innerBorder: {
    position: 'absolute',
    top: 26,
    left: 26,
    right: 26,
    bottom: 26,
    border: '1pt solid #93c5fd',
    borderRadius: 6
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  certificateTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1e3a8a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 2
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 5
  },
  mainSection: {
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 15
  },
  awardText: {
    fontSize: 11,
    color: '#475569',
    marginBottom: 10,
    textAlign: 'center'
  },
  userName: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
    borderBottom: '2pt solid #2563eb',
    paddingBottom: 8,
    paddingHorizontal: 40,
    alignSelf: 'center'
  },
  trainingName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#2563eb',
    marginTop: 12,
    marginBottom: 15,
    textAlign: 'center'
  },
  detailsSection: {
    marginTop: 20,
    width: '100%',
    maxWidth: 450
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1pt solid #e2e8f0'
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 700
  },
  detailValue: {
    fontSize: 11,
    color: '#1e293b'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    alignItems: 'center',
    paddingTop: 15,
    borderTop: '1pt solid #e2e8f0'
  },
  footerText: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center'
  },
  companyName: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 5,
    textAlign: 'center'
  }
});

interface CertificatePDFDocumentProps {
  certificate: {
    certificateNumber: string;
    issuedAt: string;
    validUntil: string;
  };
  user: {
    firstName: string;
    lastName: string;
    cislo: number;
  };
  training: {
    code: string;
    name: string;
  };
  testAttempt: {
    score: number;
    completedAt: string;
  };
}

export const CertificatePDFDocument: React.FC<CertificatePDFDocumentProps> = ({
  certificate,
  user,
  training,
  testAttempt
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="portrait">
        {/* Decorative borders */}
        <View style={styles.border} />
        <View style={styles.innerBorder} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.certificateTitle}>CERTIFIKÁT</Text>
            <Text style={styles.subtitle}>O absolvování školení</Text>
          </View>

          {/* Main content */}
          <View style={styles.mainSection}>
            <Text style={styles.awardText}>Tímto potvrzujeme, že</Text>

            <Text style={styles.userName}>
              {user.firstName} {user.lastName}
            </Text>

            <Text style={styles.awardText}>
              úspěšně absolvoval/a školení
            </Text>

            <Text style={styles.trainingName}>
              {training.name}
            </Text>

            <Text style={styles.awardText}>
              a splnil/a všechny požadavky na úspěšné dokončení
            </Text>
          </View>

          {/* Details */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Číslo certifikátu:</Text>
              <Text style={styles.detailValue}>{certificate.certificateNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Osobní číslo:</Text>
              <Text style={styles.detailValue}>{user.cislo}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kód školení:</Text>
              <Text style={styles.detailValue}>{training.code}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dosažené skóre:</Text>
              <Text style={styles.detailValue}>{testAttempt.score.toFixed(1)}%</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Datum absolvování:</Text>
              <Text style={styles.detailValue}>{formatDate(testAttempt.completedAt)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Datum vydání:</Text>
              <Text style={styles.detailValue}>{formatDate(certificate.issuedAt)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Platnost do:</Text>
              <Text style={styles.detailValue}>{formatDate(certificate.validUntil)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.companyName}>ATC Space</Text>
          <Text style={styles.footerText}>
            Tento certifikát je oficiálním dokladem o absolvování školení.
          </Text>
          <Text style={styles.footerText}>
            Generováno systémem ATC-LMS dne {formatDate(new Date().toISOString())}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
