package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestBoard(t *testing.T) *board {
	t.Helper()
	b, err := loadBoard(filepath.Join(t.TempDir(), "scores.json"))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func post(b *board, ip, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/api/scores", strings.NewReader(body))
	r.RemoteAddr = ip + ":1234"
	w := httptest.NewRecorder()
	b.handlePost(w, r)
	return w
}

func TestPostAndReload(t *testing.T) {
	b := newTestBoard(t)
	if w := post(b, "1.1.1.1", `{"name":"  Hammy\u0007 ","score":500,"agents":3,"secs":20}`); w.Code != http.StatusOK {
		t.Fatalf("post: %d %s", w.Code, w.Body)
	}
	if w := post(b, "2.2.2.2", `{"name":"Pip","score":900,"agents":4,"secs":30}`); w.Code != http.StatusOK {
		t.Fatalf("post: %d %s", w.Code, w.Body)
	}
	reloaded, err := loadBoard(b.path)
	if err != nil {
		t.Fatal(err)
	}
	top := reloaded.top()
	if len(top) != 2 || top[0].Name != "Pip" || top[1].Name != "Hammy" {
		t.Fatalf("unexpected board: %+v", top)
	}
}

func TestRejectsBadScores(t *testing.T) {
	b := newTestBoard(t)
	for i, body := range []string{
		`{"name":"","score":10,"agents":1,"secs":5}`,
		`{"name":"x","score":0,"agents":1,"secs":5}`,
		`{"name":"x","score":10,"agents":99,"secs":5}`,
		`{"name":"x","score":99999999,"agents":30,"secs":5}`,
		`not json`,
	} {
		if w := post(b, "3.3.3."+string(rune('0'+i)), body); w.Code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", body, w.Code)
		}
	}
}

func TestRateLimit(t *testing.T) {
	b := newTestBoard(t)
	body := `{"name":"x","score":10,"agents":1,"secs":5}`
	post(b, "4.4.4.4", body)
	if w := post(b, "4.4.4.4", body); w.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", w.Code)
	}
}

func TestNameTruncated(t *testing.T) {
	if got := cleanName("abcdefghijklmnopqrstuvwxyz"); got != "abcdefghijklmnop" {
		t.Fatalf("got %q", got)
	}
}

func TestGate(t *testing.T) {
	h := newGate("sesame", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("game")) }))
	get := func(path string, c *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		if c != nil {
			r.AddCookie(c)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := get("/", nil); w.Code != http.StatusUnauthorized || !strings.Contains(w.Body.String(), "password") {
		t.Fatalf("no cookie: %d", w.Code)
	}
	if w := get("/api/scores", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("api without cookie: %d", w.Code)
	}
	n := 0
	login := func(pw string) *httptest.ResponseRecorder {
		n++ // a fresh address each time, so the rate limit stays out of the way
		r := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader("password="+pw))
		r.RemoteAddr = fmt.Sprintf("10.0.0.%d:1234", n)
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := login("berlin"); w.Code != http.StatusUnauthorized || len(w.Result().Cookies()) != 0 {
		t.Fatalf("wrong password: %d", w.Code)
	}
	for _, pw := range []string{"sesame", "Sesame", "SESAME"} {
		w := login(pw)
		if w.Code != http.StatusSeeOther || len(w.Result().Cookies()) != 1 {
			t.Fatalf("%s: %d", pw, w.Code)
		}
		if g := get("/", w.Result().Cookies()[0]); g.Body.String() != "game" {
			t.Fatalf("%s: cookie not accepted", pw)
		}
	}
}

func TestGateRateLimit(t *testing.T) {
	g := newGate("sesame", http.NotFoundHandler()).(*gate)
	now := time.Now()
	if wait := g.allowTry("5.5.5.5", now); wait != 0 {
		t.Fatalf("first try waited %v", wait)
	}
	if wait := g.allowTry("5.5.5.5", now.Add(500*time.Millisecond)); wait != 1500*time.Millisecond {
		t.Fatalf("second try: wait %v, want 1.5s", wait)
	}
	if wait := g.allowTry("6.6.6.6", now.Add(500*time.Millisecond)); wait != 0 {
		t.Fatalf("other address waited %v", wait)
	}
	if wait := g.allowTry("5.5.5.5", now.Add(loginInterval)); wait != 0 {
		t.Fatalf("after the interval: wait %v", wait)
	}

	// Through HTTP: a second try within 2s is refused before the password is even checked.
	try := func(pw string) int {
		r := httptest.NewRequest(http.MethodPost, "/login", strings.NewReader("password="+pw))
		r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		r.RemoteAddr = "7.7.7.7:1234"
		w := httptest.NewRecorder()
		g.ServeHTTP(w, r)
		return w.Code
	}
	if c := try("berlin"); c != http.StatusUnauthorized {
		t.Fatalf("wrong password: %d", c)
	}
	if c := try("sesame"); c != http.StatusTooManyRequests {
		t.Fatalf("immediate retry: %d, want 429", c)
	}
}

func TestCacheHeaders(t *testing.T) {
	h := cacheHeaders(http.FileServerFS(static))
	for path, want := range map[string]string{"/": "no-cache", "/assets/shipitparrot.gif": "public, max-age=3600"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if got := w.Header().Get("Cache-Control"); got != want || w.Code != http.StatusOK {
			t.Errorf("%s: %d Cache-Control %q, want 200 %q", path, w.Code, got, want)
		}
	}
}
