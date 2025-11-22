const SEVERITY = {
    NONE: "none",
    LOW_MOOD: "lowMood",
    UNRESOLVED: "unresolved",
    CRITICAL: "critical"
};
  
const COOLDOWNS = {
    lowMood: 90 * 1000,        // 1.5 min
    unresolved: 150 * 1000,    // 2.5 min
    critical: 8 * 60 * 1000    // 8 min (email throttle)
}
  
function computeAlertDecision(flags, sessionState) {
  const { isLowMood, aiUnresolved, isGatheringInfo } = flags;

  // if the AI is gathering info, do not consider as unresolved yet
  if (isGatheringInfo) {
    return {
      severity: SEVERITY.NONE,
      shouldSendAlert: false,
      shouldSendEmail: false,
      shouldCreateCase: false,
      throttled: false
    };
  }

  // determine severity
  let severity = SEVERITY.NONE;

  if (aiUnresolved && isLowMood) severity = SEVERITY.CRITICAL;
  else if (aiUnresolved) severity = SEVERITY.UNRESOLVED;
  else if (isLowMood) severity = SEVERITY.LOW_MOOD;

  if (severity === SEVERITY.NONE) {
    return {
      severity,
      shouldSendAlert: false,
      shouldSendEmail: false,
      shouldCreateCase: false,
      throttled: false
    };
  }

  // cooldowns (to avoid spam)
  const lastType = sessionState?.lastAlertType;
  const lastTime = sessionState?.lastAlertTimestamp;
  let throttled = false;

  if (lastType === severity && lastTime) {
    const cooldown = COOLDOWNS[severity];
    if (Date.now() - lastTime.getTime() < cooldown) {
      throttled = true;
    }
  }

  let shouldSendEmail = false;
  let shouldCreateCase = false;

  if (severity === SEVERITY.CRITICAL) {
    // Prevent multiple cases in the same session
    if (!sessionState.hasOpenCase) {
      shouldCreateCase = true;
    }

    // Email only the first time
    shouldSendEmail = sessionState?.emailSent ? false : true;
  }

  const shouldSendAlert = !throttled;

  return {
    severity,
    shouldSendAlert,
    shouldSendEmail,
    shouldCreateCase,
    throttled
  };
}

module.exports = { computeAlertDecision, SEVERITY };
  
  