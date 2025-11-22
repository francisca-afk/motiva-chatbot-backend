const Alert = require('../models/Alert');

exports.getAlerts = async (req, res) => {
  try {
  console.log('Getting alerts for business:', req.params);
  const { businessId } = req.params;
    const alerts = await Alert.find({ business: businessId });
    if (alerts.length === 0) {
      return res.status(204).json({ message: 'No alerts found for this business', data: [] });
    }
    res.status(200).json({ message: 'Alerts retrieved successfully', data: alerts  });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ message: 'Error getting alerts', error: error.message, success: false });
  }
}

exports.getAlertsBySession = async (req, res) => {
  try {
  const { sessionId } = req.params;
    const alerts = await Alert.find({ session: sessionId });
    if (alerts.length === 0) {
      return res.status(204).json({ message: 'No alerts found for this session', data: [] });
    }
    res.status(200).json({ message: 'Alerts retrieved successfully', data:  alerts  });
  } catch (error) {
    console.error('Error getting alerts by session:', error);
    res.status(500).json({ message: 'Error getting alerts by session', error: error.message, success: false });
  }
}

exports.getAlertById = async (req, res) => {
  try {
    const { alertId } = req.params;
    if (!alertId) {
      return res.status(400).json({ message: 'Alert ID is required', data: null });
    }
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found', data: null });
    }
    res.status(200).json({ message: 'Alert retrieved successfully', data: alert });
  }
  catch (error) {
    console.error('Error getting alert by id:', error);
    res.status(500).json({ message: 'Error getting alert by id', error: error.message });
  }
}

exports.markAlertAsRead = async (req, res) => {
  try {
    const { alertId } = req.params;
    if (!alertId) {
      return res.status(400).json({ message: 'Alert ID is required', data: null });
    }
    const { userId } = req.user;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required', data: null });
    }
    const alert = await Alert.findByIdAndUpdate(alertId, { status: 'read', readBy: userId, readAt: new Date() });
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found', data: null });
    }
    res.status(200).json({ message: 'Alert marked as read', data: alert });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ message: 'Error marking alert as read', error: error.message });
  }
}

exports.markAlertAsResolved = async (req, res) => {
  try {
    const { alertId } = req.params;
    if (!alertId) {
      return res.status(400).json({ message: 'Alert ID is required', data: null });
    }
    const { userId } = req.user;
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required', data: null });
    }
    const alert = await Alert.findByIdAndUpdate(alertId, { status: 'resolved', resolvedBy: userId, resolvedAt: new Date() });
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found', data: null });
    }
    res.status(200).json({ message: 'Alert marked as resolved', data: alert });
  } catch (error) {
    console.error('Error marking alert as resolved:', error);
    res.status(500).json({ message: 'Error marking alert as resolved', error: error.message });
  }
}