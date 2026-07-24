const { executeQuery } = require('../config/database');

// Get all settings
const getAllSettings = async (req, res) => {
  try {
    const settings = await executeQuery(
      'SELECT * FROM settings ORDER BY category ASC, key ASC'
    );
    
    // Group settings by category
    const groupedSettings = {};
    settings.forEach(setting => {
      if (!groupedSettings[setting.category]) {
        groupedSettings[setting.category] = [];
      }
      groupedSettings[setting.category].push({
        key: setting.key,
        value: setting.value,
        type: setting.type,
        description: setting.description
      });
    });
    
    res.json({
      success: true,
      data: groupedSettings
    });
    
  } catch (error) {
    console.error('Get all settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get setting by key
const getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;
    
    const setting = await executeQuery(
      'SELECT * FROM settings WHERE key = ?',
      [key]
    );
    
    if (setting.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    res.json({
      success: true,
      data: setting[0]
    });
    
  } catch (error) {
    console.error('Get setting by key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update setting
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Value is required'
      });
    }
    
    // Check if setting exists
    const existingSetting = await executeQuery(
      'SELECT id FROM settings WHERE key = ?',
      [key]
    );
    
    if (existingSetting.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    await executeQuery(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, key]
    );
    
    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
    
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update multiple settings
const updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        success: false,
        message: 'Settings array is required'
      });
    }
    
    const updatePromises = settings.map(async (setting) => {
      if (!setting.key || setting.value === undefined) {
        throw new Error('Each setting must have key and value');
      }
      
      await executeQuery(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [setting.value, setting.key]
      );
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `${settings.length} settings updated successfully`
    });
    
  } catch (error) {
    console.error('Update multiple settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get public settings (for frontend)
const getPublicSettings = async (req, res) => {
  try {
    const publicSettings = await executeQuery(
      'SELECT key, value FROM settings WHERE is_public = ? ORDER BY category ASC, key ASC',
      [true]
    );
    
    // Convert to key-value object
    const settingsObject = {};
    publicSettings.forEach(setting => {
      // Parse JSON values if needed
      try {
        settingsObject[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsObject[setting.key] = setting.value;
      }
    });
    
    res.json({
      success: true,
      data: settingsObject
    });
    
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reset setting to default
const resetSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    // Check if setting exists
    const existingSetting = await executeQuery(
      'SELECT id, default_value FROM settings WHERE key = ?',
      [key]
    );
    
    if (existingSetting.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }
    
    if (!existingSetting[0].default_value) {
      return res.status(400).json({
        success: false,
        message: 'This setting does not have a default value'
      });
    }
    
    await executeQuery(
      'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [existingSetting[0].default_value, key]
    );
    
    res.json({
      success: true,
      message: 'Setting reset to default value successfully'
    });
    
  } catch (error) {
    console.error('Reset setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export settings
const exportSettings = async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = 'SELECT * FROM settings';
    const params = [];
    
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY category ASC, key ASC';
    
    const settings = await executeQuery(query, params);
    
    // Convert to export format
    const exportData = {
      exported_at: new Date().toISOString(),
      settings: settings.map(setting => ({
        key: setting.key,
        value: setting.value,
        category: setting.category,
        type: setting.type,
        description: setting.description
      }))
    };
    
    res.json({
      success: true,
      data: exportData
    });
    
  } catch (error) {
    console.error('Export settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  updateMultipleSettings,
  getPublicSettings,
  resetSetting,
  exportSettings
};
