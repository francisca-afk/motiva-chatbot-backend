const express = require('express');
const router = express.Router();


router.get('/embed.js', (req, res) => {
  console.log('embed.js requested');

  const widgetUrl = process.env.WIDGET_URL;

  if (!widgetUrl) {
    console.error("❌ Missing WIDGET_URL env var");
  }

  const script = `
    (function() {
      const currentScript = document.currentScript;
      const businessId = currentScript.getAttribute('data-business-id');

      if (!businessId) {
        console.error('Motiva MX: businessId is required');
        return;
      }

      const SIZES = {
          closed: { width: '50px', height: '50px' },
          open: { width: '380px', height: '600px' },
          mobileOpen: { width: 'calc(100% - 40px)', height: '80dvh' }
      };

      const iframe = document.createElement('iframe');
      iframe.src = '${widgetUrl}/?businessId=' + businessId;

      iframe.setAttribute('allowTransparency', 'true');
      iframe.style.cssText = \`
          position: fixed;
          bottom: 20px;
          right: 20px;
          border: none;
          z-index: 2147483647;
          transition: width 0.3s ease, height 0.3s ease, box-shadow 0.3s ease;
          border-radius: 50%;
          overflow: hidden !important;
      \`;
        
      iframe.style.width = SIZES.closed.width;
      iframe.style.height = SIZES.closed.height;
      iframe.style.boxShadow = 'none';  

      const isMobile = () => window.innerWidth < 640;

      window.addEventListener('message', (event) => {
          // if (event.origin !== '${widgetUrl}') return;

          if (event.data && event.data.type === 'MOTIVA_WIDGET_RESIZE') {
              const isOpen = event.data.isOpen;

              if (isOpen) {
                  if (isMobile()) {
                      iframe.style.width = SIZES.mobileOpen.width;
                      iframe.style.height = SIZES.mobileOpen.height;
                      iframe.style.bottom = '0';
                      iframe.style.right = '0';
                      iframe.style.borderRadius = '20px';
                  } else {
                       // Desktop
                      iframe.style.width = SIZES.open.width;
                      iframe.style.height = SIZES.open.height;
                      iframe.style.bottom = '20px';
                      iframe.style.right = '20px';
                      iframe.style.borderRadius = '24px'; 
                      iframe.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)';
                  }
              } else {
                  iframe.style.width = SIZES.closed.width;
                  iframe.style.height = SIZES.closed.height;
                  iframe.style.bottom = '30px';
                  iframe.style.right = '30px';
                  iframe.style.borderRadius = '0';
                  iframe.style.background = 'transparent';
                  iframe.style.boxShadow = 'none';
                  iframe.style.borderRadius = '50%';
                  iframe.style.overflow = 'hidden';
                  iframe.style.overflowY = 'hidden';
                  iframe.style.overflowX = 'hidden';
              }
          }
      });

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