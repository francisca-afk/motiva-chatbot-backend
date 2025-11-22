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

    console.log(business, "business created!")
    
    // Sync the business with the user
    console.log(user.business, "user.business")
    console.log(business._id, "business._id")

    console.log(user, "user ")
    
    if (!user.business || user.business === null) {
      console.log("user.business is null, updating user.business")
      user.business = business._id;
      await user.save();
      console.log(user, "user updated!")
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
    const updates = req.body; // name, sector, description, etc.
    
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