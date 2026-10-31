// Command hamster-chariot serves the game and its global high-score board.
package main

import (
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

//go:embed index.html style.css game.js assets
var static embed.FS

const (
	topN       = 5
	keepN      = 100
	maxNameLen = 16
	maxAgents  = 30
	maxSecs    = 3600
	// No run can earn more than this per second, even with a full fleet.
	maxScorePerSec = 5000 * 1024 // LGTMs double the burn rate, up to x1024
	postInterval   = 5 * time.Second
)

type entry struct {
	Name   string    `json:"name"`
	Score  int       `json:"score"`
	Agents int       `json:"agents"`
	Secs   float64   `json:"secs"`
	At     time.Time `json:"at"`
}

type board struct {
	mu       sync.Mutex
	path     string
	entries  []entry
	lastPost map[string]time.Time
}

func loadBoard(path string) (*board, error) {
	b := &board{path: path, lastPost: map[string]time.Time{}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return b, nil
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, &b.entries); err != nil {
		return nil, err
	}
	b.sort()
	return b, nil
}

func (b *board) sort() {
	sort.SliceStable(b.entries, func(i, j int) bool { return b.entries[i].Score > b.entries[j].Score })
}

func (b *board) top() []entry {
	n := min(topN, len(b.entries))
	return append([]entry{}, b.entries[:n]...)
}

func (b *board) save() error {
	data, err := json.MarshalIndent(b.entries, "", "  ")
	if err != nil {
		return err
	}
	tmp := b.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, b.path)
}

func cleanName(s string) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			return -1
		}
		return r
	}, s)
	s = strings.Join(strings.Fields(s), " ")
	if r := []rune(s); len(r) > maxNameLen {
		s = strings.TrimSpace(string(r[:maxNameLen]))
	}
	return s
}

func (e *entry) validate() error {
	e.Name = cleanName(e.Name)
	switch {
	case e.Name == "":
		return errors.New("name is required")
	case e.Agents < 1 || e.Agents > maxAgents:
		return errors.New("agents out of range")
	case e.Secs <= 0 || e.Secs > maxSecs:
		return errors.New("secs out of range")
	case e.Score < 1 || float64(e.Score) > (e.Secs+1)*maxScorePerSec:
		return errors.New("score out of range")
	}
	return nil
}

// trustProxy makes the rate limit key on X-Forwarded-For, which clients can set themselves.
var trustProxy bool

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); trustProxy && fwd != "" {
		return strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(v)
}

func (b *board) handleGet(w http.ResponseWriter, _ *http.Request) {
	b.mu.Lock()
	defer b.mu.Unlock()
	writeJSON(w, b.top())
}

func (b *board) handlePost(w http.ResponseWriter, r *http.Request) {
	var e entry
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	if err := dec.Decode(&e); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := e.validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	e.At = time.Now().UTC()

	b.mu.Lock()
	defer b.mu.Unlock()
	ip := clientIP(r)
	if last, ok := b.lastPost[ip]; ok && time.Since(last) < postInterval {
		http.Error(w, "too many scores, wait a few seconds", http.StatusTooManyRequests)
		return
	}
	b.lastPost[ip] = e.At

	b.entries = append(b.entries, e)
	b.sort()
	if len(b.entries) > keepN {
		b.entries = b.entries[:keepN]
	}
	if err := b.save(); err != nil {
		log.Printf("save scores: %v", err)
		http.Error(w, "could not save score", http.StatusInternalServerError)
		return
	}
	writeJSON(w, b.top())
}

// cacheHeaders makes browsers re-fetch the page itself every time (so a deploy shows up straight
// away), while letting them keep the images, sounds and music for an hour.
func cacheHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	data := flag.String("scores", "scores.json", "high-score file")
	flag.BoolVar(&trustProxy, "behind-proxy", false, "use X-Forwarded-For for the client address")
	password := flag.String("password", os.Getenv("HAMSTER_PASSWORD"), "password to play, case-insensitive (empty: no password)")
	flag.Parse()

	if err := os.MkdirAll(filepath.Dir(*data), 0o755); err != nil {
		log.Fatal(err)
	}
	b, err := loadBoard(*data)
	if err != nil {
		log.Fatalf("load scores: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/scores", b.handleGet)
	mux.HandleFunc("POST /api/scores", b.handlePost)
	mux.Handle("GET /", cacheHeaders(http.FileServerFS(static)))

	srv := &http.Server{Addr: *addr, Handler: newGate(*password, mux), ReadHeaderTimeout: 5 * time.Second}
	log.Printf("Hamster Chariot on %s, scores in %s", *addr, *data)
	log.Fatal(srv.ListenAndServe())
}
