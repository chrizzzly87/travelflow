import { LEGAL_PROFILE } from './legalProfile';

export const LEGAL_TERMS_BINDING_LOCALE = 'de';

export const LEGAL_TERMS_FALLBACK_TITLE = 'Terms of Service / AGB';

export const LEGAL_TERMS_FALLBACK_SUMMARY =
  'Initial production-ready Terms of Service for B2C/B2B launch with Merchant-of-Record billing model.';

export const LEGAL_TERMS_FALLBACK_VERSION = LEGAL_PROFILE.reviewDates.termsVersion;
export const LEGAL_TERMS_FALLBACK_LAST_UPDATED = LEGAL_PROFILE.reviewDates.termsLastUpdated;

export const LEGAL_TERMS_FALLBACK_CONTENT_DE = `## 1. Geltungsbereich
Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für sämtliche Verträge zwischen Ihnen und dem Betreiber von {appName} in der zum Zeitpunkt des Vertragsschlusses gültigen Fassung.

Abweichende Bedingungen des Nutzers werden nicht Vertragsbestandteil, es sei denn, ihrer Geltung wurde ausdrücklich schriftlich zugestimmt.

## 2. Leistungen von {appName}
{appName} bietet eine digitale Plattform zur Reiseplanung und -organisation. Der konkrete Leistungsumfang ergibt sich aus den jeweils zum Buchungs- oder Nutzungszeitpunkt angezeigten Produktinformationen.

Kostenlose und kostenpflichtige Funktionsumfänge können bestehen. Es besteht kein Anspruch auf bestimmte Funktionen, soweit diese nicht ausdrücklich als Vertragsbestandteil zugesagt wurden.

## 3. Vertragsschluss und Nutzerkonto
Der Vertrag über die Nutzung Ihres Kontos kommt mit erfolgreicher Registrierung bzw. Freischaltung zustande. Sie sind verpflichtet, bei der Registrierung zutreffende und vollständige Angaben zu machen.

Zugangsdaten sind geheim zu halten und dürfen nicht an Dritte weitergegeben werden. Sie haften für missbräuchliche Nutzung, soweit Sie diese zu vertreten haben.

## 4. Preise, Zahlung und Merchant-of-Record-Modell
Angezeigte Preise verstehen sich als Endpreise inklusive gesetzlich geschuldeter Steuern, soweit nicht anders gekennzeichnet. Bei kostenpflichtigen Plänen erfolgt die Zahlungsabwicklung über einen Merchant of Record (MoR).

Im MoR-Modell ist der jeweilige Zahlungsanbieter gegenüber dem Endkunden Verkäufer der digitalen Leistung für die Abrechnung und Rechnungsstellung. Der Nutzungsvertrag über die Plattformfunktionen besteht weiterhin mit dem Betreiber von {appName}.

Rechnungen, Zahlungsbelege, Erstattungen und steuerliche Ausweise werden nach den Bedingungen des jeweils eingesetzten Zahlungsanbieters erstellt und bereitgestellt.

## 5. Laufzeit, Kündigung und Beendigung
Soweit ein laufendes Abonnement besteht, verlängert es sich entsprechend den im Checkout angezeigten Bedingungen, sofern es nicht fristgerecht gekündigt wird.

Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Gesetzlich zwingende Rechte, insbesondere Verbraucherrechte, bleiben unberührt.

## 6. Verbraucherrechte und Widerruf
Verbrauchern stehen bei Fernabsatzverträgen gesetzliche Rechte, insbesondere Widerrufsrechte nach §§ 355 ff. BGB, zu, soweit diese nicht gesetzlich ausgeschlossen sind.

Informationen zu Voraussetzungen, Fristen, Ausnahmen und einem Muster-Widerrufsformular werden im Rahmen des Bestellprozesses auf einem dauerhaften Datenträger bereitgestellt.

## 7. Zulässige Nutzung
Die Plattform darf ausschließlich rechtmäßig genutzt werden. Unzulässig sind insbesondere missbräuchliche, betrügerische, rechtswidrige oder sicherheitsgefährdende Handlungen.

Bei Verstößen kann der Zugriff vorübergehend oder dauerhaft eingeschränkt werden, soweit dies erforderlich und verhältnismäßig ist.

## 8. Haftung
Es gilt die gesetzliche Haftung. Für leicht fahrlässige Pflichtverletzungen wird die Haftung auf vorhersehbare, vertragstypische Schäden begrenzt, soweit keine zwingenden gesetzlichen Vorschriften entgegenstehen.

Die Haftungsbeschränkungen gelten nicht bei Vorsatz, grober Fahrlässigkeit, Verletzung von Leben, Körper oder Gesundheit sowie bei zwingender Produkthaftung.

## 9. Änderungen dieser AGB
Änderungen dieser AGB werden nur unter Beachtung der gesetzlichen Vorgaben vorgenommen. Wesentliche Änderungen werden vor Inkrafttreten in geeigneter Form angekündigt.

Sofern eine erneute Zustimmung rechtlich erforderlich oder aus Compliance-Gründen vorgesehen ist, wird der weitere Zugriff auf geschützte Kontofunktionen von der Zustimmung zur jeweils aktuellen Fassung abhängig gemacht.

## 10. Anwendbares Recht und Streitbeilegung
Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts, soweit keine zwingenden Verbraucherschutzvorschriften entgegenstehen.

Informationen zur Teilnahme an Verbraucherstreitbeilegungsverfahren finden Sie im Impressum.
`;

export const LEGAL_TERMS_FALLBACK_CONTENT_EN = `## 1. Scope
These Terms apply to all agreements between you and the operator of {appName} at the time you enter into the contract.

## 2. Service
{appName} provides digital travel-planning functionality. Features can differ by plan and can evolve over time.

## 3. Account
You must provide accurate account data and keep credentials confidential.

## 4. Pricing, payment, and MoR model
Paid plans are processed through a Merchant of Record provider responsible for checkout and invoice issuance.

Your platform-use agreement remains with the operator of {appName}.

## 5. Term and cancellation
Subscription term, renewal, and cancellation conditions are shown during checkout. Mandatory consumer rights remain unaffected.

## 6. Consumer withdrawal rights
Consumers may have statutory withdrawal rights under German/EU distance-selling rules, including digital-content/service rules where applicable.

## 7. Acceptable use
Illegal, abusive, fraudulent, or security-threatening use is prohibited and can lead to restriction or termination.

## 8. Liability
Liability follows mandatory law. For minor negligence, liability is limited to foreseeable, typical contractual damages where legally permissible.

## 9. Terms updates
Material changes are announced before they take effect. If required, continued use of protected account features requires accepting the current version.

## 10. Governing law
German law applies, subject to mandatory consumer protections.
`;

export const injectAppNameIntoTermsContent = (value: string, appName: string): string => {
  const normalized = typeof value === 'string' ? value : '';
  if (!normalized) return normalized;
  return normalized.replace(/\{appName\}/g, appName);
};
