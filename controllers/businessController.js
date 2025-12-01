const Business = require('../models/Business');
const User = require('../models/User');

// Create a new business and link it to the authenticated user
exports.createBusiness = async (req, res) => {
  try {
    const { name, sector, description, website, logoUrl, businessEmail, alertEmail } = req.body;
    const { userId } = req.user;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create the business
    const business = await Business.create({
      name,
      sector,
      description,
      website,
      logoUrl,
      businessEmail,
      alertEmail,
      users: [userId],
    });

    // Sync the business with the user
    if (!user.business || user.business === null) {
      user.business = business._id;
      await user.save();
    }

    res.status(201).json({
      message: 'Business created and linked successfully',
      data: {
        business,
        user: {
          id: user._id,
          email: user.email,
          business: user.business,
        },
      },
    });

  } catch (error) {
    console.error('Error creating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getBusinessById = async (req, res) => {
  try {
    const { businessId } = req.params;
    const business = await Business.findById(businessId);
    if(!business) {
      return res.status(204).json({ message: 'No business found', data: [] });
    }
    res.status(200).json({ message: 'Business retrieved successfully', data: business });
  } catch (error) {
    console.error('Error getting business by id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getBusinessByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const business = await Business.find({ users: userId });
    if(!business) {
      return res.status(204).json({ message: 'No business found', data: null });
    }
    res.status(200).json({ message: 'Business retrieved successfully', data: business });
  } catch (error) {
    console.error('Error getting business by user id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const updates = req.body; 
    
    const business = await Business.findByIdAndUpdate(
      businessId, 
      updates, 
      { new: true, runValidators: true }
    );
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }
    
    res.status(200).json({ message: 'Business updated successfully', data: business });
  } catch (error) {
    console.error('Error updating business:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getBusinessChatbotSettings = async (req, res) => {
  try {
    const { businessId } = req.params;
    const business = await Business.findById(businessId);
    if(!business) {
      return res.status(204).json({ message: 'No business found', data: null });
    }
    res.status(200).json({ message: 'Business chatbot settings retrieved successfully', data: business.chatbotSettings });
  } catch (error) {
    console.error('Error getting business chatbot settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateBusinessTheme = async (req, res) => {
  try {
    const { businessId } = req.params;
    const  themeColors  = req.body;
    // Validate hex colors
    const hexRegex = /^#([0-9A-F]{6}|[0-9A-F]{8})$/i;
    if (!hexRegex.test(themeColors.primary) || 
        !hexRegex.test(themeColors.secondary) || 
        !hexRegex.test(themeColors.background) ||
        !hexRegex.test(themeColors.textMuted) ||
        !hexRegex.test(themeColors.text)) {
      return res.status(400).json({ error: 'Invalid color format' });
    }

    const business = await Business.findByIdAndUpdate(
      businessId,
      { 
        $set: { 
          'chatbotSettings.theme': {
            primary: themeColors.primary,
            secondary: themeColors.secondary,
            text: themeColors.text,
            background: themeColors.background,
            backgroundField: themeColors.backgroundField,
            textMuted: themeColors.textMuted,
            updatedAt: new Date()
          }
        }
      },
      { new: true }
    );
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json({ 
      success: true, 
      data: business.chatbotSettings.theme 
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
 exports.getBusinessTheme = async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const business = await Business.findById(businessId).select('chatbotSettings.theme');
    
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const theme = business.chatbotSettings?.theme || {
      primary: '#b9d825',
      secondary: '#7d3f97',
      background: '#f2f6f8e8',
      backgroundField: '#ffffff',
      textMuted: '#999999',
      text: '#646464',
      updatedAt: business.chatbotSettings?.theme?.updatedAt || new Date()
    };

    res.json({ data: theme });
  } catch (error) {
    console.error('Error fetching theme:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resetBusinessTheme = async (req, res) => {
  try {
    const { businessId } = req.params;

    let business = await Business.findByIdAndUpdate(
      businessId,
      { $unset: { "chatbotSettings.theme": "" } }, 
      { new: true }
    );

    business = await business.save();

    const theme = business.chatbotSettings.theme;
    console.log(theme, 'theme');

    res.json({ data: theme });
  } catch (error) {
    console.error('Error resetting theme:', error);
    res.status(500).json({ error: 'Server error' });
  }
};