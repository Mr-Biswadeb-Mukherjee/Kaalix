package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	plugins "github.com/official-biswadeb941.com/KaaliX-Engine/Engine/plugin"
)

type collectorDescriptor struct {
	Name       string   `json:"name"`
	InputTypes []string `json:"inputTypes"`
}

type collectorRun struct {
	Name   string          `json:"name"`
	Status string          `json:"status"`
	Error  string          `json:"error,omitempty"`
	Result *plugins.Result `json:"result,omitempty"`
}

type engineOutput struct {
	Input       plugins.Node   `json:"input"`
	GeneratedAt string         `json:"generatedAt"`
	LatencyMs   int64          `json:"latencyMs"`
	Collectors  []collectorRun `json:"collectors"`
}

type collectorsOutput struct {
	GeneratedAt string                `json:"generatedAt"`
	Collectors  []collectorDescriptor `json:"collectors"`
}

func main() {
	listOnly := flag.Bool("list", false, "List available collectors")
	jsonOnly := flag.Bool("json", false, "Emit machine-readable JSON output")
	nodeType := flag.String("type", "query", "Input node type (e.g. query, username)")
	value := flag.String("value", "", "Input value to investigate")
	nodeID := flag.String("id", "seed-1", "Input node ID")
	flag.Parse()

	if *listOnly {
		if *jsonOnly {
			printCollectorsJSON()
			return
		}
		printCollectors()
		return
	}

	if strings.TrimSpace(*value) == "" && flag.NArg() > 0 {
		*value = strings.TrimSpace(strings.Join(flag.Args(), " "))
	}

	if strings.TrimSpace(*value) == "" {
		fmt.Fprintln(os.Stderr, "missing input value")
		fmt.Fprintln(os.Stderr, "usage: go run ./Engine -type query -value \"example\"")
		fmt.Fprintln(os.Stderr, "   or: go run ./Engine -type query \"example\"")
		os.Exit(2)
	}

	node := plugins.Node{
		ID:    *nodeID,
		Type:  strings.TrimSpace(*nodeType),
		Value: strings.TrimSpace(*value),
	}

	collectors := plugins.GetCollectorsFor(node.Type)
	if len(collectors) == 0 {
		if *jsonOnly {
			emitJSON(engineOutput{
				Input:       node,
				GeneratedAt: time.Now().UTC().Format(time.RFC3339),
				LatencyMs:   0,
				Collectors:  []collectorRun{},
			})
			return
		}
		fmt.Printf("No collectors available for input type %q\n", node.Type)
		fmt.Println("Use -list to inspect loaded collectors.")
		return
	}

	startedAt := time.Now()
	collectorRuns := make([]collectorRun, 0, len(collectors))

	for _, c := range collectors {
		if !*jsonOnly {
			fmt.Printf("Running collector: %s\n", c.Name())
		}

		result, err := c.Run(node)
		run := collectorRun{
			Name: c.Name(),
		}

		if err != nil {
			run.Status = "error"
			run.Error = err.Error()
			if !*jsonOnly {
				fmt.Printf("  error: %v\n", err)
			}
			collectorRuns = append(collectorRuns, run)
			continue
		}

		run.Status = "ok"
		run.Result = result
		collectorRuns = append(collectorRuns, run)
		if !*jsonOnly {
			printResult(result)
		}
	}

	if *jsonOnly {
		emitJSON(engineOutput{
			Input:       node,
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
			LatencyMs:   max(0, time.Since(startedAt).Milliseconds()),
			Collectors:  collectorRuns,
		})
	}
}

func printCollectors() {
	collectors := plugins.GetCollectors()
	if len(collectors) == 0 {
		fmt.Println("No collectors registered.")
		return
	}

	fmt.Println("Available collectors:")
	for _, c := range collectors {
		fmt.Printf("- %s (inputs: %s)\n", c.Name(), strings.Join(c.InputTypes(), ", "))
	}
}

func printCollectorsJSON() {
	collectors := plugins.GetCollectors()
	list := make([]collectorDescriptor, 0, len(collectors))
	for _, c := range collectors {
		list = append(list, collectorDescriptor{
			Name:       c.Name(),
			InputTypes: c.InputTypes(),
		})
	}

	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})

	emitJSON(collectorsOutput{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Collectors:  list,
	})
}

func emitJSON(payload any) {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(payload); err != nil {
		fmt.Fprintf(os.Stderr, "failed to render json output: %v\n", err)
		os.Exit(1)
	}
}

func printResult(result *plugins.Result) {
	body, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Printf("  failed to render output: %v\n", err)
		return
	}

	fmt.Println(string(body))
}
