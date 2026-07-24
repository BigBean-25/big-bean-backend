const { pool } = require('../config/database');

const slugify = (value) => {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/café/g, 'cafe')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const computeDisplayStatus = (event, dates = []) => {
  const today = getTodayStr();
  if (event.status === 'closed' || event.status === 'cancelled') return 'closed';
  if (event.status === 'sold_out') return 'sold_out';

  const futureActive = dates.filter(d => d.status === 'active' && d.event_date >= today);
  if (futureActive.length === 0) return 'closed';

  const hasSeats = futureActive.some(d => Number(d.available_seats) > 0);
  return hasSeats ? 'booking_open' : 'sold_out';
};

const computeSeatsLeft = (dates = []) => {
  return dates
    .filter(d => d.status === 'active')
    .reduce((sum, d) => sum + (Number(d.available_seats) || 0), 0);
};

const computePriceFrom = (ticketTypes = []) => {
  const active = ticketTypes.filter(t => t.status === 'active');
  if (!active.length) return null;
  return Math.min(...active.map(t => Number(t.price) || 0));
};

const getActiveEvents = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [events] = await connection.execute(
      `SELECT id, title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
       FROM cafe_events
       WHERE status = 'active'
       ORDER BY sort_order ASC, created_at DESC`
    );

    if (events.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const eventIds = events.map(e => e.id);

    const [dates] = await connection.execute(
      `SELECT id, event_id,
        DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(start_time, '%H:%i') AS start_time,
        TIME_FORMAT(end_time, '%H:%i') AS end_time,
        TIME_FORMAT(door_open_time, '%H:%i') AS door_open_time,
        display_time_label, total_seats, available_seats, status
       FROM cafe_event_dates
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})
       ORDER BY event_date, start_time`,
      eventIds
    );

    const [ticket_types] = await connection.execute(
      `SELECT id, event_id, ticket_name, ticket_description, price, mrp, total_quantity,
        available_quantity, max_per_booking, status
       FROM cafe_event_ticket_types
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
      eventIds
    );

    const [outlets] = await connection.execute(
      `SELECT id, event_id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
       FROM cafe_event_outlets
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
      eventIds
    );

    const datesByEvent = {};
    dates.forEach(d => {
      if (!datesByEvent[d.event_id]) datesByEvent[d.event_id] = [];
      datesByEvent[d.event_id].push({
        ...d,
        total_seats: Number(d.total_seats),
        available_seats: Number(d.available_seats),
      });
    });

    const ticketsByEvent = {};
    ticket_types.forEach(t => {
      if (!ticketsByEvent[t.event_id]) ticketsByEvent[t.event_id] = [];
      ticketsByEvent[t.event_id].push({
        ...t,
        price: Number(t.price),
        mrp: t.mrp ? Number(t.mrp) : null,
        total_quantity: Number(t.total_quantity),
        available_quantity: Number(t.available_quantity),
        max_per_booking: Number(t.max_per_booking),
      });
    });

    const outletsByEvent = {};
    outlets.forEach(o => { outletsByEvent[o.event_id] = o; });

    const data = events
      .map(e => {
        const eventDates = datesByEvent[e.id] || [];
        const eventTickets = ticketsByEvent[e.id] || [];
        const displayStatus = computeDisplayStatus(e, eventDates);
        return {
          ...e,
          kid_friendly: e.kid_friendly === 1,
          pets_allowed: e.pets_allowed === 1,
          is_featured: e.is_featured === 1,
          display_status: displayStatus,
          price_from: computePriceFrom(eventTickets),
          seats_left: computeSeatsLeft(eventDates),
          dates: eventDates,
          ticket_types: eventTickets,
          outlet: outletsByEvent[e.id] || null,
        };
      })
      .filter(e => e.display_status !== 'closed');

    res.json({ success: true, data });
  } catch (error) {
    console.error('getActiveEvents error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const getEventBySlug = async (req, res) => {
  let connection;
  try {
    const { slug } = req.params;
    connection = await pool.getConnection();

    const [events] = await connection.execute(
      `SELECT id, title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
       FROM cafe_events
       WHERE slug = ? AND status IN ('active', 'closed', 'sold_out')`,
      [slug]
    );

    if (events.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = events[0];
    const id = event.id;

    const [outlets] = await connection.execute(
      `SELECT id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
       FROM cafe_event_outlets WHERE event_id = ? LIMIT 1`,
      [id]
    );

    const [dates] = await connection.execute(
      `SELECT id,
        DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(start_time, '%H:%i') AS start_time,
        TIME_FORMAT(end_time, '%H:%i') AS end_time,
        TIME_FORMAT(door_open_time, '%H:%i') AS door_open_time,
        display_time_label, total_seats, available_seats, status
       FROM cafe_event_dates WHERE event_id = ? ORDER BY event_date, start_time`,
      [id]
    );

    const [ticket_types] = await connection.execute(
      `SELECT id, ticket_name, ticket_description, price, mrp, total_quantity,
        available_quantity, max_per_booking, status
       FROM cafe_event_ticket_types WHERE event_id = ?`,
      [id]
    );

    const mappedDates = dates.map(d => ({ ...d, total_seats: Number(d.total_seats), available_seats: Number(d.available_seats) }));

    const mappedTickets = ticket_types.map(t => ({
      ...t,
      price: Number(t.price),
      mrp: t.mrp ? Number(t.mrp) : null,
      total_quantity: Number(t.total_quantity),
      available_quantity: Number(t.available_quantity),
      max_per_booking: Number(t.max_per_booking),
    }));

    const data = {
      ...event,
      kid_friendly: event.kid_friendly === 1,
      pets_allowed: event.pets_allowed === 1,
      is_featured: event.is_featured === 1,
      display_status: computeDisplayStatus(event, mappedDates),
      price_from: computePriceFrom(mappedTickets),
      seats_left: computeSeatsLeft(mappedDates),
      outlet: outlets[0] || null,
      dates: mappedDates,
      ticket_types: mappedTickets,
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('getEventBySlug error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const getAdminEvents = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [events] = await connection.execute(
      `SELECT id, title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
       FROM cafe_events
       ORDER BY sort_order ASC, created_at DESC`
    );

    if (events.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const eventIds = events.map(e => e.id);

    const [dates] = await connection.execute(
      `SELECT id, event_id,
        DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(start_time, '%H:%i') AS start_time,
        TIME_FORMAT(end_time, '%H:%i') AS end_time,
        TIME_FORMAT(door_open_time, '%H:%i') AS door_open_time,
        display_time_label, total_seats, available_seats, status
       FROM cafe_event_dates
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})
       ORDER BY event_date, start_time`,
      eventIds
    );

    const [ticket_types] = await connection.execute(
      `SELECT id, event_id, ticket_name, ticket_description, price, mrp, total_quantity,
        available_quantity, max_per_booking, status
       FROM cafe_event_ticket_types
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
      eventIds
    );

    const [outlets] = await connection.execute(
      `SELECT id, event_id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
       FROM cafe_event_outlets
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
      eventIds
    );

    const [bookingCounts] = await connection.execute(
      `SELECT event_id, COUNT(*) AS total_bookings
       FROM cafe_event_bookings
       WHERE event_id IN (${eventIds.map(() => '?').join(',')})
       GROUP BY event_id`,
      eventIds
    );

    const datesByEvent = {};
    dates.forEach(d => {
      if (!datesByEvent[d.event_id]) datesByEvent[d.event_id] = [];
      datesByEvent[d.event_id].push({
        ...d,
        total_seats: Number(d.total_seats),
        available_seats: Number(d.available_seats),
      });
    });

    const ticketsByEvent = {};
    ticket_types.forEach(t => {
      if (!ticketsByEvent[t.event_id]) ticketsByEvent[t.event_id] = [];
      ticketsByEvent[t.event_id].push({
        ...t,
        price: Number(t.price),
        mrp: t.mrp ? Number(t.mrp) : null,
        total_quantity: Number(t.total_quantity),
        available_quantity: Number(t.available_quantity),
        max_per_booking: Number(t.max_per_booking),
      });
    });

    const outletsByEvent = {};
    outlets.forEach(o => {
      if (!outletsByEvent[o.event_id]) outletsByEvent[o.event_id] = [];
      outletsByEvent[o.event_id].push(o);
    });

    const bookingsByEvent = {};
    bookingCounts.forEach(b => { bookingsByEvent[b.event_id] = Number(b.total_bookings); });

    const data = events.map(e => ({
      ...e,
      kid_friendly: e.kid_friendly === 1,
      pets_allowed: e.pets_allowed === 1,
      is_featured: e.is_featured === 1,
      total_bookings: bookingsByEvent[e.id] || 0,
      dates: datesByEvent[e.id] || [],
      ticket_types: ticketsByEvent[e.id] || [],
      outlets: outletsByEvent[e.id] || [],
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('getAdminEvents error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const createEvent = async (req, res) => {
  let connection;
  try {
    // Parse JSON payload sent as multipart field "data"
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;

    const {
      title,
      slug,
      category,
      short_description,
      description,
      status,
      is_featured,
      sort_order,
      outlet,
      dates,
      ticket_types,
      things_to_know,
      terms_conditions,
      cancellation_policy,
      entry_policy,
    } = data;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }

    let eventSlug = slug ? slug.trim() : slugify(title);
    if (!eventSlug) eventSlug = `event-${Date.now()}`;

    // Uploaded image paths
    const bannerFile = req.files?.event_banner?.[0];
    const thumbnailFile = req.files?.event_thumbnail?.[0];
    const event_banner = bannerFile ? `uploads/events/${bannerFile.filename}` : null;
    const event_thumbnail = thumbnailFile ? `uploads/events/${thumbnailFile.filename}` : null;

    const t = things_to_know || {};

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insert main event
    const [eventResult] = await connection.execute(
      `INSERT INTO cafe_events (
        title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        eventSlug,
        short_description || null,
        description || null,
        event_banner,
        event_thumbnail,
        category || null,
        t.language || 'English, Hindi',
        t.duration || '1 Hour',
        t.ticket_age_rule || 'Ticket needed for all ages',
        t.entry_age_rule || 'Entry allowed for all ages',
        t.layout_type || 'Indoor',
        t.seating_type || 'Seated & Standing',
        t.kid_friendly !== undefined ? (t.kid_friendly ? 1 : 0) : 1,
        t.pets_allowed !== undefined ? (t.pets_allowed ? 1 : 0) : 0,
        terms_conditions || null,
        cancellation_policy || null,
        entry_policy || null,
        status || 'draft',
        is_featured ? 1 : 0,
        sort_order || 0,
      ]
    );

    const eventId = eventResult.insertId;

    // Insert outlet
    if (outlet && outlet.outlet_name) {
      await connection.execute(
        `INSERT INTO cafe_event_outlets (
          event_id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          outlet.outlet_id || null,
          outlet.outlet_name.trim(),
          outlet.outlet_address || null,
          outlet.city || 'Bengaluru',
          outlet.map_url || null,
          outlet.latitude || null,
          outlet.longitude || null,
        ]
      );
    }

    // Insert dates
    if (Array.isArray(dates) && dates.length > 0) {
      for (const d of dates) {
        if (!d.event_date || !d.start_time) continue;
        await connection.execute(
          `INSERT INTO cafe_event_dates (
            event_id, event_date, start_time, end_time, door_open_time, display_time_label,
            total_seats, available_seats, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            d.event_date,
            d.start_time,
            d.end_time || null,
            d.door_open_time || null,
            d.display_time_label || null,
            Number(d.total_seats) || 0,
            Number(d.available_seats) || 0,
            d.status || 'active',
          ]
        );
      }
    }

    // Insert ticket types
    if (Array.isArray(ticket_types) && ticket_types.length > 0) {
      for (const t of ticket_types) {
        if (!t.ticket_name) continue;
        await connection.execute(
          `INSERT INTO cafe_event_ticket_types (
            event_id, ticket_name, ticket_description, price, mrp, total_quantity,
            available_quantity, max_per_booking, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            eventId,
            t.ticket_name.trim(),
            t.ticket_description || null,
            Number(t.price) || 0,
            t.mrp ? Number(t.mrp) : null,
            Number(t.total_quantity) || 0,
            Number(t.available_quantity) || 0,
            Number(t.max_per_booking) || 10,
            t.status || 'active',
          ]
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { id: eventId },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('createEvent error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  } finally {
    if (connection) connection.release();
  }
};

const getAdminEventById = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    const [events] = await connection.execute(
      `SELECT id, title, slug, short_description, description, event_banner, event_thumbnail,
        category, language, duration, ticket_age_rule, entry_age_rule, layout_type,
        seating_type, kid_friendly, pets_allowed, terms_conditions, cancellation_policy,
        entry_policy, status, is_featured, sort_order
       FROM cafe_events WHERE id = ?`,
      [id]
    );

    if (events.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = events[0];

    const [outlets] = await connection.execute(
      `SELECT id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
       FROM cafe_event_outlets WHERE event_id = ? LIMIT 1`,
      [id]
    );

    const [dates] = await connection.execute(
      `SELECT id,
        DATE_FORMAT(event_date, '%Y-%m-%d') AS event_date,
        TIME_FORMAT(start_time, '%H:%i') AS start_time,
        TIME_FORMAT(end_time, '%H:%i') AS end_time,
        TIME_FORMAT(door_open_time, '%H:%i') AS door_open_time,
        display_time_label, total_seats, available_seats, status
       FROM cafe_event_dates WHERE event_id = ? ORDER BY event_date, start_time`,
      [id]
    );

    const [ticket_types] = await connection.execute(
      `SELECT id, ticket_name, ticket_description, price, mrp, total_quantity,
        available_quantity, max_per_booking, status
       FROM cafe_event_ticket_types WHERE event_id = ?`,
      [id]
    );

    const data = {
      ...event,
      kid_friendly: event.kid_friendly === 1,
      pets_allowed: event.pets_allowed === 1,
      is_featured: event.is_featured === 1,
      outlet: outlets[0] || null,
      dates: dates.map(d => ({ ...d, total_seats: Number(d.total_seats), available_seats: Number(d.available_seats) })),
      ticket_types: ticket_types.map(t => ({
        ...t,
        price: Number(t.price),
        mrp: t.mrp ? Number(t.mrp) : null,
        total_quantity: Number(t.total_quantity),
        available_quantity: Number(t.available_quantity),
        max_per_booking: Number(t.max_per_booking),
      })),
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('getAdminEventById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const updateEvent = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      title,
      slug,
      category,
      short_description,
      description,
      status,
      is_featured,
      sort_order,
      outlet,
      dates,
      ticket_types,
      things_to_know,
      terms_conditions,
      cancellation_policy,
      entry_policy,
    } = data;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Event title is required' });
    }

    let eventSlug = slug ? slug.trim() : slugify(title);
    if (!eventSlug) eventSlug = `event-${Date.now()}`;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch existing images so we keep them when no new file is uploaded
    const [existingEvents] = await connection.execute(
      'SELECT event_banner, event_thumbnail FROM cafe_events WHERE id = ?',
      [id]
    );
    if (existingEvents.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const existing = existingEvents[0];
    const bannerFile = req.files?.event_banner?.[0];
    const thumbnailFile = req.files?.event_thumbnail?.[0];
    const removeBanner = data.remove_banner || data.event_banner === null || data.event_banner === '';
    const removeThumbnail = data.remove_thumbnail || data.event_thumbnail === null || data.event_thumbnail === '';
    const event_banner = bannerFile ? `uploads/events/${bannerFile.filename}` : (removeBanner ? null : existing.event_banner);
    const event_thumbnail = thumbnailFile ? `uploads/events/${thumbnailFile.filename}` : (removeThumbnail ? null : existing.event_thumbnail);

    const t = things_to_know || {};

    // Update main event
    await connection.execute(
      `UPDATE cafe_events SET
        title = ?, slug = ?, short_description = ?, description = ?, event_banner = ?, event_thumbnail = ?,
        category = ?, language = ?, duration = ?, ticket_age_rule = ?, entry_age_rule = ?, layout_type = ?,
        seating_type = ?, kid_friendly = ?, pets_allowed = ?, terms_conditions = ?, cancellation_policy = ?,
        entry_policy = ?, status = ?, is_featured = ?, sort_order = ?
      WHERE id = ?`,
      [
        title.trim(),
        eventSlug,
        short_description || null,
        description || null,
        event_banner,
        event_thumbnail,
        category || null,
        t.language || 'English, Hindi',
        t.duration || '1 Hour',
        t.ticket_age_rule || 'Ticket needed for all ages',
        t.entry_age_rule || 'Entry allowed for all ages',
        t.layout_type || 'Indoor',
        t.seating_type || 'Seated & Standing',
        t.kid_friendly !== undefined ? (t.kid_friendly ? 1 : 0) : 1,
        t.pets_allowed !== undefined ? (t.pets_allowed ? 1 : 0) : 0,
        terms_conditions || null,
        cancellation_policy || null,
        entry_policy || null,
        status || 'draft',
        is_featured ? 1 : 0,
        sort_order || 0,
        id,
      ]
    );

    // Recreate outlet row (no booking references)
    await connection.execute('DELETE FROM cafe_event_outlets WHERE event_id = ?', [id]);
    if (outlet && outlet.outlet_name) {
      await connection.execute(
        `INSERT INTO cafe_event_outlets (
          event_id, outlet_id, outlet_name, outlet_address, city, map_url, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          outlet.outlet_id || null,
          outlet.outlet_name.trim(),
          outlet.outlet_address || null,
          outlet.city || 'Bengaluru',
          outlet.map_url || null,
          outlet.latitude || null,
          outlet.longitude || null,
        ]
      );
    }

    // Upsert dates
    const processedDateIds = [];
    if (Array.isArray(dates) && dates.length > 0) {
      for (const d of dates) {
        if (!d.event_date || !d.start_time) continue;
        const dateId = d.id ? Number(d.id) : null;
        let dbDateId = null;

        if (dateId && !isNaN(dateId)) {
          const [rows] = await connection.execute(
            'SELECT id FROM cafe_event_dates WHERE id = ? AND event_id = ?',
            [dateId, id]
          );
          if (rows.length > 0) {
            dbDateId = rows[0].id;
            await connection.execute(
              `UPDATE cafe_event_dates SET
                event_date = ?, start_time = ?, end_time = ?, door_open_time = ?, display_time_label = ?,
                total_seats = ?, available_seats = ?, status = ?
              WHERE id = ?`,
              [
                d.event_date,
                d.start_time,
                d.end_time || null,
                d.door_open_time || null,
                d.display_time_label || null,
                Number(d.total_seats) || 0,
                Number(d.available_seats) || 0,
                d.status || 'active',
                dbDateId,
              ]
            );
          }
        }

        if (!dbDateId) {
          const [insertResult] = await connection.execute(
            `INSERT INTO cafe_event_dates (
              event_id, event_date, start_time, end_time, door_open_time, display_time_label,
              total_seats, available_seats, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              d.event_date,
              d.start_time,
              d.end_time || null,
              d.door_open_time || null,
              d.display_time_label || null,
              Number(d.total_seats) || 0,
              Number(d.available_seats) || 0,
              d.status || 'active',
            ]
          );
          dbDateId = insertResult.insertId;
        }

        processedDateIds.push(dbDateId);
      }
    }

    // Mark removed dates as inactive instead of deleting
    if (processedDateIds.length > 0) {
      await connection.execute(
        `UPDATE cafe_event_dates SET status = 'inactive' WHERE event_id = ? AND id NOT IN (${processedDateIds.map(() => '?').join(',')})`,
        [id, ...processedDateIds]
      );
    } else {
      await connection.execute(
        `UPDATE cafe_event_dates SET status = 'inactive' WHERE event_id = ?`,
        [id]
      );
    }

    // Upsert ticket types
    const processedTicketIds = [];
    if (Array.isArray(ticket_types) && ticket_types.length > 0) {
      for (const t of ticket_types) {
        if (!t.ticket_name) continue;
        const ticketId = t.id ? Number(t.id) : null;
        let dbTicketId = null;

        if (ticketId && !isNaN(ticketId)) {
          const [rows] = await connection.execute(
            'SELECT id FROM cafe_event_ticket_types WHERE id = ? AND event_id = ?',
            [ticketId, id]
          );
          if (rows.length > 0) {
            dbTicketId = rows[0].id;
            await connection.execute(
              `UPDATE cafe_event_ticket_types SET
                ticket_name = ?, ticket_description = ?, price = ?, mrp = ?, total_quantity = ?,
                available_quantity = ?, max_per_booking = ?, status = ?
              WHERE id = ?`,
              [
                t.ticket_name.trim(),
                t.ticket_description || null,
                Number(t.price) || 0,
                t.mrp ? Number(t.mrp) : null,
                Number(t.total_quantity) || 0,
                Number(t.available_quantity) || 0,
                Number(t.max_per_booking) || 10,
                t.status || 'active',
                dbTicketId,
              ]
            );
          }
        }

        if (!dbTicketId) {
          const [insertResult] = await connection.execute(
            `INSERT INTO cafe_event_ticket_types (
              event_id, ticket_name, ticket_description, price, mrp, total_quantity,
              available_quantity, max_per_booking, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              t.ticket_name.trim(),
              t.ticket_description || null,
              Number(t.price) || 0,
              t.mrp ? Number(t.mrp) : null,
              Number(t.total_quantity) || 0,
              Number(t.available_quantity) || 0,
              Number(t.max_per_booking) || 10,
              t.status || 'active',
            ]
          );
          dbTicketId = insertResult.insertId;
        }

        processedTicketIds.push(dbTicketId);
      }
    }

    // Mark removed tickets as inactive instead of deleting
    if (processedTicketIds.length > 0) {
      await connection.execute(
        `UPDATE cafe_event_ticket_types SET status = 'inactive' WHERE event_id = ? AND id NOT IN (${processedTicketIds.map(() => '?').join(',')})`,
        [id, ...processedTicketIds]
      );
    } else {
      await connection.execute(
        `UPDATE cafe_event_ticket_types SET status = 'inactive' WHERE event_id = ?`,
        [id]
      );
    }

    await connection.commit();

    res.json({ success: true, message: 'Event updated successfully', data: { id } });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('updateEvent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

const getEventOutlets = async (req, res) => {
  try {
    const [outlets] = await pool.execute(
      `SELECT id, name, slug, address, status
       FROM outlets
       WHERE status = ?
       ORDER BY sort_order ASC, name ASC`,
      ['active']
    );

    const data = outlets.map(o => ({
      id: o.id,
      name: o.name,
      outlet_name: o.name,
      slug: o.slug,
      address: o.address,
      city: null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('getEventOutlets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch event outlets' });
  }
};

const deleteEvent = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const force = req.query.force === 'true' || req.body.force === true;
    const admin = req.admin || req.user;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [events] = await connection.execute(
      'SELECT id, title, status FROM cafe_events WHERE id = ?',
      [id]
    );

    if (events.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const [bookingCount] = await connection.execute(
      'SELECT COUNT(*) AS count FROM cafe_event_bookings WHERE event_id = ?',
      [id]
    );

    const hasBookings = Number(bookingCount[0].count) > 0;

    if (hasBookings && !force) {
      await connection.execute(
        "UPDATE cafe_events SET status = 'cancelled' WHERE id = ?",
        [id]
      );
      await connection.commit();
      return res.json({
        success: true,
        message: 'Event has bookings, so it was marked as cancelled. Use force delete to permanently remove it.',
      });
    }

    if (force) {
      if (!admin || (admin.role_key !== 'super_admin' && admin.is_super_admin !== true)) {
        await connection.rollback();
        return res.status(403).json({ success: false, message: 'Force delete is allowed only for Super Admin' });
      }

      await connection.execute(
        'DELETE FROM cafe_event_checkins WHERE booking_id IN (SELECT id FROM cafe_event_bookings WHERE event_id = ?)',
        [id]
      );
      await connection.execute('DELETE FROM cafe_event_bookings WHERE event_id = ?', [id]);
    }

    await connection.execute('DELETE FROM cafe_event_outlets WHERE event_id = ?', [id]);
    await connection.execute('DELETE FROM cafe_event_dates WHERE event_id = ?', [id]);
    await connection.execute('DELETE FROM cafe_event_ticket_types WHERE event_id = ?', [id]);
    await connection.execute('DELETE FROM cafe_events WHERE id = ?', [id]);

    await connection.commit();
    res.json({ success: true, message: 'Event permanently deleted' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('deleteEvent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  getActiveEvents,
  getEventBySlug,
  getAdminEvents,
  createEvent,
  getAdminEventById,
  updateEvent,
  deleteEvent,
  getEventOutlets,
};
