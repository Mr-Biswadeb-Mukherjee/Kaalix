package plugins

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type GoogleCollector struct {
	apiKey string
	client *http.Client
}

func NewGoogleCollector() *GoogleCollector {
	return &GoogleCollector{
		apiKey: os.Getenv("SERPAPI_KEY"),
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (g *GoogleCollector) Name() string {
	return "google_search"
}

func (g *GoogleCollector) InputTypes() []string {
	return []string{"query", "username"}
}

func (g *GoogleCollector) Run(node Node) (*Result, error) {
	links, err := g.search(node.Value)
	if err != nil {
		return nil, err
	}

	graph := &Result{}
	graph.Nodes = append(graph.Nodes, node)

	for i, link := range links {
		id := fmt.Sprintf("google_result_%d", i)

		graph.Nodes = append(graph.Nodes, Node{
			ID:    id,
			Type:  "url",
			Value: link,
		})

		graph.Edges = append(graph.Edges, Edge{
			From: node.ID,
			To:   id,
			Type: "search_result",
		})
	}

	return graph, nil
}

func (g *GoogleCollector) search(query string) ([]string, error) {
	values := url.Values{}
	values.Set("engine", "google")
	values.Set("q", query)
	values.Set("hl", "en")
	values.Set("gl", "us")
	values.Set("google_domain", "google.com")
	values.Set("api_key", g.apiKey)

	endpoint := "https://serpapi.com/search.json?" + values.Encode()
	resp, err := g.client.Get(endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("serpapi request failed: %s", strings.TrimSpace(string(body)))
	}

	var parsed struct {
		OrganicResults []struct {
			Link string `json:"link"`
		} `json:"organic_results"`
	}

	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	links := make([]string, 0, len(parsed.OrganicResults))
	for _, item := range parsed.OrganicResults {
		if item.Link == "" {
			continue
		}
		links = append(links, item.Link)
	}

	return links, nil
}

func init() {
	if os.Getenv("SERPAPI_KEY") == "" {
		log.Println("[plugin] google skipped (SERPAPI_KEY missing)")
		return
	}

	log.Println("[plugin] google registered")
	RegisterCollector(NewGoogleCollector())
}
