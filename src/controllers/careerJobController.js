const { executeQuery } = require('../config/database');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS career_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      department VARCHAR(150) NULL,
      location VARCHAR(150) DEFAULT 'Bangalore',
      outlet_id INT NULL,
      outlet_name VARCHAR(150) NULL,
      experience VARCHAR(100) NULL,
      job_type VARCHAR(100) DEFAULT 'Full-time',
      salary_range VARCHAR(100) NULL,
      short_description TEXT NULL,
      responsibilities TEXT NULL,
      requirements TEXT NULL,
      benefits TEXT NULL,
      status ENUM('active','inactive','closed') DEFAULT 'active',
      is_featured TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const existing = await executeQuery('SELECT id FROM career_jobs LIMIT 1');
  if (existing.length === 0) {
    const seeds = [
      {
        title: 'Barista',
        department: 'Operations',
        location: 'Bangalore',
        experience: '1-2 years',
        job_type: 'Full-time',
        salary_range: '2.5 - 3.5 LPA',
        short_description: 'We are looking for passionate baristas who love coffee and delivering exceptional customer experiences.',
        responsibilities: 'Prepare and serve high-quality coffee beverages\nMaintain cleanliness of coffee station\nProvide excellent customer service\nSupport team during peak hours',
        requirements: '1+ year barista experience\nKnowledge of espresso and brewing methods\nGood communication skills\nAbility to work in a fast-paced environment',
        benefits: 'Free coffee and meals on shift\nTraining and certification programs\nCareer growth to senior barista\nFriendly team culture',
        status: 'active', is_featured: 1, sort_order: 1
      },
      {
        title: 'Café Manager',
        department: 'Management',
        location: 'Bangalore',
        experience: '3-5 years',
        job_type: 'Full-time',
        salary_range: '5 - 8 LPA',
        short_description: 'Lead our café team and ensure outstanding customer experiences while managing daily operations.',
        responsibilities: 'Oversee daily café operations\nManage and train staff\nHandle inventory and ordering\nEnsure customer satisfaction standards',
        requirements: '3+ years in café or restaurant management\nStrong leadership and communication skills\nFinancial and inventory management knowledge\nCustomer-first approach',
        benefits: 'Performance bonus\nLeadership development programs\nMeal and coffee benefits\nGrowth to area manager',
        status: 'active', is_featured: 1, sort_order: 2
      },
      {
        title: 'Service Associate',
        department: 'Operations',
        location: 'Bangalore',
        experience: '0-1 year',
        job_type: 'Full-time',
        salary_range: '1.8 - 2.5 LPA',
        short_description: 'Join our frontline team as a Service Associate and be the face of the Big Bean Café experience.',
        responsibilities: 'Welcome and serve customers\nTake orders and manage billing\nMaintain café cleanliness\nSupport kitchen and barista team',
        requirements: 'Class 12 or diploma\nFriendly and customer-oriented attitude\nBasic English communication\nWillingness to learn',
        benefits: 'Free meals on shift\nTraining provided\nGrowth to senior roles\nPositive work environment',
        status: 'active', is_featured: 0, sort_order: 3
      }
    ];

    for (const s of seeds) {
      await executeQuery(`
        INSERT INTO career_jobs
          (title, department, location, experience, job_type, salary_range,
           short_description, responsibilities, requirements, benefits,
           status, is_featured, sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [
        s.title, s.department, s.location, s.experience, s.job_type, s.salary_range,
        s.short_description, s.responsibilities, s.requirements, s.benefits,
        s.status, s.is_featured, s.sort_order
      ]);
    }
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { search, department, job_type, status } = req.query;
    let query = 'SELECT * FROM career_jobs WHERE 1=1';
    const params = [];
    if (search) {
      query += ' AND (title LIKE ? OR department LIKE ? OR location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (department && department !== 'all') { query += ' AND department=?'; params.push(department); }
    if (job_type && job_type !== 'all') { query += ' AND job_type=?'; params.push(job_type); }
    if (status && status !== 'all') { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';
    const rows = await executeQuery(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get all career jobs error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM career_jobs WHERE status='active' ORDER BY is_featured DESC, sort_order ASC, id DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get active career jobs error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM career_jobs WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get career job by id error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const {
      title, department, location, outlet_id, outlet_name,
      experience, job_type, salary_range, short_description,
      responsibilities, requirements, benefits,
      status, is_featured, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const result = await executeQuery(`
      INSERT INTO career_jobs
        (title, department, location, outlet_id, outlet_name, experience, job_type,
         salary_range, short_description, responsibilities, requirements, benefits,
         status, is_featured, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      title, department || null, location || 'Bangalore',
      outlet_id || null, outlet_name || null,
      experience || null, job_type || 'Full-time',
      salary_range || null, short_description || null,
      responsibilities || null, requirements || null, benefits || null,
      status || 'active', is_featured ? 1 : 0, sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Job created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create career job error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM career_jobs WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });

    const {
      title, department, location, outlet_id, outlet_name,
      experience, job_type, salary_range, short_description,
      responsibilities, requirements, benefits,
      status, is_featured, sort_order
    } = req.body;

    await executeQuery(`
      UPDATE career_jobs SET
        title=?, department=?, location=?, outlet_id=?, outlet_name=?,
        experience=?, job_type=?, salary_range=?, short_description=?,
        responsibilities=?, requirements=?, benefits=?,
        status=?, is_featured=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [
      title || existing[0].title, department || null, location || 'Bangalore',
      outlet_id || null, outlet_name || null,
      experience || null, job_type || 'Full-time',
      salary_range || null, short_description || null,
      responsibilities || null, requirements || null, benefits || null,
      status || 'active', is_featured ? 1 : 0, sort_order || 0, id
    ]);

    res.json({ success: true, message: 'Job updated successfully' });
  } catch (error) {
    console.error('Update career job error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deleteJob = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM career_jobs WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Job not found' });
    await executeQuery('DELETE FROM career_jobs WHERE id=?', [id]);
    res.json({ success: true, message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete career job error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getAll, getActive, getById, create, update, deleteJob };
