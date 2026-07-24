const PDFDocument = require('pdfkit');
const qrcode = require('qrcode');

const formatTime = (time) => {
  if (!time) return '';
  const [h, m] = String(time).split(':');
  if (h === undefined || m === undefined) return time;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
};

const formatDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

const generateTicketPdf = async (booking) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const brown = '#3D1F0D';
      const gold = '#C9943A';
      const cream = '#FFF7ED';

      // Header bar
      doc.rect(0, 0, 595, 120).fill(brown);
      doc.fillColor(gold).fontSize(26).font('Helvetica-Bold').text('Big Bean Cafe', 50, 35);
      doc.fillColor(cream).fontSize(18).font('Helvetica').text('Event Ticket', 50, 65);

      // Subtitle
      doc.fillColor(brown).fontSize(12).font('Helvetica-Bold').text('Booking Confirmation', 50, 140);

      // Booking number box
      doc.rect(50, 160, 495, 50).stroke(gold);
      doc.fillColor(brown).fontSize(11).font('Helvetica-Bold').text('BOOKING NUMBER', 60, 170);
      doc.fillColor(brown).fontSize(18).font('Helvetica-Bold').text(booking.booking_number, 60, 185);

      let y = 240;

      // Event details
      doc.fillColor(gold).fontSize(11).font('Helvetica-Bold').text('EVENT', 50, y);
      doc.fillColor(brown).fontSize(16).font('Helvetica-Bold').text(booking.event_title, 50, y + 15);
      doc.fillColor(brown).fontSize(11).font('Helvetica').text(`${formatDate(booking.event_date)} · ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`, 50, y + 35);
      if (booking.door_open_time) {
        doc.fillColor(brown).fontSize(11).font('Helvetica').text(`Doors open: ${formatTime(booking.door_open_time)}`, 50, y + 50);
      }

      y = booking.door_open_time ? 335 : 320;

      // Venue
      doc.fillColor(gold).fontSize(11).font('Helvetica-Bold').text('VENUE', 50, y);
      doc.fillColor(brown).fontSize(12).font('Helvetica-Bold').text(booking.outlet_name || 'Big Bean Cafe', 50, y + 15);
      doc.fillColor(brown).fontSize(11).font('Helvetica').text([booking.outlet_address, booking.outlet_city].filter(Boolean).join(', '), 50, y + 30);

      // Customer
      y += 60;
      doc.fillColor(gold).fontSize(11).font('Helvetica-Bold').text('CUSTOMER', 50, y);
      doc.fillColor(brown).fontSize(12).font('Helvetica-Bold').text(booking.customer_name, 50, y + 15);
      doc.fillColor(brown).fontSize(11).font('Helvetica').text(booking.customer_phone, 50, y + 30);
      if (booking.customer_email) {
        doc.fillColor(brown).fontSize(11).font('Helvetica').text(booking.customer_email, 50, y + 45);
      }

      // Ticket
      y += booking.customer_email ? 75 : 60;
      doc.fillColor(gold).fontSize(11).font('Helvetica-Bold').text('TICKET', 50, y);
      doc.fillColor(brown).fontSize(12).font('Helvetica-Bold').text(`${booking.ticket_name} × ${booking.quantity}`, 50, y + 15);
      doc.fillColor(brown).fontSize(11).font('Helvetica').text(`Total Paid: ₹${Number(booking.total_amount).toFixed(2)}`, 50, y + 30);
      doc.fillColor(brown).fontSize(11).font('Helvetica').text(`Payment Status: ${booking.payment_status} · Booking Status: ${booking.booking_status}`, 50, y + 45);
      if (booking.razorpay_payment_id) {
        doc.fillColor(brown).fontSize(11).font('Helvetica').text(`Payment ID: ${booking.razorpay_payment_id}`, 50, y + 60);
      }

      // QR Code
      let qrBuffer;
      if (booking.qr_code && booking.qr_code.startsWith('data:image')) {
        const base64 = booking.qr_code.split(',')[1];
        qrBuffer = Buffer.from(base64, 'base64');
      } else {
        const qrText = booking.qr_code || JSON.stringify({ booking_number: booking.booking_number, status: 'confirmed' });
        qrBuffer = await qrcode.toBuffer(qrText, { width: 140, margin: 1, type: 'png' });
      }
      doc.image(qrBuffer, 390, 240, { width: 140 });
      doc.fillColor(brown).fontSize(10).font('Helvetica').text('Scan this QR code at the event entry.', 390, 390, { width: 140, align: 'center' });

      // Footer
      const footerY = 680;
      doc.rect(0, footerY, 595, 120).fill(cream);
      doc.fillColor(brown).fontSize(11).font('Helvetica-Bold').text('Thank you for booking with Big Bean Cafe.', 50, footerY + 20);
      doc.fillColor(brown).fontSize(10).font('Helvetica').text('Please carry this ticket or show it on your phone at the entry.', 50, footerY + 40);
      doc.fillColor(brown).fontSize(9).font('Helvetica').text('Ticket is valid only for selected date and time. Entry subject to venue rules. Ticket once confirmed is subject to event policy.', 50, footerY + 60, { width: 495 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateTicketPdf };
