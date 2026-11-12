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
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu52xP.ttf',
      fontWeight: 400,
      fontStyle: 'italic'
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
      fontWeight: 700,
      fontStyle: 'normal'
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOjCnqEu92Fr1Mu51TzBic-CsTKlA.ttf',
      fontWeight: 700,
      fontStyle: 'italic'
    }
  ]
});

// Definice stylů
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Roboto'
  },
  header: {
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 10,
    color: '#1a1a1a'
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 5
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 10,
    color: '#2563eb'
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 15,
    marginBottom: 8,
    color: '#333333'
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#444444',
    marginBottom: 8
  },
  listItem: {
    fontSize: 11,
    marginBottom: 4,
    marginLeft: 15,
    color: '#444444'
  },
  badge: {
    backgroundColor: '#f3f4f6',
    padding: '4 8',
    borderRadius: 4,
    marginRight: 5,
    marginBottom: 5
  },
  badgeText: {
    fontSize: 10,
    color: '#666666'
  },
  card: {
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 5,
    color: '#333333'
  },
  parameter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: '#f9fafb',
    marginBottom: 3,
    borderRadius: 2
  },
  parameterKey: {
    fontSize: 10,
    fontWeight: 700,
    color: '#333333'
  },
  parameterValue: {
    fontSize: 10,
    color: '#666666'
  },
  warningBox: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10
  },
  dangerBox: {
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10
  },
  infoBox: {
    backgroundColor: '#dbeafe',
    border: '1px solid #3b82f6',
    borderRadius: 4,
    padding: 10,
    marginBottom: 10
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#999999',
    textAlign: 'center'
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 10,
    color: '#666666'
  },
  flexRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  }
});

interface TrainingPDFDocumentProps {
  training: {
    name: string;
    description?: string | null;
    content?: any;
  };
  generatedDate?: Date;
}

/**
 * Render Tiptap/ProseMirror JSON content to React-PDF elements
 * Handles: paragraphs, headings, lists, bold, italic, links, etc.
 */
function renderTiptapContent(content: any): React.ReactNode[] {
  if (!content || !content.content) return [];

  return content.content.map((node: any, index: number) => {
    switch (node.type) {
      case 'paragraph':
        return (
          <Text key={index} style={styles.text}>
            {renderInlineContent(node.content)}
          </Text>
        );
      case 'heading':
        const level = node.attrs?.level || 1;
        const headingStyle =
          level === 1
            ? styles.sectionTitle
            : level === 2
              ? styles.subsectionTitle
              : styles.cardTitle;
        return (
          <Text key={index} style={headingStyle}>
            {renderInlineContent(node.content)}
          </Text>
        );
      case 'bulletList':
        return (
          <View key={index} style={{ marginBottom: 10 }}>
            {node.content?.map((item: any, i: number) => (
              <Text key={i} style={styles.listItem}>
                • {renderInlineContent(item.content?.[0]?.content)}
              </Text>
            ))}
          </View>
        );
      case 'orderedList':
        return (
          <View key={index} style={{ marginBottom: 10 }}>
            {node.content?.map((item: any, i: number) => (
              <Text key={i} style={styles.listItem}>
                {i + 1}. {renderInlineContent(item.content?.[0]?.content)}
              </Text>
            ))}
          </View>
        );
      case 'blockquote':
        return (
          <View key={index} style={styles.infoBox}>
            {node.content?.map((p: any, i: number) => (
              <Text key={i} style={styles.text}>
                {renderInlineContent(p.content)}
              </Text>
            ))}
          </View>
        );
      case 'codeBlock':
        return (
          <View key={index} style={styles.card}>
            <Text style={{ ...styles.text, fontFamily: 'Courier' }}>
              {node.content?.map((t: any) => t.text).join('') || ''}
            </Text>
          </View>
        );
      case 'horizontalRule':
        return (
          <View
            key={index}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
              marginVertical: 15
            }}
          />
        );
      case 'table':
        return renderTable(node, index);
      default:
        // Handle any unknown types as plain text
        if (node.content) {
          return (
            <Text key={index} style={styles.text}>
              {renderInlineContent(node.content)}
            </Text>
          );
        }
        return null;
    }
  });
}

/**
 * Render inline content (text with marks like bold, italic, etc.)
 */
function renderInlineContent(content: any[] | undefined): string {
  if (!content) return '';
  return content
    .map((node: any) => {
      if (node.type === 'text') {
        return node.text || '';
      }
      if (node.type === 'hardBreak') {
        return '\n';
      }
      return '';
    })
    .join('');
}

/**
 * Render table from Tiptap JSON
 */
function renderTable(node: any, index: number): React.ReactNode {
  if (!node.content) return null;

  return (
    <View key={index} style={{ marginBottom: 15 }}>
      {node.content.map((row: any, rowIndex: number) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb'
          }}
        >
          {row.content?.map((cell: any, cellIndex: number) => (
            <View
              key={cellIndex}
              style={{
                flex: 1,
                padding: 5,
                backgroundColor:
                  cell.type === 'tableHeader' ? '#f3f4f6' : 'transparent'
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: cell.type === 'tableHeader' ? 700 : 400
                }}
              >
                {cell.content
                  ?.map((p: any) => renderInlineContent(p.content))
                  .join('\n') || ''}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function TrainingPDFDocument({
  training,
  generatedDate = new Date()
}: TrainingPDFDocumentProps) {
  /**
   * Render content based on its format:
   * 1. Legacy format: { sections: [...] }
   * 2. Tiptap JSON: { type: "doc", content: [...] }
   * 3. Plain string (fallback)
   */
  const renderContent = (content: any) => {
    if (!content) return null;

    // Tiptap JSON format (from editor)
    if (content.type === 'doc' && content.content) {
      return renderTiptapContent(content);
    }

    // Legacy sections format
    if (content.sections) {
      return renderLegacySections(content);
    }

    // Plain text fallback
    if (typeof content === 'string') {
      return <Text style={styles.text}>{content}</Text>;
    }

    return null;
  };

  /**
   * Render legacy sections format (backwards compatibility)
   */
  const renderLegacySections = (content: any) => {
    if (!content.sections) return null;

    return content.sections.map((section: any, sectionIndex: number) => {
      const sectionContent = section.content;
      if (!sectionContent) return null;

      return (
        <View key={sectionIndex} style={{ marginBottom: 20 }}>
          {/* Section Title */}
          {section.title && (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}

          {/* Introduction */}
          {sectionContent.introduction && (
            <Text style={styles.text}>{sectionContent.introduction}</Text>
          )}

          {/* Key Points */}
          {sectionContent.keyPoints && (
            <View style={styles.infoBox}>
              <Text style={styles.subsectionTitle}>Klíčové body</Text>
              {sectionContent.keyPoints.map((point: string, i: number) => (
                <Text key={i} style={styles.listItem}>
                  • {point}
                </Text>
              ))}
            </View>
          )}

          {/* Rules */}
          {sectionContent.rules &&
            sectionContent.rules.map((rule: any, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {rule.number}. {rule.title}
                </Text>
                <Text style={styles.text}>{rule.description}</Text>

                {rule.checklist && (
                  <View style={{ marginTop: 5 }}>
                    {rule.checklist.map((item: string, j: number) => (
                      <Text key={j} style={styles.listItem}>
                        ✓ {item}
                      </Text>
                    ))}
                  </View>
                )}

                {rule.parameters && (
                  <View style={{ marginTop: 5 }}>
                    {Object.entries(rule.parameters).map(([key, value]) => (
                      <View key={key} style={styles.parameter}>
                        <Text style={styles.parameterKey}>{key}:</Text>
                        <Text style={styles.parameterValue}>
                          {value as string}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

          {/* Standards */}
          {sectionContent.standards && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.subsectionTitle}>Standardy</Text>
              <View style={styles.flexRow}>
                {sectionContent.standards.map((standard: string, i: number) => (
                  <View key={i} style={styles.badge}>
                    <Text style={styles.badgeText}>{standard}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tolerances */}
          {sectionContent.tolerances && (
            <View style={styles.card}>
              <Text style={styles.subsectionTitle}>Tolerance</Text>
              {Object.entries(sectionContent.tolerances).map(([key, value]) => (
                <View key={key} style={styles.parameter}>
                  <Text style={styles.parameterKey}>{key}:</Text>
                  <Text style={styles.parameterValue}>{value as string}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Defects */}
          {sectionContent.defects && (
            <View style={styles.dangerBox}>
              <Text style={styles.subsectionTitle}>Možné vady</Text>
              <View style={styles.flexRow}>
                {sectionContent.defects.map((defect: string, i: number) => (
                  <View key={i} style={styles.badge}>
                    <Text style={styles.badgeText}>{defect}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Documents */}
          {sectionContent.documents &&
            sectionContent.documents.map((doc: any, i: number) => (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>{doc.name}</Text>
                <Text style={styles.text}>{doc.purpose}</Text>
                {doc.frequency && (
                  <Text
                    style={{ ...styles.text, fontSize: 10, color: '#666666' }}
                  >
                    Frekvence: {doc.frequency}
                  </Text>
                )}
                {doc.fields && (
                  <View style={styles.flexRow}>
                    {doc.fields.map((field: string, j: number) => (
                      <View key={j} style={styles.badge}>
                        <Text style={styles.badgeText}>{field}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

          {/* PPE */}
          {sectionContent.ppe && (
            <View style={styles.infoBox}>
              <Text style={styles.subsectionTitle}>
                Osobní ochranné pomůcky
              </Text>
              {sectionContent.ppe.map((item: string, i: number) => (
                <Text key={i} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </View>
          )}

          {/* Hazards */}
          {sectionContent.hazards && (
            <View style={styles.warningBox}>
              <Text style={styles.subsectionTitle}>Nebezpečí</Text>
              {sectionContent.hazards.map((hazard: string, i: number) => (
                <Text key={i} style={styles.listItem}>
                  ⚠ {hazard}
                </Text>
              ))}
            </View>
          )}

          {/* Emergency */}
          {sectionContent.emergency && (
            <View style={styles.dangerBox}>
              <Text style={styles.subsectionTitle}>Tísňové kontakty</Text>
              {Object.entries(sectionContent.emergency).map(([key, value]) => (
                <View key={key} style={styles.parameter}>
                  <Text style={styles.parameterKey}>{key}:</Text>
                  <Text style={{ ...styles.parameterValue, fontWeight: 700 }}>
                    {value as string}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <Document>
      <Page size='A4' style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{training.name}</Text>
          {training.description && (
            <Text style={styles.subtitle}>{training.description}</Text>
          )}
          <Text style={styles.subtitle}>
            Vygenerováno: {generatedDate.toLocaleDateString('cs-CZ')}
          </Text>
        </View>

        {/* Content */}
        {renderContent(training.content)}

        {/* Footer */}
        <Text style={styles.footer}>
          © {new Date().getFullYear()} ATC-LMS - Systém školení zaměstnanců
        </Text>

        {/* Page Numbers */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
