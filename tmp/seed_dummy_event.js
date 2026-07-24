const { pool } = require('../src/config/database');

async function seed() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const slug = 'coffee-canvas-night';
    const [existing] = await connection.execute(
      'SELECT id FROM cafe_events WHERE slug = ?',
      [slug]
    );
    if (existing.length > 0) {
      console.log('Dummy event already exists.');
      await connection.commit();
      return;
    }

    const things = {
      language: 'English, Hindi',
      duration: '2 Hours',
      ticket_age_rule: 'Ticket needed for all ages',
      entry_age_rule: 'Entry allowed for all ages',
      layout_type: 'Indoor',
      seating_type: 'Seated & Standing',
      kid_friendly: true,
      pets_allowed: false,
    };

    const [eventResult] = await connection.execute(
      `INSERT INTO cafe_events (
        title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Coffee & Canvas Night',
        slug,
        'Sip, paint and create your own café-inspired artwork at Big Bean Cafe.',
        `Join us for a cozy creative evening filled with coffee, colors and conversations. Coffee & Canvas Night is designed for beginners and art lovers who want to unwind, paint and take home a handmade memory from Big Bean Cafe.`,
        null,
        null,
        'Workshop',
        things.language,
        things.duration,
        things.ticket_age_rule,
        things.entry_age_rule,
        things.layout_type,
        things.seating_type,
        things.kid_friendly ? 1 : 0,
        things.pets_allowed ? 1 : 0,
        'Ticket is valid only for the selected date and time. Please arrive 15 minutes early. Materials will be provided at the venue.',
        null,
        null,
        'active',
        1,
        0,
      ]
    );

    const eventId = eventResult.insertId;

    await connection.execute(
      `INSERT INTO cafe_event_outlets (
        event_id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        null,
        'Big Bean Cafe - Koramangala',
        '28, 80 Feet Rd, S.T. Bed, Koramangala, Bengaluru',
        'Bengaluru',
        null,
        null,
        null,
      ]
    );

    const dates = [
      { event_date: '2026-07-24', start_time: '18:00', end_time: '20:00', door_open_time: '17:30', total_seats: 50, available_seats: 50 },
      { event_date: '2026-07-25', start_time: '18:00', end_time: '20:00', door_open_time: '17:30', total_seats: 50, available_seats: 50 },
      { event_date: '2026-07-26', start_time: '17:00', end_time: '19:00', door_open_time: '16:30', total_seats: 50, available_seats: 50 },
    ];

    for (const d of dates) {
      await connection.execute(
        `INSERT INTO cafe_event_dates (
          event_id, event_date, start_time, end_time, door_open_time, display_time_label,
          total_seats, available_seats, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          d.event_date,
          d.start_time,
          d.end_time,
          d.door_open_time,
          null,
          d.total_seats,
          d.available_seats,
          'active',
        ]
      );
    }

    const tickets = [
      { ticket_name: 'Regular Ticket', ticket_description: 'General admission', price: 799, mrp: null, total_quantity: 150, available_quantity: 150, max_per_booking: 10 },
      { ticket_name: 'Couple Ticket', ticket_description: 'Admission for two', price: 1499, mrp: null, total_quantity: 80, available_quantity: 80, max_per_booking: 5 },
    ];

    for (const t of tickets) {
      await connection.execute(
        `INSERT INTO cafe_event_ticket_types (
          event_id, ticket_name, ticket_description, price, mrp, total_quantity,
          available_quantity, max_per_booking, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          t.ticket_name,
          t.ticket_description,
          t.price,
          t.mrp,
          t.total_quantity,
          t.available_quantity,
          t.max_per_booking,
          'active',
        ]
      );
    }

    await connection.commit();
    console.log('Dummy event created successfully:', slug);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Seed error:', error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

(async () => {
  try {
    await seed();
  } finally {
    await pool.end();
  }
})();
