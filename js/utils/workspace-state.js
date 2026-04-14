// Workspace state utility - can be used from any page

/**
 * Go back to planner using browser history
 * This preserves the page state and keeps items in the workspace
 */
function goBackToPlanner() {
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage(
        { type: "planner-dashboard-close" },
        window.location.origin,
      );
    } catch (error) {
      console.warn("Unable to notify parent dashboard overlay:", error);
    }
    return;
  }

  // Save state using collectRoomPlanData if available (best UX)
  if (typeof collectRoomPlanData === "function") {
    try {
      const roomPlanData = collectRoomPlanData();
      localStorage.setItem(
        "currentRoomState",
        JSON.stringify({
          ...roomPlanData,
          costState:
            typeof costState !== "undefined"
              ? costState
              : { items: {}, total: 0 },
          furnitureCounter:
            typeof furnitureCounter !== "undefined" ? furnitureCounter : 0,
        }),
      );
      console.log(
        "Room state saved before navigation using collectRoomPlanData",
      );
    } catch (error) {
      console.error("Error saving room state before navigation:", error);
    }
  } else if (typeof window.saveWorkspaceState === "function") {
    // Fallback to saveWorkspaceState
    try {
      window.saveWorkspaceState();
      console.log("Workspace state saved before navigation");
    } catch (error) {
      console.error("Error saving workspace state before navigation:", error);
    }
  }

  // Mark that we are intentionally returning to planner, so planner can
  // use a fast restore path instead of a full cold boot.
  try {
    sessionStorage.setItem("plannerReturnIntent", Date.now().toString());
  } catch (error) {
    console.warn("Unable to set plannerReturnIntent flag:", error);
  }

  // Use history back only when coming directly from planner.
  // This preserves bfcache state when possible; otherwise go straight to planner.
  const referrerIsPlanner = /(?:^|\/)planner\.html(?:[?#]|$)/i.test(
    document.referrer || "",
  );

  if (referrerIsPlanner && window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = "planner.html";
}

// Expose globally
window.goBackToPlanner = goBackToPlanner;
