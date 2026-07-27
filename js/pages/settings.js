// js/pages/settings.js
import { onAuthReady, updateOwnPreferences } from "../firebase/auth.js";
import { renderShell, setTopbarClockVisible } from "../components/navbar.js";
import { showToast } from "../components/toast.js";

onAuthReady((user, profile) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  renderShell("settings.html", profile);
  init(profile);
});

function init(profile) {
  const toggle = document.getElementById("show-clock-toggle");
  // Default is "on" — only an explicit false in the user's saved preferences turns it off.
  toggle.checked = profile?.preferences?.showClock !== false;

  toggle.addEventListener("change", async () => {
    const showClock = toggle.checked;
    setTopbarClockVisible(showClock); // instant feedback on this page's own top bar
    try {
      await updateOwnPreferences({ showClock });
      showToast(showClock ? "Clock will show on every page." : "Clock hidden on every page.", "success");
    } catch (err) {
      toggle.checked = !showClock; // revert on failure
      setTopbarClockVisible(!showClock);
      showToast(err.message || "Failed to save setting.", "error");
    }
  });
}
