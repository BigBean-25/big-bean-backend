const { executeQuery } = require('../config/database');
const { buildMerchandiseOrderReportWhere } = require('./merchandiseOrderController');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const BRAND = {
  name: 'Big Bean Café Coffee Roasters',
  primary: '#3D1F0D',
  accent: '#C9943A',
};

const REPORT_COLUMNS = [
  mo => mo.order_number || '—',
  mo => mo.customer_name || '—',
  mo => mo.customer_phone || '—',
  mo => `₹${Number(mo.total_amount || 0).toLocaleString('en-IN')}`,
  mo => (mo.payment_method || 'COD').toUpperCase(),
  mo => resolvePaymentStatus(mo),
  mo => (mo.order_status || 'received').toUpperCase(),
  mo => resolveRazorpayId(mo),
  mo => formatDateTime(mo.created_at)
];

function resolvePaymentStatus(order) {
  if (order.payment_status) return order.payment_status.toUpperCase();
  return (order.payment_method || '').toLowerCase().includes('online') ? 'PENDING' : 'COD PENDING';
}

function resolveRazorpayId(order) {
  if (order.payment_order_id) return order.payment_order_id;
  if (order.payment_id) return order.payment_id;
  if ((order.payment_method || '').toLowerCase().includes('online') && (!order.payment_status || order.payment_status === 'pending')) return 'Not Created';
  return '—';
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function parseSummary(raw) {
  return {
    total_orders: Number(raw.total_orders || 0),
    total_sales: parseFloat(raw.total_sales || 0),
    paid_amount: parseFloat(raw.paid_amount || 0),
    cod_amount: parseFloat(raw.cod_amount || 0),
    online_amount: parseFloat(raw.online_amount || 0),
    pending_amount: parseFloat(raw.pending_amount || 0),
    failed_amount: parseFloat(raw.failed_amount || 0),
    delivered_orders: Number(raw.delivered_orders || 0),
    payment_failed_orders: Number(raw.payment_failed_orders || 0),
  };
}

function getWeekBounds(anchor = new Date()) {
  const d = new Date(anchor);
  const day = d.getDay() || 7;
  const monday = new Date(d); monday.setDate(d.getDate() - day + 1); monday.setHours(0,0,0,0);
  const sunday = new Date(d); sunday.setDate(d.getDate() - day + 7); sunday.setHours(0,0,0,0);
  return [monday, sunday];
}

function getMonthBounds(anchor = new Date()) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return [first, last];
}

function getReportDateRange(query) {
  const dft = (query.date_filter_type || '').toString().toLowerCase();
  const now = new Date();
  switch (dft) {
    case 'today': return { from: formatDate(now), to: formatDate(now) };
    case 'yesterday': { const y = new Date(); y.setDate(now.getDate() - 1); return { from: formatDate(y), to: formatDate(y) }; }
    case 'this_week': { const [m, s] = getWeekBounds(now); return { from: formatDate(m), to: formatDate(s) }; }
    case 'last_week': { const a = new Date(); a.setDate(now.getDate() - 7); const [m, s] = getWeekBounds(a); return { from: formatDate(m), to: formatDate(s) }; }
    case 'this_month': { const [f, l] = getMonthBounds(now); return { from: formatDate(f), to: formatDate(l) }; }
    case 'last_month': { const a = new Date(now.getFullYear(), now.getMonth() - 1, 1); const [f, l] = getMonthBounds(a); return { from: formatDate(f), to: formatDate(l) }; }
    case 'custom_range': return { from: query.from_date || '—', to: query.to_date || '—' };
    case 'month_to_month': return { from: query.from_month || '—', to: query.to_month || '—' };
    case 'week_wise': return { from: query.week_start || '—', to: query.week_end || '—' };
    case 'date_wise': return { from: query.exact_date || '—', to: query.exact_date || '—' };
    default: return { from: '—', to: '—' };
  }
}

function getReportTypeLabel(query) {
  const dft = (query.date_filter_type || '').toString().toLowerCase();
  const map = {
    today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', last_week: 'Last Week',
    this_month: 'This Month', last_month: 'Last Month', custom_range: 'Custom Date Range',
    month_to_month: 'Month to Month', week_wise: 'Week Wise', date_wise: 'Date Wise'
  };
  return map[dft] || 'All Orders';
}

async function getReportData(query, admin) {
  const { where, params, errors } = await buildMerchandiseOrderReportWhere(query, admin);
  if (errors && errors.length) return { error: errors.join(', ') };

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : 'WHERE 1=1';

  const dataSql = `SELECT
    mo.id, mo.order_number, mo.customer_name, mo.customer_phone, mo.customer_email,
    mo.total_amount, mo.payment_method, mo.payment_status, mo.payment_order_id, mo.payment_id,
    mo.order_status, mo.created_at, mo.updated_at, mo.paid_at
  FROM merchandise_orders mo
  ${whereClause}
  ORDER BY mo.created_at DESC`;

  const summarySql = `SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(mo.total_amount),0) AS total_sales,
    COALESCE(SUM(CASE WHEN mo.payment_status = 'paid' THEN mo.total_amount ELSE 0 END),0) AS paid_amount,
    COALESCE(SUM(CASE WHEN LOWER(mo.payment_method) = 'cod' THEN mo.total_amount ELSE 0 END),0) AS cod_amount,
    COALESCE(SUM(CASE WHEN LOWER(mo.payment_method) = 'online' THEN mo.total_amount ELSE 0 END),0) AS online_amount,
    COALESCE(SUM(CASE WHEN mo.payment_status IN ('pending','payment_initiated','cod_pending') THEN mo.total_amount ELSE 0 END),0) AS pending_amount,
    COALESCE(SUM(CASE WHEN mo.payment_status = 'failed' OR mo.order_status = 'payment_failed' THEN mo.total_amount ELSE 0 END),0) AS failed_amount,
    SUM(CASE WHEN mo.order_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
    SUM(CASE WHEN mo.order_status = 'payment_failed' THEN 1 ELSE 0 END) AS payment_failed_orders
  FROM merchandise_orders mo
  ${whereClause}`;

  const [data, summaryRows] = await Promise.all([
    executeQuery(dataSql, params),
    executeQuery(summarySql, params)
  ]);

  return { data, summary: parseSummary(summaryRows[0] || {}), whereClause };
}

const getMerchandiseOrdersReport = async (req, res) => {
  try {
    const result = await getReportData(req.query, req.admin);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, summary: result.summary, data: result.data });
  } catch (error) {
    console.error('Merchandise orders report error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

const getMerchandiseOrdersReportPdf = async (req, res) => {
  try {
    const result = await getReportData(req.query, req.admin);
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    const { data: orders, summary } = result;
    const adminName = req.admin?.name || 'Admin';
    const typeLabel = getReportTypeLabel(req.query);
    const range = getReportDateRange(req.query);
    const generatedAt = formatDateTime(new Date());
    const filename = `Merchandise_Orders_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, info: { Title: 'Merchandise Orders Report', Author: BRAND.name } });
    doc.pipe(res);

    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const [pr, pg, pb] = hex(BRAND.primary);
    const [ar, ag, ab] = hex(BRAND.accent);
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 40;
    const contentW = pageW - margin * 2;
    const colCount = 9;
    const colW = contentW / colCount;
    const headerX = margin;
    let y = 0;

    const drawHeader = () => {
      doc.rect(0, 0, pageW, 75).fill([pr, pg, pb]);
      doc.fillColor([ar, ag, ab]).font('Helvetica-Bold').fontSize(18).text(BRAND.name, margin, 20);
      doc.fillColor('#FFF7ED').font('Helvetica').fontSize(9).text('Big Bean Café - Merchandise Orders Report', margin, 42);
      doc.fillColor('#E6C7A8').fontSize(8).text(`Generated on ${generatedAt} by ${adminName}`, margin, 56);
    };

    const drawMeta = (startY) => {
      let y = startY;
      doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(10).text('Report Type:', margin, y);
      doc.font('Helvetica').text(typeLabel, margin + 85, y);
      doc.font('Helvetica-Bold').text('Range:', margin + 220, y);
      doc.font('Helvetica').text(`${range.from} — ${range.to}`, margin + 270, y);
      y += 18;
      return y;
    };

    const drawSummary = (startY) => {
      let y = startY;
      const cards = [
        ['Total Orders', summary.total_orders],
        ['Total Sales', formatCurrency(summary.total_sales)],
        ['Paid', formatCurrency(summary.paid_amount)],
        ['COD', formatCurrency(summary.cod_amount)],
        ['Online', formatCurrency(summary.online_amount)],
        ['Pending', formatCurrency(summary.pending_amount)],
        ['Failed', formatCurrency(summary.failed_amount)],
        ['Delivered', summary.delivered_orders],
        ['Pay Failed', summary.payment_failed_orders],
      ];
      const cardW = contentW / 3;
      let x = margin;
      cards.forEach((c, i) => {
        if (i > 0 && i % 3 === 0) { x = margin; y += 42; }
        doc.rect(x, y, cardW - 6, 36).fillAndStroke('#FFF7ED', '#E6C7A8');
        doc.fillColor([pr, pg, pb]).font('Helvetica-Bold').fontSize(9).text(c[0], x + 8, y + 8, { width: cardW - 14 });
        doc.fillColor([ar, ag, ab]).font('Helvetica-Bold').fontSize(12).text(String(c[1]), x + 8, y + 20, { width: cardW - 14, align: 'right' });
        x += cardW;
      });
      return y + 50;
    };

    const drawTableHeader = (startY) => {
      doc.rect(margin, startY, contentW, 24).fill([pr, pg, pb]);
      doc.fillColor('#FFF7ED').font('Helvetica-Bold').fontSize(9);
      const headers = ['Order #', 'Customer', 'Phone', 'Total', 'Payment', 'Pay Status', 'Order Status', 'Razorpay ID', 'Date'];
      headers.forEach((h, i) => doc.text(h, headerX + i * colW + 4, startY + 8, { width: colW - 8 }));
      return startY + 24;
    };

    const drawRow = (order, startY) => {
      const rowH = 28;
      const values = [
        order.order_number || '—',
        order.customer_name || '—',
        order.customer_phone || '—',
        formatCurrency(order.total_amount),
        (order.payment_method || 'COD').toUpperCase(),
        resolvePaymentStatus(order),
        (order.order_status || 'received').toUpperCase(),
        resolveRazorpayId(order),
        formatDateTime(order.created_at)
      ];
      doc.fillColor([pr, pg, pb]).font('Helvetica').fontSize(8);
      values.forEach((v, i) => {
        let opts = { width: colW - 8, ellipsis: true };
        if (i === 3 || i === 5 || i === 6) opts = { ...opts, align: 'center' };
        doc.text(String(v), headerX + i * colW + 4, startY + 7, opts);
      });
      return rowH;
    };

    drawHeader();
    y = 90;
    y = drawMeta(y);
    y = drawSummary(y);

    doc.addPage();
    drawHeader();
    y = 90;
    y = drawTableHeader(y);

    orders.forEach((order, idx) => {
      if (y + 30 > pageH - 50) {
        doc.addPage();
        drawHeader();
        y = 90;
        y = drawTableHeader(y);
      }
      const rowH = drawRow(order, y);
      if (idx % 2 === 0) {
        doc.rect(margin, y, contentW, rowH).fill('#FFFDF9').stroke('#F0E0CC');
      } else {
        doc.rect(margin, y, contentW, rowH).stroke('#F0E0CC');
      }
      drawRow(order, y);
      y += rowH;
    });

    doc.end();
  } catch (error) {
    console.error('Merchandise orders PDF error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

const getMerchandiseOrdersReportExcel = async (req, res) => {
  try {
    const result = await getReportData(req.query, req.admin);
    if (result.error) return res.status(400).json({ success: false, message: result.error });

    const { data: orders, summary } = result;
    const typeLabel = getReportTypeLabel(req.query);
    const range = getReportDateRange(req.query);
    const generatedAt = formatDateTime(new Date());
    const filename = `Merchandise_Orders_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const workbook = new ExcelJS.Workbook();

    // ── Summary sheet ───────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRows([
      ['Report Name', 'Big Bean Café - Merchandise Orders Report'],
      ['Generated Date', generatedAt],
      ['Report Type', typeLabel],
      ['From Date / Range', range.from],
      ['To Date / Range', range.to],
      [],
      ['Total Orders', summary.total_orders],
      ['Total Sales', summary.total_sales],
      ['Paid Amount', summary.paid_amount],
      ['COD Amount', summary.cod_amount],
      ['Online Amount', summary.online_amount],
      ['Pending Amount', summary.pending_amount],
      ['Failed Amount', summary.failed_amount],
    ]);

    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 45;
    summarySheet.getRow(1).font = { bold: true, size: 14 };
    summarySheet.getRow(7).font = { bold: true };
    for (let r = 1; r <= 13; r++) {
      summarySheet.getRow(r).getCell(1).font = { bold: true };
    }
    for (let r = 7; r <= 13; r++) {
      summarySheet.getRow(r).getCell(2).numFmt = '₹#,##0';
    }

    // ── Orders sheet ────────────────────────────────────────────────────────
    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.columns = [
      { header: 'Order Number', key: 'order_number', width: 22 },
      { header: 'Customer Name', key: 'customer_name', width: 24 },
      { header: 'Phone', key: 'customer_phone', width: 16 },
      { header: 'Email', key: 'customer_email', width: 28 },
      { header: 'Total Amount', key: 'total_amount', width: 14 },
      { header: 'Payment Method', key: 'payment_method', width: 16 },
      { header: 'Payment Status', key: 'payment_status', width: 16 },
      { header: 'Razorpay Order ID', key: 'payment_order_id', width: 24 },
      { header: 'Razorpay Payment ID', key: 'payment_id', width: 24 },
      { header: 'Order Status', key: 'order_status', width: 16 },
      { header: 'Created Date', key: 'created_at', width: 22 },
    ];

    ordersSheet.autoFilter = 'A1:K1';
    ordersSheet.views = [{ state: 'frozen', ySplit: 1 }];

    orders.forEach(order => {
      ordersSheet.addRow({
        order_number: order.order_number || '—',
        customer_name: order.customer_name || '—',
        customer_phone: order.customer_phone || '—',
        customer_email: order.customer_email || '—',
        total_amount: Number(order.total_amount || 0),
        payment_method: (order.payment_method || 'COD').toUpperCase(),
        payment_status: resolvePaymentStatus(order),
        payment_order_id: order.payment_order_id || '—',
        payment_id: order.payment_id || '—',
        order_status: (order.order_status || 'received').toUpperCase(),
        created_at: formatDateTime(order.created_at)
      });
    });

    ordersSheet.getRow(1).font = { bold: true };
    ordersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D1F0D' } };
    ordersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    ordersSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.getCell('total_amount').numFmt = '₹#,##0';
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Merchandise orders Excel error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

module.exports = {
  getMerchandiseOrdersReport,
  getMerchandiseOrdersReportPdf,
  getMerchandiseOrdersReportExcel,
};
