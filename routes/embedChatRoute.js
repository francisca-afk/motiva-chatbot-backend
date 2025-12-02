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

      const iframe = document.createElement('iframe');
      iframe.src = '${widgetUrl}/?businessId=' + businessId;

      iframe.setAttribute('allowTransparency', 'true');
      iframe.style.cssText = \`
          position: fixed;
          bottom: 20px;
          right: 20px;
          border: none;
          width: 3.5rem; 
          height: 3.5rem; 
          z-index: 2147483647;
          transition: width 0.3s ease, height 0.3s ease, box-shadow 0.3s ease;
          border-radius: 50%;
          overflow: hidden !important;
      \`;
      

      const isMobile = () => window.matchMedia("(max-width: 600px)").matches;

      let isOpenState = false;

      window.addEventListener('message', (event) => {
          // if (event.origin !== '${widgetUrl}') return;

          
          if (event.data && event.data.type === 'MOTIVA_WIDGET_RESIZE') {
              const isOpen = event.data.isOpen;
              isOpenState = isOpen;

              if (isOpen) {
                  if (isMobile()) {
                      iframe.style.width = "80vw";
                      iframe.style.height = "90vh";
                      iframe.style.bottom = '0';
                      iframe.style.right = '0';
                      iframe.style.borderRadius = '20px';
                      iframe.style.boxShadow = "0 0 20px rgba(0,0,0,0.25)";
                  } else {
                       // Desktop
                      iframe.style.width = "min(90vw, clamp(320px, 45vw, 420px))";
                      iframe.style.height = "min(95vh, clamp(480px, 70vh, 640px))";
                      iframe.style.right = "1.5rem";
                      iframe.style.bottom = "1.5rem";
                      iframe.style.borderRadius = '24px'; 
                      iframe.style.boxShadow = '0 12px 40px rgba(0,0,0,0.18)';
                  }
              } else {
                  iframe.style.width = '50px';
                  iframe.style.height = '50px';
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

      // Close the widget if the user clicks outside of it
      document.addEventListener("click", (e) => {
        if (!isOpenState) return;

        const rect = iframe.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (!inside) {
          console.log('Closing the widget');
          iframe.contentWindow.postMessage(
            { type: "MOTIVA_FORCE_CLOSE" },
            "*"
          );
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