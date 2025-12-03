// Definition of system permissions
const PERMISSIONS = {
    VIEW_DASHBOARD: "view_dashboard",
  
    VIEW_CONVERSATIONS: "view_conversations",
    REPLY_CONVERSATIONS: "reply_conversations",
  
    VIEW_ALERTS: "view_alerts",
  
    VIEW_KB: "view_kb",
    EDIT_KB: "edit_kb",
  
    VIEW_SETTINGS: "view_settings",
    EDIT_BUSINESS_SETTINGS: "edit_business_settings",
    MANAGE_USERS: "manage_users",
    // VIEW_ANALYTICS: "view_analytics",
  };

  //Roles and permissions
    const ROLES = {
    owner: [
      PERMISSIONS.VIEW_DASHBOARD,
  
      PERMISSIONS.VIEW_CONVERSATIONS,
      PERMISSIONS.REPLY_CONVERSATIONS,
  
      PERMISSIONS.VIEW_ALERTS,
  
      PERMISSIONS.VIEW_KB,
      PERMISSIONS.EDIT_KB,
  
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.EDIT_BUSINESS_SETTINGS,
      PERMISSIONS.MANAGE_USERS,
    ],
  
    admin: [
      PERMISSIONS.VIEW_DASHBOARD,
  
      PERMISSIONS.VIEW_CONVERSATIONS,
      PERMISSIONS.REPLY_CONVERSATIONS,
  
      PERMISSIONS.VIEW_ALERTS,
  
      PERMISSIONS.VIEW_KB,
      PERMISSIONS.EDIT_KB,
  
      PERMISSIONS.VIEW_SETTINGS,
      PERMISSIONS.EDIT_BUSINESS_SETTINGS,
    ],
  
    chatRep: [
      PERMISSIONS.VIEW_DASHBOARD,
  
      PERMISSIONS.VIEW_CONVERSATIONS,
      PERMISSIONS.REPLY_CONVERSATIONS,
    ],
  };

  module.exports = { PERMISSIONS, ROLES };