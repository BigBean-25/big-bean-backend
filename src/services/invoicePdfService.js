const PDFDocument = require('pdfkit');

const BRAND = {
  name: 'Big Bean Café Coffee Roasters',
  tagline: 'Premium Coffee Experience',
  website: 'www.bigbeancafe.in',
  email: 'info@bigbeancafe.in',
  phone: '+91 98765 43210',
  address: 'Bengaluru, Karnataka, India',
  primary: '#3D1F0D',
  accent: '#C9943A',
};

const PAD = { left: 50, right: 50, top: 50 };
const PAGE_W = 595;
const CONTENT_W = PAGE_W - PAD.left - PAD.right;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtCurrency(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate invoice PDF and pipe to response stream.
 * @param {object} order  - order row with items array
 * @param {object} res    - express response
 */
function generateInvoicePdf(order, res) {
  const isPaid = (order.payment_status || '').toLowerCase() === 'paid';
  const docTitle = isPaid ? 'Payment Receipt' : 'Tax Invoice / Order Invoice';
  const invoiceNo = order.order_number || `INV-${order.id}`;
  const filename = `BigBean-Invoice-${invoiceNo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: docTitle, Author: BRAND.name } });
  doc.pipe(res);

  const [pr, pg, pb] = hexToRgb(BRAND.primary);
  const [ar, ag, ab] = hexToRgb(BRAND.accent);

  // ── Header band ──────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 110).fill([pr, pg, pb]);
  doc.fillColor([ar, ag, ab]).font('Helvetica-Bold').fontSize(18)
    .text(BRAND.name, PAD.left, 28, { width: CONTENT_W });
  doc.fillColor('#FFF7ED').font('Helvetica').fontSize(9)
    .text(BRAND.tagline, PAD.left, 50, { width: CONTENT_W });
  doc.fillColor('#E6C7A8').fontSize(8)
    .text(`${BRAND.website}  |  ${BRAND.email}  |  ${BRAND.phone}`, PAD.left, 63, { width: CONTENT_W });

  // ── Document type badge ───────────────────────────────────────────────────
  doc.fillColor([ar, ag, ab]).roundedRect(PAD.left, 78, 160, 22, 4).fill();
  doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(10)
    .text(docTitle.toUpperCase(), PAD.left + 8, 83, { width: 150 });

  let y = 125;

  // ── Invoice / Order meta ──────────────────────────────────────────────────
  const metaLeft = PAD.left;
  const metaRight = PAGE_W - PAD.right - 180;

  doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(11)
    .text('Invoice No:', metaLeft, y).font('Helvetica').text(invoiceNo, metaLeft + 85, y);
  doc.font('Helvetica-Bold').text('Order No:', metaLeft, y + 17).font('Helvetica')
    .text(order.order_number || '—', metaLeft + 85, y + 17);
  doc.font('Helvetica-Bold').text('Date:', metaLeft, y + 34).font('Helvetica')
    .text(fmtDate(order.created_at), metaLeft + 85, y + 34);
  doc.font('Helvetica-Bold').text('Order Status:', metaLeft, y + 51).font('Helvetica')
    .text((order.order_status || 'received').toUpperCase(), metaLeft + 85, y + 51);

  // Right side — customer
  doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(11)
    .text('Bill To:', metaRight, y);
  doc.font('Helvetica').fontSize(10)
    .text(order.customer_name || '—', metaRight, y + 17)
    .text(order.customer_phone || '', metaRight, y + 30)
    .text(order.customer_email || '', metaRight, y + 43);
  if (order.address) {
    doc.text(order.address, metaRight, y + 56, { width: 180 });
  }

  y += 90;

  // ── Payment info ──────────────────────────────────────────────────────────
  doc.rect(PAD.left, y, CONTENT_W, 28).fillAndStroke('#FFF7ED', '#E6C7A8');
  doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(9)
    .text('Payment Method:', PAD.left + 8, y + 9)
    .font('Helvetica').text((order.payment_method || 'COD').toUpperCase(), PAD.left + 110, y + 9);
  doc.font('Helvetica-Bold').text('Payment Status:', PAD.left + 220, y + 9)
    .font('Helvetica').text((order.payment_status || 'pending').toUpperCase(), PAD.left + 320, y + 9);
  if (order.payment_id) {
    doc.font('Helvetica-Bold').text('Txn ID:', PAD.left + 380, y + 9)
      .font('Helvetica').text(order.payment_id, PAD.left + 420, y + 9, { width: 80 });
  }

  y += 40;

  // ── Items table header ────────────────────────────────────────────────────
  const colX = [PAD.left, PAD.left + 28, PAD.left + 240, PAD.left + 290, PAD.left + 360, PAD.left + 420];
  doc.rect(PAD.left, y, CONTENT_W, 22).fill([pr, pg, pb]);
  doc.fillColor('#FFF7ED').font('Helvetica-Bold').fontSize(9);
  doc.text('#',          colX[0] + 4, y + 7);
  doc.text('Item Name',  colX[1],     y + 7, { width: 200 });
  doc.text('Qty',        colX[2],     y + 7, { width: 40,  align: 'center' });
  doc.text('Unit Price', colX[3],     y + 7, { width: 70,  align: 'right' });
  doc.text('Total',      colX[4],     y + 7, { width: 70,  align: 'right' });

  y += 24;

  // ── Items rows ────────────────────────────────────────────────────────────
  const items = order.items || [];
  items.forEach((item, i) => {
    const rowBg = i % 2 === 0 ? '#FFFDF9' : '#FFFFFF';
    const rowH = 22;
    doc.rect(PAD.left, y, CONTENT_W, rowH).fill(rowBg).stroke('#F0E0CC');
    doc.fillColor([pr, pg, pb]).font('Helvetica').fontSize(9);
    doc.text(String(i + 1),                       colX[0] + 4, y + 7);
    doc.text(item.product_name || '—',             colX[1],     y + 7, { width: 200 });
    doc.text(String(item.quantity || 1),           colX[2],     y + 7, { width: 40,  align: 'center' });
    doc.text(fmtCurrency(item.price),              colX[3],     y + 7, { width: 70,  align: 'right' });
    const total = item.total || (item.price * item.quantity);
    doc.text(fmtCurrency(total),                   colX[4],     y + 7, { width: 70,  align: 'right' });
    y += rowH;
  });

  y += 10;

  // ── Summary ───────────────────────────────────────────────────────────────
  const sumX = PAGE_W - PAD.right - 200;
  const sumW = 200;

  const drawSummaryRow = (label, value, bold = false, highlight = false) => {
    if (highlight) {
      doc.rect(sumX - 8, y - 3, sumW + 8, 24).fill([pr, pg, pb]);
      doc.fillColor([ar, ag, ab]).font('Helvetica-Bold').fontSize(11);
    } else {
      doc.fillColor([pr, pg, pb]).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    }
    doc.text(label, sumX, y, { width: 100 });
    doc.text(value, sumX + 100, y, { width: 100, align: 'right' });
    y += highlight ? 26 : 18;
  };

  drawSummaryRow('Subtotal', fmtCurrency(order.subtotal || order.total_amount));
  const dc = Number(order.delivery_charge || 0);
  drawSummaryRow('Delivery Charge', dc > 0 ? fmtCurrency(dc) : 'Free');
  drawSummaryRow('Grand Total', fmtCurrency(order.total_amount), true, true);

  y += 20;

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = 760;
  doc.rect(0, footerY, PAGE_W, 82).fill([pr, pg, pb]);
  doc.fillColor([ar, ag, ab]).font('Helvetica-Bold').fontSize(10)
    .text('Thank you for ordering from Big Bean Café!', PAD.left, footerY + 14, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#E6C7A8').font('Helvetica').fontSize(8)
    .text(`${BRAND.website}  |  ${BRAND.email}`, PAD.left, footerY + 32, { width: CONTENT_W, align: 'center' });
  doc.fillColor('#C0A080').fontSize(7)
    .text(`Generated on ${new Date().toLocaleString('en-IN')} · This is a computer-generated document.`, PAD.left, footerY + 50, { width: CONTENT_W, align: 'center' });

  doc.end();
}

module.exports = { generateInvoicePdf };
