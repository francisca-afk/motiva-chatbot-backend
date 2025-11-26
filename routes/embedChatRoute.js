const express = require('express');
const router = express.Router();


router.get('/embed.js', (req, res) => {
    console.log('embed.js requested');
  
    const widgetUrl = process.env.WIDGET_URL || "http://localhost:3000"; 
  
    const script = `
      (function() {
        const currentScript = document.currentScript;
        const businessId = currentScript.getAttribute('data-business-id');
  
        if (!businessId) {
          console.error('Motiva MX: businessId is required');
          return;
        }
  
        const iframe = document.createElement('iframe');
        iframe.src = '${widgetUrl}/?businessId=' + businessId;
        iframe.style.cssText = 'position:fixed;bottom:20px;right:20px;width:400px;height:600px;border:none;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:9999;';
  
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => document.body.appendChild(iframe));
        } else {
          document.body.appendChild(iframe);
        }
  
      })();
    `;
  
    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
});

module.exports = router;