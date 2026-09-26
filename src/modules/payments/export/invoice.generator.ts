import type PDFKitType from 'pdfkit';
import PDFDocument from 'pdfkit';
import type { Payment } from '../payment.entity';

export interface InvoiceData {
  payment: Payment;
  invoiceNumber: string;
  generatedAt: Date;
  branding?: {
    displayName: string;
    logo: string | null;
    primaryColor: string;
    supportEmail: string | null;
    supportUrl: string | null;
  };
}

// Default FacilPay branding
const DEFAULT_BRANDING = {
  displayName: 'FacilPay',
  logo: null,
  primaryColor: '#1a1a2e',
  supportEmail: 'support@facilpay.com',
  supportUrl: 'https://facilpay.com',
};

/**
 * Draws a horizontal rule line at the current y position.
 */
function drawHRule(doc: PDFKitType.PDFDocument, y: number): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc
    .moveTo(left, y)
    .lineTo(right, y)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()
    .strokeColor('#000000')
    .lineWidth(1);
}

/**
 * Renders a labelled row: label on the left, value on the right.
 */
function labelRow(
  doc: PDFKitType.PDFDocument,
  label: string,
  value: string,
  y: number,
): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const midpoint = left + (right - left) * 0.45;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#555555')
    .text(label, left, y, { width: midpoint - left });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#111111')
    .text(value, midpoint, y, { width: right - midpoint, align: 'right' });
}

/**
 * Generates a professional invoice PDF document for a completed payment.
 * Returns a PDFDocument that can be piped to a response stream.
 */
export function generateInvoicePdf(data: InvoiceData): PDFKitType.PDFDocument {
  const { payment, invoiceNumber, generatedAt, branding } = data;
  const brand = { ...DEFAULT_BRANDING, ...branding };
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const contentWidth = pageRight - pageLeft;

  /* ──────────────────────────────────────────
     HEADER — Brand + Invoice title
  ────────────────────────────────────────── */
  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor(brand.primaryColor)
    .text(brand.displayName, pageLeft, 50);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#666666')
    .text('Payment Invoice', pageLeft, 80);

  // Invoice number block (top-right)
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1a1a2e')
    .text('INVOICE', pageRight - 160, 50, { width: 160, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#333333')
    .text(`#${invoiceNumber}`, pageRight - 160, 65, {
      width: 160,
      align: 'right',
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#666666')
    .text(`Generated: ${generatedAt.toUTCString()}`, pageRight - 160, 80, {
      width: 160,
      align: 'right',
    });

  drawHRule(doc, 105);

  /* ──────────────────────────────────────────
     TRANSACTION DETAILS SECTION
  ────────────────────────────────────────── */
  let y = 120;

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1a1a2e')
    .text('Transaction Details', pageLeft, y);

  y += 20;
  drawHRule(doc, y);
  y += 12;

  const rows: Array<[string, string]> = [
    ['Transaction ID', payment.id],
    ['Status', payment.status],
    ['Date', (payment.createdAt as Date).toUTCString()],
    [
      'Amount',
      `${Number(payment.amount).toFixed(2)} ${payment.currency}`,
    ],
  ];

  if (payment.description) {
    rows.push(['Description', payment.description]);
  }

  if (payment.externalReference) {
    rows.push(['Reference', payment.externalReference]);
  }

  for (const [label, value] of rows) {
    labelRow(doc, label, value, y);
    y += 20;
  }

  y += 4;
  drawHRule(doc, y);
  y += 20;

  /* ──────────────────────────────────────────
     MERCHANT DETAILS SECTION
  ────────────────────────────────────────── */
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1a1a2e')
    .text('Merchant Details', pageLeft, y);

  y += 20;
  drawHRule(doc, y);
  y += 12;

  if (payment.merchantId) {
    labelRow(doc, 'Merchant ID', payment.merchantId, y);
    y += 20;
  }

  if (payment.merchantEmail) {
    labelRow(doc, 'Merchant Email', payment.merchantEmail, y);
    y += 20;
  }

  if (!payment.merchantId && !payment.merchantEmail) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#999999')
      .text('No merchant details available.', pageLeft, y);
    y += 20;
  }

  y += 4;
  drawHRule(doc, y);
  y += 20;

  /* ──────────────────────────────────────────
     PAYER DETAILS SECTION
  ────────────────────────────────────────── */
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1a1a2e')
    .text('Payer Details', pageLeft, y);

  y += 20;
  drawHRule(doc, y);
  y += 12;

  if (payment.payerEmail) {
    labelRow(doc, 'Payer Email', payment.payerEmail, y);
    y += 20;
  } else {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#999999')
      .text('No payer details available.', pageLeft, y);
    y += 20;
  }

  y += 4;
  drawHRule(doc, y);
  y += 20;

  /* ──────────────────────────────────────────
     AMOUNT SUMMARY BOX
  ────────────────────────────────────────── */
  const boxX = pageRight - 200;
  const boxWidth = 200;
  const boxPadding = 10;
  const boxY = y;

  doc
    .rect(boxX, boxY, boxWidth, 80)
    .fillColor('#f5f5f5')
    .fill()
    .fillColor('#111111');

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#1a1a2e')
    .text('Payment Summary', boxX + boxPadding, boxY + boxPadding, {
      width: boxWidth - boxPadding * 2,
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#555555')
    .text(
      `Amount: ${Number(payment.amount).toFixed(2)} ${payment.currency}`,
      boxX + boxPadding,
      boxY + 28,
      { width: boxWidth - boxPadding * 2 },
    );

  if (Number(payment.feeAmount) > 0) {
    doc.text(
      `Fee: ${Number(payment.feeAmount).toFixed(2)} ${payment.currency}`,
      boxX + boxPadding,
      boxY + 44,
      { width: boxWidth - boxPadding * 2 },
    );

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#1a1a2e')
      .text(
        `Net: ${Number(payment.netAmount).toFixed(2)} ${payment.currency}`,
        boxX + boxPadding,
        boxY + 58,
        { width: boxWidth - boxPadding * 2 },
      );
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#1a1a2e')
      .text(
        `Total: ${Number(payment.amount).toFixed(2)} ${payment.currency}`,
        boxX + boxPadding,
        boxY + 44,
        { width: boxWidth - boxPadding * 2 },
      );
  }

  y += 100;

  /* ──────────────────────────────────────────
     FOOTER
  ────────────────────────────────────────── */
  const footerY = doc.page.height - doc.page.margins.bottom - 40;
  drawHRule(doc, footerY);

  const footerText = brand.supportUrl 
    ? `This is an automatically generated invoice. ${brand.displayName} — ${brand.supportUrl}`
    : `This is an automatically generated invoice. ${brand.displayName}`;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#aaaaaa')
    .text(
      footerText,
      pageLeft,
      footerY + 10,
      { width: contentWidth, align: 'center' },
    );

  doc.end();
  return doc;
}
