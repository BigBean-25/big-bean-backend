const { pool } = require('../src/config/database');

async function seed() {
  let connection;
  try {
    connection = await pool.getConnection();

    const slug = 'coffee-mug-painting';
    const [existing] = await connection.execute(
      'SELECT id FROM cafe_events WHERE slug = ?',
      [slug]
    );
    if (existing.length > 0) {
      console.log('Sample event already exists.');
      return;
    }

    const things = {
      language: 'English, Hindi',
      duration: '1 Hour',
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
        'Coffee Mug Painting',
        slug,
        'Paint your own coffee mug at Big Bean Cafe.',
        'Turn an everyday mug into a piece of art in this fun and creative workshop. Explore your artistic side as you paint, design, and personalize your very own coffee mug—perfect for your morning brew or as a thoughtful handmade gift.',
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
        'Ticket is valid only for the selected date and time. Please arrive 15 minutes before the activity. Entry is subject to venue rules.',
        null,
        null,
        'active',
        1,
        1,
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
        'Big Bean Cafe',
        'Koramangala 4th Block, Bangalore',
        'Bengaluru',
        null,
        null,
        null,
      ]
    );

    const dates = [
      { event_date: '2026-07-24', start_time: '16:00', end_time: '17:00', door_open_time: '15:30', total_seats: 40, available_seats: 40 },
      { event_date: '2026-07-25', start_time: '18:00', end_time: '19:00', door_open_time: '17:30', total_seats: 40, available_seats: 40 },
      { event_date: '2026-07-26', start_time: '17:00', end_time: '18:00', door_open_time: '16:30', total_seats: 40, available_seats: 40 },
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
      { ticket_name: 'Regular Ticket', ticket_description: 'General admission', price: 699, mrp: null, total_quantity: 120, available_quantity: 120, max_per_booking: 10 },
      { ticket_name: 'Couple Ticket', ticket_description: 'Admission for two', price: 1299, mrp: null, total_quantity: 60, available_quantity: 60, max_per_booking: 5 },
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
    console.log('Sample event created successfully.');
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
