package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"html/template"
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	gateCookie = "hamster_pass"
	// Each address gets one password try per loginInterval, right or wrong.
	loginInterval = 2 * time.Second
)

// gate puts a shared password in front of everything. The password is compared
// case-insensitively, and the cookie holds a hash of it, so it survives restarts
// and changing the password logs everyone out. An empty password turns the gate off.
type gate struct {
	password string
	token    string
	next     http.Handler

	mu        sync.Mutex
	lastTry   map[string]time.Time
	lastPrune time.Time
}

// gateView is what the password page shows: a message, and how long the
// Let me in button stays disabled (counted down in the browser).
type gateView struct {
	Msg    string
	WaitMs int64
}

func newGate(password string, next http.Handler) http.Handler {
	if password == "" {
		return next
	}
	sum := sha256.Sum256([]byte("hamster-chariot:" + strings.ToLower(password)))
	return &gate{password: password, token: hex.EncodeToString(sum[:]), next: next, lastTry: map[string]time.Time{}}
}

func (g *gate) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/login" && r.Method == http.MethodPost {
		g.login(w, r)
		return
	}
	if c, err := r.Cookie(gateCookie); err == nil && subtle.ConstantTimeCompare([]byte(c.Value), []byte(g.token)) == 1 {
		g.next.ServeHTTP(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		http.Error(w, "password required", http.StatusUnauthorized)
		return
	}
	g.page(w, http.StatusUnauthorized, gateView{})
}

// allowTry records a password try from ip, or reports how long it must still wait.
func (g *gate) allowTry(ip string, now time.Time) (wait time.Duration) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if now.Sub(g.lastPrune) > time.Minute {
		for k, t := range g.lastTry {
			if now.Sub(t) >= loginInterval {
				delete(g.lastTry, k)
			}
		}
		g.lastPrune = now
	}
	if last, ok := g.lastTry[ip]; ok && now.Sub(last) < loginInterval {
		return loginInterval - now.Sub(last)
	}
	g.lastTry[ip] = now
	return 0
}

func (g *gate) login(w http.ResponseWriter, r *http.Request) {
	if wait := g.allowTry(clientIP(r), time.Now()); wait > 0 {
		w.Header().Set("Retry-After", "2")
		g.page(w, http.StatusTooManyRequests, gateView{"Too fast. One try every 2 seconds.", wait.Milliseconds()})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	if !strings.EqualFold(strings.TrimSpace(r.PostFormValue("password")), g.password) {
		g.page(w, http.StatusUnauthorized, gateView{"Wrong password, try again.", loginInterval.Milliseconds()})
		return
	}
	// No Path: the browser scopes it to wherever the game is mounted (e.g. /hamster).
	http.SetCookie(w, &http.Cookie{
		Name: gateCookie, Value: g.token, MaxAge: 30 * 24 * 3600,
		HttpOnly: true, Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})
	// Set by hand: http.Redirect would resolve "./" against the proxy-stripped path
	// ("/login" -> "/"), while the browser resolves it against /hamster/login.
	w.Header().Set("Location", "./")
	w.WriteHeader(http.StatusSeeOther)
}

func (g *gate) page(w http.ResponseWriter, code int, v gateView) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = gatePage.Execute(w, v)
}

var gatePage = template.Must(template.New("gate").Parse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hamster Chariot</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: linear-gradient(#fbe3c8, #f5cfa6);
         font-family: ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif; color: #2b1d14; padding: 16px; box-sizing: border-box; }
  form { background: #f7efe4; border: 4px solid #2b1d14; border-radius: 18px; padding: 26px 32px; box-shadow: 0 8px 0 #2b1d14;
         text-align: center; max-width: 340px; width: 100%; box-sizing: border-box; }
  h1 { margin: 0 0 6px; font-size: 30px; }
  p { margin: 6px 0 14px; }
  input { font: inherit; font-size: 18px; width: 100%; box-sizing: border-box; padding: 10px 12px; border: 3px solid #2b1d14; border-radius: 10px; }
  button { margin-top: 12px; font: inherit; font-weight: 800; font-size: 18px; color: #f7efe4; background: #d97757;
           border: 3px solid #2b1d14; border-radius: 12px; padding: 10px 24px; box-shadow: 0 4px 0 #2b1d14; cursor: pointer; }
  button:disabled { opacity: .55; cursor: wait; }
  .wrong { color: #b85a3c; font-weight: 800; }
  .timer { font-size: 14px; min-height: 1.3em; margin: 10px 0 0; }
</style></head>
<body><form method="post" action="login">
  <h1>🐹 Hamster Chariot</h1>
  <p>{{if .Msg}}<span class="wrong">{{.Msg}}</span>{{else}}Password, please.{{end}}</p>
  <input type="password" name="password" autofocus autocomplete="current-password" aria-label="Password">
  <button type="submit" id="go">Let me in</button>
  <p class="timer" id="timer" aria-live="polite"></p>
</form>
<script>
  // Hold the button until the server will take another try.
  const until = Date.now() + {{.WaitMs}}, btn = document.getElementById('go'), timer = document.getElementById('timer');
  (function tick() {
    const left = until - Date.now();
    btn.disabled = left > 0;
    timer.textContent = left > 0 ? 'Next try in ' + (left / 1000).toFixed(1) + 's' : '';
    if (left > 0) setTimeout(tick, 100);
  })();
</script></body></html>
`))
