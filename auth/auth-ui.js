// ====================== Authentication UI =========================
//
// Shared helpers for the auth pages plus the signed-in/signed-out state in the
// calculator's nav row. Kept separate from auth.js so the logic can be reused
// or tested without the DOM pieces.

// All user-supplied text goes through this before touching innerHTML.
function authEsc(s) {
	return String(s === null || s === undefined ? "" : s)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// ---- form feedback ----------------------------------------------------

function authShowMessage(id, text, kind) {
	var el = document.getElementById(id)
	if (el === null) return
	el.className = "authMsg authMsg-" + (kind || "error")
	el.innerHTML = authEsc(text)
	el.classList.remove("hideValue")
}

function authClearMessage(id) {
	var el = document.getElementById(id)
	if (el === null) return
	el.innerHTML = ""
	el.classList.add("hideValue")
}

function authSetLoading(btnId, loading, idleLabel) {
	var btn = document.getElementById(btnId)
	if (btn === null) return
	btn.disabled = !!loading
	if (loading) {
		btn.dataset.idle = btn.dataset.idle || btn.value || btn.textContent
		var label = '<span class="authSpinner"></span>Working…'
		if (btn.tagName === "BUTTON") btn.innerHTML = label; else btn.value = "Working…"
	} else {
		var back = idleLabel || btn.dataset.idle || "Continue"
		if (btn.tagName === "BUTTON") btn.textContent = back; else btn.value = back
	}
}

function authFieldError(fieldId, text) {
	var el = document.getElementById(fieldId + "Err")
	var input = document.getElementById(fieldId)
	if (el !== null) {
		el.textContent = text || ""
		el.classList.toggle("hideValue", !text)
	}
	if (input !== null) input.classList.toggle("authInputBad", !!text)
}

function authClearFieldErrors(ids) {
	for (var i = 0; i < ids.length; i++) authFieldError(ids[i], "")
}

// ---- nav state --------------------------------------------------------

// Rendered into #authNavArea, which the auth pages and the calculator share.
function renderAuthNav() {
	var area = document.getElementById("authNavArea")
	if (area === null) return

	if (!authIsConfigured()) {
		area.innerHTML = '<span class="authNavNote" title="Add your project URL and anon key in auth/supabase-config.js">Auth not configured</span>'
		return
	}

	var o = ""
	if (authUser === null) {
		// One way in, not two. Login is the door; the sign-in page carries its own
		// "No account yet? Create one", so nobody without an account is stuck -
		// and the pair side by side made a visitor choose before they had any
		// reason to care which one they were.
		o += '<a class="authNavLink authNavPrimary" href="login.html">Login</a>'
	} else {
		// On the calculator the name opens the profile panel in place. On the
		// auth pages there is no panel to open, so it stays a link to the full
		// profile page.
		var avatar = authAvatarUrl()
		var inApp = (typeof toggleProfileMenu === "function")
		o += inApp
			? '<a class="authNavUser" href="#" title="Your profile" onclick="event.preventDefault();toggleProfileMenu()">'
			: '<a class="authNavUser" href="profile.html?stay=1" title="Your profile">'
		if (avatar) o += '<img class="authNavAvatar" src="' + authEsc(avatar) + '" alt="">'
		else o += '<span class="authNavAvatar authNavAvatarFallback">' + authEsc(authDisplayName().charAt(0).toUpperCase()) + '</span>'
		o += '<span class="authNavName">' + authEsc(authDisplayName()) + '</span>'
		o += '</a>'
		// A member reload restores account-backed history, so it cannot also be the
		// way to start with an empty table. Keep this explicit destructive action
		// on the calculator only; its handler requires a second deliberate click.
		if (inApp) {
			o += '<a class="authNavLink authNavHistoryClear" href="#" title="Clear saved phrase history" aria-label="Clear saved phrase history" onclick="return authNavClearHistory(this,event)">&#8635; Clear</a>'
		}
		// only drawn for admins, and only as a shortcut - admin.html checks for
		// itself and every function it calls checks again in the database
		if (typeof adminIsAdmin !== "undefined" && adminIsAdmin === true) {
			o += '<a class="authNavLink authNavAdmin" href="admin.html" title="Admin panel">&#128737; Admin</a>'
		}
		o += '<a class="authNavLink" href="#" onclick="authNavSignOut(event)">Logout</a>'
	}
	area.innerHTML = o
}

function authNavClearHistory(el, e) {
	if (e) e.preventDefault()
	var confirmed = (typeof profileConfirmClick === "function")
		? profileConfirmClick(el, "Clear?")
		: window.confirm("Clear your saved phrase history?")
	if (!confirmed) return false

	// Never race an in-flight account restore: stale rows could arrive after the
	// clear and make it look as if the action failed.
	if (typeof histSyncLoaded !== "undefined" && histSyncLoaded !== true) {
		if (typeof displayCalcNotification === "function") displayCalcNotification("Wait for saved history to finish loading", 2600)
		return false
	}
	if (typeof histSyncSaving !== "undefined" && histSyncSaving === true) {
		if (typeof displayCalcNotification === "function") displayCalcNotification("Wait for saved history to finish saving", 2600)
		return false
	}

	if (typeof phraseBoxKeypress === "function") phraseBoxKeypress(36)
	if (typeof histSyncClearSaved === "function") {
		histSyncClearSaved().then(function () {
			if (typeof displayCalcNotification === "function") displayCalcNotification("Saved history cleared", 2200)
		}).catch(function () {
			if (typeof displayCalcNotification === "function") displayCalcNotification("History cleared here; saved copy could not be cleared", 3200)
		})
	} else if (typeof displayCalcNotification === "function") {
		displayCalcNotification("History cleared here; saved copy is unavailable", 3200)
	}
	return false
}

function authNavSignOut(e) {
	if (e) e.preventDefault()
	authSignOut().then(function () {
		renderAuthNav()
		// send the user somewhere public if they were on a gated page
		var page = window.location.pathname.split("/").pop()
		if (page === "profile.html") window.location.href = "login.html"
	})
}

$(document).ready(function () {
	onAuthReady(renderAuthNav)
})

// Flashes the back link green on click, matching the Find Matches tab, so the
// press registers before the navigation happens.
function authBackFlash(el) {
	if (!el) return
	el.classList.remove("authBackFlash")
	void el.offsetWidth // restart the animation rather than letting it no-op
	el.classList.add("authBackFlash")
}
