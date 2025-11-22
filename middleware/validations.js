exports.validateChatRequest = ({ businessId, message, visitorId }) => {
    if (!businessId) throw new Error('businessId is required');
    if (!message) throw new Error('message is required');
    if (!visitorId) throw new Error('visitorId is required');
  }